from app.models import Appointment, Conversation, Message, User
from app import db
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

def send_appointment_reminders(app):
    """
    Background job to send appointment reminders for appointments starting within the next 24 hours.
    Requires the Flask app context.
    """
    with app.app_context():
        now = datetime.utcnow()
        limit_date = now + timedelta(hours=24)
        
        # Look for upcoming appointments that haven't had a reminder sent
        # and are status 'pending' (or maybe 'completed' shouldn't get reminders, so 'pending'/'confirmed')
        upcoming_appointments = Appointment.query.filter(
            Appointment.appointment_date > now,
            Appointment.appointment_date <= limit_date,
            Appointment.status != 'cancelled',
            Appointment.status != 'completed',
            Appointment.reminder_sent == False
        ).all()

        for appt in upcoming_appointments:
            patient_id = appt.patient_id
            doctor_id = appt.doctor_id
            
            doctor = User.query.get(doctor_id)
            if not doctor:
                continue
                
            # Find or create a conversation between the patient and doctor
            convo = Conversation.query.filter_by(
                patient_id=patient_id, 
                staff_id=doctor_id
            ).first()
            
            if not convo:
                convo = Conversation(patient_id=patient_id, staff_id=doctor_id)
                db.session.add(convo)
                db.session.flush() # Ensure convo gets an ID
            
            formatted_date = appt.appointment_date.strftime("%B %d, %Y at %I:%M %p")
            message_text = (f"Reminder: You have an upcoming appointment with {doctor.full_name} "
                            f"on {formatted_date}.")
            
            msg = Message(
                conversation_id=convo.id,
                sender_id=doctor_id, # Sending on behalf of the doctor
                content=message_text,
                message_type='text',
                reference_type='appointment',
                reference_id=appt.id,
                is_read=False
            )
            db.session.add(msg)
            
            # Update the conversation timestamp to push it to the top
            convo.updated_at = now
            
            # Mark reminder as sent
            appt.reminder_sent = True
            
            logger.info(f"Sent reminder for appointment {appt.id} between patient {patient_id} and doctor {doctor_id}")

        db.session.commit()
