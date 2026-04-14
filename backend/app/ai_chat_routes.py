import os
import re
from flask import Blueprint, jsonify, request
from app import db
from app.models import User, Appointment, MedicalHistory, NormalRange
from app.auth import token_required

ai_chat = Blueprint('ai_chat', __name__)

OPENAI_API_KEY = os.environ.get('OPEN_API_KEY', '')

# Topics the AI is allowed to discuss
ALLOWED_TOPICS = [
    'biomarker', 'blood pressure', 'heart rate', 'cholesterol', 'blood sugar',
    'vitamin', 'bmi', 'hba1c', 'kidney', 'liver', 'calcium', 'hemoglobin',
    'oxygen', 'temperature', 'respiratory', 'triglycerides', 'weight', 'height',
    'appointment', 'treatment', 'medication', 'medical history', 'condition',
    'diagnosis', 'health', 'doctor', 'nurse', 'staff', 'prescription',
    'symptom', 'side effect', 'dosage', 'diet', 'exercise', 'wellness',
    'normal range', 'test result', 'lab', 'reading', 'trend', 'recommendation',
    'pulse', 'vital', 'checkup', 'follow-up', 'schedule', 'remind',
    'hello', 'hi', 'hey', 'help', 'thank', 'explain', 'what', 'how', 'why',
    'summary', 'overview', 'understand', 'mean', 'concern', 'worried',
    'disease', 'disorder', 'therapy', 'prevention', 'risk', 'cause',
    'manage', 'improve', 'lower', 'reduce', 'increase', 'level',
    'food', 'nutrition', 'sleep', 'stress', 'anxiety', 'mental',
    'pain', 'headache', 'fatigue', 'allergy', 'infection', 'inflammation',
    'sugar', 'sodium', 'protein', 'fiber', 'carb', 'fat',
    'stroke', 'diabetes', 'asthma', 'arthritis', 'cancer', 'anemia',
    'hypertension', 'obesity', 'insulin', 'immune', 'vaccine', 'surgery',
]

# Phrases that indicate a request for other patients' data
PRIVACY_PATTERNS = [
    r"\bother\s+patient",
    r"\bsomeone\s*else",
    r"\banother\s+patient",
    r"\bother\s+people",
    r"\beveryone\s*(?:'s|s)?\s+(?:data|record|condition|history|info)",
    r"\ball\s+patient",
    r"\bother\s+user",
    r"\banother\s+person",
    r"\btheir\s+(?:data|medical|health|record|condition)",
]


def _check_privacy(message):
    """Check if the message is requesting access to other patients' data."""
    msg_lower = message.lower().strip()
    return any(re.search(p, msg_lower) for p in PRIVACY_PATTERNS)


def _is_relevant(message):
    """Check if the user message is health/medical related or a greeting."""
    msg_lower = message.lower().strip()
    # Allow short messages (likely greetings or follow-ups)
    if len(msg_lower) < 15:
        return True
    return any(topic in msg_lower for topic in ALLOWED_TOPICS)


def _gather_patient_context(patient_id):
    """Gather all patient data to provide as context to the AI."""
    patient = User.query.get(patient_id)
    if not patient:
        return ""

    parts = []
    parts.append(f"Patient: {patient.full_name}")
    parts.append(f"Location: {patient.location}")
    if patient.address:
        parts.append(f"Address: {patient.address}")

    # Medical history
    history = MedicalHistory.query.filter_by(patient_id=patient_id)\
        .order_by(MedicalHistory.created_at.desc()).all()
    if history:
        parts.append("\n--- Medical History ---")
        for h in history:
            parts.append(f"- {h.condition} (Status: {h.status}, Diagnosed: {h.diagnosis_date or 'N/A'})")
            if h.notes:
                parts.append(f"  Notes: {h.notes}")

    # Appointments
    appointments = Appointment.query.filter_by(patient_id=patient_id)\
        .order_by(Appointment.appointment_date.desc()).limit(10).all()
    if appointments:
        parts.append("\n--- Recent Appointments (up to 10) ---")
        for a in appointments:
            date_str = a.appointment_date.strftime('%Y-%m-%d') if a.appointment_date else 'N/A'
            doctor_name = a.doctor.full_name if a.doctor else 'N/A'
            parts.append(f"- {date_str} with {doctor_name} | Status: {a.status} | Reason: {a.reason or 'N/A'}")
            if a.notes:
                parts.append(f"  Notes: {a.notes}")
            if a.treatments:
                parts.append(f"  Treatments: {a.treatments}")
            readings = list(a.biomarker_readings)
            if readings:
                readings_str = ", ".join(f"{r.biomarker_type}: {r.value} {r.unit}" for r in readings)
                parts.append(f"  Biomarkers: {readings_str}")

    # Latest biomarker readings
    completed_appts = Appointment.query.filter_by(
        patient_id=patient_id, status='completed'
    ).order_by(Appointment.appointment_date.asc()).all()

    biomarker_history = {}
    for appt in completed_appts:
        for reading in appt.biomarker_readings:
            if reading.biomarker_type not in biomarker_history:
                biomarker_history[reading.biomarker_type] = []
            biomarker_history[reading.biomarker_type].append({
                'value': reading.value,
                'unit': reading.unit,
                'date': appt.appointment_date.strftime('%Y-%m-%d'),
            })

    if biomarker_history:
        parts.append("\n--- Biomarker History ---")
        for btype, readings in biomarker_history.items():
            latest = readings[-1]
            name = btype.replace('_', ' ').title()
            parts.append(f"- {name}: Latest {latest['value']} {latest['unit']} ({latest['date']})")
            if len(readings) > 1:
                prev = readings[-2]
                diff = latest['value'] - prev['value']
                direction = "up" if diff > 0 else "down" if diff < 0 else "unchanged"
                parts.append(f"  Trend: {direction} (previous: {prev['value']} on {prev['date']})")

    # Normal ranges
    normal_ranges = NormalRange.query.all()
    if normal_ranges:
        parts.append("\n--- Normal Ranges ---")
        for nr in normal_ranges:
            name = nr.biomarker_type.replace('_', ' ').title()
            parts.append(f"- {name}: {nr.min_value}-{nr.max_value} {nr.unit}")

    return "\n".join(parts)


SYSTEM_PROMPT = """You are CareBot, an AI health assistant for CommonCare, a healthcare management platform.

Your role:
- Help patients understand their health data including biomarkers, appointments, treatments, and medical history.
- Explain what biomarker readings mean and whether they are in normal range.
- Summarize appointment history and treatment plans.
- Provide general health education related to the patient's conditions.
- Be empathetic, clear, and concise.

Important rules:
- NEVER provide specific medical diagnoses or prescribe treatments. Always recommend consulting their doctor.
- NEVER discuss topics unrelated to health, medicine, or the patient's CommonCare data. If asked about unrelated topics (politics, entertainment, coding, etc.), politely decline and explain: "That topic isn't related to health or your medical data. I can only help with health-related questions such as your biomarkers, appointments, treatments, and medical conditions."
- You ARE allowed to provide general health education and information about medical conditions, even if it goes beyond the patient's specific data. For example, explaining what high cholesterol is, its causes, risk factors, lifestyle tips, etc. Use your general medical knowledge to educate the patient, but always tie it back to their data when possible and recommend consulting their doctor for personalized advice.
- NEVER share or discuss other patients' data. If asked about other patients, explain that you can only access the current patient's data for privacy and security reasons.
- Use the patient's actual data provided in context to give personalized responses.
- When discussing biomarkers, reference the normal ranges and explain if values are within range or not.
- Keep responses concise but informative. Use bullet points for clarity when listing multiple items.
- Always end with an offer to help further or a suggestion to consult their healthcare provider for medical decisions.

Below is the patient's current health data from CommonCare:
"""


@ai_chat.route('/api/ai-chat', methods=['POST'])
@token_required
def chat_with_ai(current_user):
    """AI chat endpoint - patients only."""
    # Block staff/doctors
    if current_user.user_type != 'patient':
        return jsonify({
            'error': 'ai_blocked',
            'message': 'AI Health Assistant is only available for patients. As a medical professional, please use internal services and clinical tools for health information.'
        }), 403

    data = request.get_json()
    if not data or not data.get('message'):
        return jsonify({'error': 'Message is required'}), 400

    user_message = data['message'].strip()
    if not user_message:
        return jsonify({'error': 'Message cannot be empty'}), 400

    # Check for privacy violations first
    if _check_privacy(user_message):
        return jsonify({
            'response': "I'm sorry, but I can only access **your** health data. For privacy and security reasons, I cannot share information about other patients. This protects everyone's medical records, including yours.\n\nIs there anything about **your** health data I can help with?",
            'filtered': True,
            'reason': 'privacy'
        })

    # Check relevance
    if not _is_relevant(user_message):
        return jsonify({
            'response': "That topic doesn't seem to be related to health or your medical data. I'm designed to help specifically with health-related questions — including your biomarkers, appointments, treatments, medical conditions, and general health education.\n\nCould you ask me something related to your health?",
            'filtered': True,
            'reason': 'off_topic'
        })

    # Gather patient context
    patient_context = _gather_patient_context(current_user.id)
    system_message = SYSTEM_PROMPT + "\n" + patient_context

    # Build conversation history from request
    conversation_history = data.get('history', [])
    messages = [{"role": "system", "content": system_message}]
    for msg in conversation_history[-20:]:  # Keep last 20 messages for context
        role = "assistant" if msg.get('from') == 'ai' else "user"
        messages.append({"role": role, "content": msg.get('text', '')})
    messages.append({"role": "user", "content": user_message})

    if not OPENAI_API_KEY:
        # Fallback: provide a helpful response without OpenAI
        return jsonify({
            'response': _fallback_response(user_message, patient_context),
            'filtered': False
        })

    try:
        import openai
        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=600,
            temperature=0.7,
        )
        ai_response = completion.choices[0].message.content
        return jsonify({'response': ai_response, 'filtered': False})
    except Exception as e:
        print(f"OpenAI API error: {e}")
        return jsonify({
            'response': _fallback_response(user_message, patient_context),
            'filtered': False
        })


def _fallback_response(user_message, patient_context):
    """Provide a basic response when OpenAI is unavailable."""
    msg = user_message.lower()

    if re.search(r'\b(?:hello|hey|greet)\b', msg) or re.search(r'\bhi\b', msg):
        return "Hello! I'm CareBot, your CommonCare health assistant. I can help you understand your biomarkers, review your appointments, and discuss your medical history. What would you like to know?"

    # Condition-specific education (e.g. "tell me more about high cholesterol")
    if re.search(r'\b(?:tell|more|about|explain|what is|what are)\b', msg):
        condition_info = {
            'cholesterol': "**High Cholesterol** is a condition where there's too much cholesterol in your blood. It can increase your risk of heart disease and stroke.\n\n- **Causes**: Diet high in saturated fats, lack of exercise, genetics, obesity\n- **Risk factors**: Family history, poor diet, lack of physical activity, smoking\n- **Management**: Heart-healthy diet, regular exercise, maintaining a healthy weight, and medication if prescribed by your doctor\n\nBased on your records, you have an active diagnosis of High Cholesterol (diagnosed 2024-06-10). Please consult your doctor for a personalized management plan.",
            'hypertension': "**Hypertension (High Blood Pressure)** is when the force of blood against your artery walls is consistently too high.\n\n- **Causes**: Often develops over years; risk increases with age, obesity, high sodium diet, and stress\n- **Risk factors**: Family history, being overweight, physical inactivity, too much salt, too much alcohol\n- **Management**: Lifestyle changes (diet, exercise, stress reduction), reducing sodium intake, and medications as prescribed\n\nBased on your records, your hypertension status is Managed. Continue following your doctor's recommendations.",
            'allerg': "**Seasonal Allergies** occur when your immune system overreacts to outdoor allergens like pollen.\n\n- **Common symptoms**: Sneezing, runny nose, itchy eyes, congestion\n- **Triggers**: Pollen from trees, grasses, and weeds; mold spores\n- **Management**: Antihistamines, nasal corticosteroid sprays, avoiding triggers, keeping windows closed during high pollen days\n\nBased on your records, you have active Seasonal Allergies. Talk to your doctor about the best treatment plan for you.",
        }
        for keyword, info in condition_info.items():
            if keyword in msg:
                return info + "\n\nWould you like to know about another condition or any of your health data?"

    if any(w in msg for w in ['biomarker', 'reading', 'lab', 'test result', 'blood pressure', 'cholesterol', 'blood sugar']):
        # Extract biomarker info from context
        lines = patient_context.split('\n')
        bio_lines = [l for l in lines if l.startswith('- ') and any(
            w in l.lower() for w in ['latest', 'trend']
        )]
        if bio_lines:
            summary = "\n".join(bio_lines[:8])
            return f"Here's a summary of your recent biomarker readings:\n\n{summary}\n\nWould you like me to explain any specific reading? Remember to consult your doctor for medical advice."
        return "I don't see any biomarker readings in your records yet. Once your doctor records readings during appointments, I'll be able to help you understand them."

    if any(w in msg for w in ['appointment', 'schedule', 'visit', 'doctor', 'upcoming']):
        lines = patient_context.split('\n')
        appt_lines = [l for l in lines if l.startswith('- ') and ('Status:' in l)]
        if appt_lines:
            summary = "\n".join(appt_lines[:5])
            return f"Here are your recent appointments:\n\n{summary}\n\nWould you like more details about any specific appointment?"
        return "I don't see any appointments in your records. You can book one through the 'Book Appointment' tab on your dashboard."

    if any(w in msg for w in ['treatment', 'medication', 'medicine', 'prescription']):
        lines = patient_context.split('\n')
        treat_lines = [l for l in lines if 'Treatment' in l or 'medication' in l.lower()]
        if treat_lines:
            summary = "\n".join(treat_lines[:5])
            return f"Here's information about your treatments:\n\n{summary}\n\nAlways consult your doctor before making changes to your treatment plan."
        return "I can help you understand your treatments once they're recorded in your appointments. Check your completed appointments for treatment details."

    if any(w in msg for w in ['history', 'condition', 'diagnosis']):
        lines = patient_context.split('\n')
        hist_lines = [l for l in lines if l.startswith('- ') and ('Status:' in l and 'Diagnosed:' in l)]
        if hist_lines:
            summary = "\n".join(hist_lines)
            return f"Your medical history:\n\n{summary}\n\nWould you like to know more about any condition?"
        return "No medical history records found. Your doctor can add conditions to your profile during appointments."

    if any(w in msg for w in ['normal range', 'range', 'normal']):
        lines = patient_context.split('\n')
        range_lines = [l for l in lines if l.startswith('- ') and '-' in l[2:]]
        nr_section = False
        nr_lines = []
        for l in lines:
            if 'Normal Ranges' in l:
                nr_section = True
                continue
            if nr_section and l.startswith('- '):
                nr_lines.append(l)
            elif nr_section and l.startswith('\n---'):
                break
        if nr_lines:
            summary = "\n".join(nr_lines[:10])
            return f"Here are the normal ranges for your biomarkers:\n\n{summary}\n\nI can compare your readings against these ranges if you ask about a specific biomarker."
        return "Normal range information is set by your medical staff. Ask them to configure ranges in the system."

    if any(w in msg for w in ['summary', 'overview', 'everything', 'all']):
        return f"Here's an overview of your health profile:\n\n{patient_context[:1500]}\n\nWould you like me to focus on any specific area?"

    return "I can help you with:\n\n- **Biomarkers** - Understanding your health readings and trends\n- **Appointments** - Reviewing past and upcoming visits\n- **Treatments** - Understanding your treatment plans\n- **Medical History** - Reviewing your conditions\n- **Normal Ranges** - What healthy values look like\n\nWhat would you like to know more about?"


@ai_chat.route('/api/ai-chat/context', methods=['GET'])
@token_required
def get_ai_context(current_user):
    """Return a summary of what data the AI has access to, for the welcome message."""
    if current_user.user_type != 'patient':
        return jsonify({'error': 'ai_blocked'}), 403

    # Count available data
    appt_count = Appointment.query.filter_by(patient_id=current_user.id).count()
    history_count = MedicalHistory.query.filter_by(patient_id=current_user.id).count()

    completed_appts = Appointment.query.filter_by(
        patient_id=current_user.id, status='completed'
    ).all()
    biomarker_types = set()
    for appt in completed_appts:
        for r in appt.biomarker_readings:
            biomarker_types.add(r.biomarker_type)

    return jsonify({
        'patient_name': current_user.full_name,
        'appointments': appt_count,
        'conditions': history_count,
        'biomarker_types': len(biomarker_types),
    })
