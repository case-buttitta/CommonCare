import os
import re
from datetime import datetime
from flask import Blueprint, jsonify, request
from app import db
from app.models import User, Appointment, MedicalHistory, NormalRange
from app.auth import token_required

ai_chat = Blueprint('ai_chat', __name__)

OPENAI_API_KEY = os.environ.get('OPEN_API_KEY', '')

CLASSIFIER_PROMPT = """You are a message classifier for a healthcare app called CommonCare. Your job is to decide if a patient's message should be answered by the health assistant.

Classify the message into exactly ONE category:

- "allowed" — The message is related to health, medicine, wellness, biomarkers, appointments, treatments, medical conditions, diet, exercise, mental health, general health education, or is a greeting/follow-up. Be GENEROUS here — if there is any reasonable health connection, allow it.
- "privacy" — The message is asking to see OTHER patients' data, someone else's medical records, or information about other users. Do NOT flag messages that simply ask about the patient's own data.
- "off_topic" — The message is clearly unrelated to health (e.g. politics, sports scores, coding, movies, math homework, etc.)

Respond with ONLY a JSON object, no other text:
{"verdict": "allowed"|"privacy"|"off_topic", "reason": "brief explanation"}"""


def _classify_message(message):
    """Use a lightweight AI call to classify message relevancy and privacy.
    Returns a dict with 'verdict' ('allowed', 'privacy', 'off_topic') and 'reason'.
    Falls back to 'allowed' if no API key or on error (fail-open)."""
    if not OPENAI_API_KEY:
        return {'verdict': 'allowed', 'reason': ''}

    try:
        import openai, json
        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": CLASSIFIER_PROMPT},
                {"role": "user", "content": message},
            ],
            max_tokens=80,
            temperature=0,
        )
        raw = completion.choices[0].message.content.strip()
        # Parse the JSON response
        result = json.loads(raw)
        if result.get('verdict') in ('allowed', 'privacy', 'off_topic'):
            return result
        return {'verdict': 'allowed', 'reason': ''}
    except Exception as e:
        print(f"Classifier error (failing open): {e}")
        return {'verdict': 'allowed', 'reason': ''}


def _gather_patient_context(patient_id):
    """Gather all patient data to provide as rich context to the AI."""
    patient = User.query.get(patient_id)
    if not patient:
        return ""

    now = datetime.utcnow()
    parts = []
    parts.append(f"Today's date: {now.strftime('%Y-%m-%d')}")
    parts.append(f"Patient: {patient.full_name}")
    parts.append(f"Location: {patient.location}")
    if patient.address:
        parts.append(f"Address: {patient.address}")

    # ── Medical History ──
    history = MedicalHistory.query.filter_by(patient_id=patient_id)\
        .order_by(MedicalHistory.created_at.desc()).all()
    if history:
        parts.append("\n--- Medical History ---")
        for h in history:
            parts.append(f"- {h.condition} (Status: {h.status}, Diagnosed: {h.diagnosis_date or 'N/A'})")
            if h.notes:
                parts.append(f"  Notes: {h.notes}")

    # ── Normal Ranges (build lookup for biomarker annotation) ──
    normal_ranges = NormalRange.query.all()
    nr_lookup = {}
    if normal_ranges:
        parts.append("\n--- Normal Ranges ---")
        for nr in normal_ranges:
            name = nr.biomarker_type.replace('_', ' ').title()
            parts.append(f"- {name}: {nr.min_value}-{nr.max_value} {nr.unit}")
            nr_lookup[nr.biomarker_type] = (nr.min_value, nr.max_value)

    # ── Appointments (split into upcoming vs past) ──
    all_appointments = Appointment.query.filter_by(patient_id=patient_id)\
        .order_by(Appointment.appointment_date.asc()).all()

    upcoming = [a for a in all_appointments if a.appointment_date >= now and a.status not in ('completed', 'cancelled')]
    past = [a for a in all_appointments if a.appointment_date < now or a.status in ('completed', 'cancelled')]

    if upcoming:
        parts.append(f"\n--- Upcoming Appointments ({len(upcoming)}) ---")
        for a in upcoming:
            date_str = a.appointment_date.strftime('%Y-%m-%d %H:%M') if a.appointment_date else 'N/A'
            doctor_name = a.doctor.full_name if a.doctor else 'N/A'
            parts.append(f"- {date_str} with {doctor_name} | Status: {a.status} | Reason: {a.reason or 'N/A'}")
    else:
        parts.append("\n--- Upcoming Appointments ---")
        parts.append("- None scheduled")

    if past:
        # Show most recent 10 past appointments
        recent_past = sorted(past, key=lambda a: a.appointment_date, reverse=True)[:10]
        parts.append(f"\n--- Past Appointments (most recent {len(recent_past)}) ---")
        for a in recent_past:
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

    # ── Biomarker History with Range Status ──
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
        parts.append("\n--- Biomarker History (with range status) ---")
        for btype, readings in biomarker_history.items():
            latest = readings[-1]
            name = btype.replace('_', ' ').title()
            # Determine range status
            status_str = ""
            if btype in nr_lookup:
                lo, hi = nr_lookup[btype]
                if latest['value'] > hi:
                    status_str = f" ⚠️ HIGH (normal: {lo}-{hi})"
                elif latest['value'] < lo:
                    status_str = f" ⚠️ LOW (normal: {lo}-{hi})"
                else:
                    status_str = f" ✅ Normal (range: {lo}-{hi})"
            parts.append(f"- {name}: {latest['value']} {latest['unit']} ({latest['date']}){status_str}")
            if len(readings) > 1:
                prev = readings[-2]
                diff = latest['value'] - prev['value']
                direction = "↑ up" if diff > 0 else "↓ down" if diff < 0 else "→ unchanged"
                parts.append(f"  Trend: {direction} from {prev['value']} on {prev['date']}")

    return "\n".join(parts)


SYSTEM_PROMPT = """You are CareBot, an AI health assistant for CommonCare, a healthcare management platform.

Your role:
- Help patients understand their health data including biomarkers, appointments, treatments, and medical history.
- Explain what biomarker readings mean and whether they are in normal range.
- Summarize appointment history and treatment plans.
- Provide general health education related to the patient's conditions.
- Be empathetic, clear, and concise.

Knowledge & general health education:
- You ARE encouraged to use your general medical knowledge to answer health questions fully. When a patient asks "why is my blood pressure high?" or "what causes high cholesterol?", give a thorough, helpful answer covering causes, risk factors, lifestyle advice, symptoms to watch for, and when to see a doctor.
- You CAN explain medical conditions, how biomarkers work, what lifestyle changes help, dietary advice, exercise recommendations, medication categories, and anything else health-related — just like a knowledgeable health educator would.
- Always tie your general knowledge back to the patient's actual data when relevant. For example, if their diastolic blood pressure is flagged HIGH, explain what that means clinically, what could cause it, and what they should do — referencing their specific reading.
- When discussing whether a reading is "normal" or "high" or "low", ALWAYS use the normal ranges from the CommonCare data provided below — NOT generic ranges from the internet. The ranges in the patient data are what their healthcare providers have configured for them.

Data rules:
- Use the patient's actual data provided in context to give personalized responses.
- When discussing biomarkers, ALWAYS check the range status annotations (⚠️ HIGH, ⚠️ LOW, ✅ Normal) and proactively mention when readings are outside normal range. Cite the specific value, the normal range from the data, and explain what it means.
- When the patient asks about "upcoming" appointments, ONLY show appointments from the "Upcoming Appointments" section. When they ask about past appointments, use the "Past Appointments" section. Do NOT mix these up.
- NEVER share or discuss other patients' data. If asked about other patients, explain that you can only access the current patient's data for privacy and security reasons.

Safety rules:
- NEVER provide specific medical diagnoses or prescribe specific medications. Always recommend consulting their doctor for diagnosis and prescription decisions.
- You CAN suggest general categories of action (e.g., "you may want to discuss blood pressure medication with your doctor", "lifestyle changes like reducing sodium intake can help") — just don't prescribe specific drugs or dosages.
- If a reading is dangerously out of range, be clear and direct about the urgency of seeing a doctor. Don't downplay serious values.
- NEVER discuss topics unrelated to health, medicine, or wellness. If asked about unrelated topics, politely decline: "That topic isn't related to health or your medical data. I can help with health-related questions such as your biomarkers, appointments, treatments, and medical conditions."

Formatting:
- Keep responses concise but informative. Use bullet points for clarity when listing multiple items.
- Use **bold** for emphasis on key values, warnings, and important advice.
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

    # AI-powered message classification (privacy + relevance in one call)
    classification = _classify_message(user_message)
    if classification['verdict'] == 'privacy':
        return jsonify({
            'response': "I'm sorry, but I can only access **your** health data. For privacy and security reasons, I cannot share information about other patients. This protects everyone's medical records, including yours.\n\nIs there anything about **your** health data I can help with?",
            'filtered': True,
            'reason': 'privacy'
        })
    if classification['verdict'] == 'off_topic':
        return jsonify({
            'response': f"That topic doesn't seem to be related to health or your medical data. I'm designed to help specifically with health-related questions — including your biomarkers, appointments, treatments, medical conditions, and general health education.\n\nCould you ask me something related to your health?",
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
            max_tokens=1000,
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


def _extract_section(context, header_keyword):
    """Extract lines from a specific section of the patient context."""
    lines = context.split('\n')
    in_section = False
    section_lines = []
    for line in lines:
        if f'--- {header_keyword}' in line:
            in_section = True
            continue
        if in_section:
            if line.startswith('---') or (line.startswith('\n---')):
                break
            if line.strip():
                section_lines.append(line)
    return section_lines


def _fallback_response(user_message, patient_context):
    """Provide a structured response when OpenAI is unavailable.
    Parses the enriched patient context to give targeted answers."""
    msg = user_message.lower()

    if re.search(r'\b(?:hello|hey|greet)\b', msg) or re.search(r'\bhi\b', msg):
        return "Hello! I'm CareBot, your CommonCare health assistant. I can help you understand your biomarkers, review your appointments, and discuss your medical history. What would you like to know?"

    # ── Upcoming appointments ──
    if any(w in msg for w in ['upcoming', 'next', 'scheduled', 'future']):
        section = _extract_section(patient_context, 'Upcoming Appointments')
        if section and not any('None scheduled' in l for l in section):
            summary = "\n".join(section)
            return f"Your upcoming appointments:\n\n{summary}\n\nWould you like more details about any of these?"
        return "You don't have any upcoming appointments scheduled. You can book one through the 'Book Appointment' tab on your dashboard."

    # ── Past appointments ──
    if any(w in msg for w in ['past', 'previous', 'history', 'recent']) and any(w in msg for w in ['appointment', 'visit']):
        section = _extract_section(patient_context, 'Past Appointments')
        if section:
            summary = "\n".join(section[:8])
            return f"Your recent past appointments:\n\n{summary}\n\nWould you like more details about any specific visit?"
        return "No past appointments found in your records."

    # ── General appointment question (default to upcoming) ──
    if any(w in msg for w in ['appointment', 'schedule', 'visit']):
        upcoming = _extract_section(patient_context, 'Upcoming Appointments')
        has_upcoming = upcoming and not any('None scheduled' in l for l in upcoming)
        past = _extract_section(patient_context, 'Past Appointments')

        parts = []
        if has_upcoming:
            parts.append("**Upcoming appointments:**\n" + "\n".join(upcoming))
        else:
            parts.append("**Upcoming appointments:** None scheduled")
        if past:
            parts.append("\n**Recent past appointments:**\n" + "\n".join(past[:5]))
        return "\n".join(parts) + "\n\nWould you like more details about any appointment?"

    # ── Specific biomarker question (e.g. "blood pressure", "cholesterol") ──
    biomarker_keywords = {
        'blood pressure': ['blood pressure', 'bp'],
        'systolic': ['systolic'],
        'diastolic': ['diastolic'],
        'heart rate': ['heart rate', 'pulse', 'hr'],
        'cholesterol': ['cholesterol'],
        'blood sugar': ['blood sugar', 'glucose'],
        'vitamin d': ['vitamin d', 'vitamin'],
        'bmi': ['bmi', 'body mass'],
        'hba1c': ['hba1c', 'a1c', 'hemoglobin a1c'],
    }

    bio_section = _extract_section(patient_context, 'Biomarker History')
    if bio_section:
        # Check if user is asking about a specific biomarker
        matched_lines = []
        for line in bio_section:
            line_lower = line.lower()
            for display_name, keywords in biomarker_keywords.items():
                if any(kw in msg for kw in keywords) and any(kw in line_lower for kw in keywords):
                    matched_lines.append(line)

        if matched_lines:
            summary = "\n".join(matched_lines)
            # Check for any warnings
            has_warning = any('⚠️' in l for l in matched_lines)
            advice = ""
            if has_warning:
                advice = "\n\n⚠️ **Some readings are outside the normal range.** Please discuss these results with your doctor at your next appointment."
            else:
                advice = "\n\n✅ These readings appear to be within normal range."
            return f"Here's what I found for your readings:\n\n{summary}{advice}\n\nWould you like to know more about what these values mean?"

    # ── General biomarker question ──
    if any(w in msg for w in ['biomarker', 'reading', 'lab', 'test', 'result', 'blood', 'pressure',
                               'cholesterol', 'sugar', 'vitamin', 'bmi', 'a1c', 'heart rate',
                               'diastolic', 'systolic', 'look', 'good', 'bad', 'high', 'low']):
        if bio_section:
            summary = "\n".join(bio_section)
            has_warning = any('⚠️' in l for l in bio_section)
            advice = ""
            if has_warning:
                advice = "\n\n⚠️ **Some readings are flagged as outside normal range** (marked with ⚠️). Please discuss these with your doctor."
            return f"Here's a summary of your biomarker readings:\n\n{summary}{advice}\n\nAsk me about a specific biomarker for more detail, or consult your doctor for medical advice."
        return "I don't see any biomarker readings in your records yet. Once your doctor records readings during appointments, I'll be able to help you understand them."

    # ── Treatments ──
    if any(w in msg for w in ['treatment', 'medication', 'medicine', 'prescription']):
        past_section = _extract_section(patient_context, 'Past Appointments')
        treat_lines = [l for l in past_section if 'Treatment' in l or 'treatment' in l.lower()]
        if treat_lines:
            summary = "\n".join(treat_lines[:5])
            return f"Here's information about your treatments:\n\n{summary}\n\nAlways consult your doctor before making changes to your treatment plan."
        return "I can help you understand your treatments once they're recorded in your appointments. Check your completed appointments for treatment details."

    # ── Medical conditions ──
    if any(w in msg for w in ['condition', 'diagnosis', 'medical history', 'diagnosed']):
        section = _extract_section(patient_context, 'Medical History')
        if section:
            summary = "\n".join(section)
            return f"Your medical history:\n\n{summary}\n\nWould you like to know more about any condition?"
        return "No medical history records found. Your doctor can add conditions to your profile during appointments."

    # ── Normal ranges ──
    if any(w in msg for w in ['normal range', 'range', 'normal']):
        section = _extract_section(patient_context, 'Normal Ranges')
        if section:
            summary = "\n".join(section[:12])
            return f"Here are the normal ranges for your biomarkers:\n\n{summary}\n\nI can compare your readings against these ranges if you ask about a specific biomarker."
        return "Normal range information is set by your medical staff. Ask them to configure ranges in the system."

    # ── Summary / overview ──
    if any(w in msg for w in ['summary', 'overview', 'everything', 'all']):
        return f"Here's an overview of your health profile:\n\n{patient_context[:2000]}\n\nWould you like me to focus on any specific area?"

    return "I can help you with:\n\n- **Biomarkers** — Understanding your health readings, trends, and whether they're in normal range\n- **Appointments** — Reviewing upcoming and past visits\n- **Treatments** — Understanding your treatment plans\n- **Medical History** — Reviewing your conditions\n- **Normal Ranges** — What healthy values look like\n\nWhat would you like to know more about?"


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
