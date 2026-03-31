from app import create_app, db
from app.models import Appointment, Message, Conversation

app = create_app()
with app.app_context():
    appts = Appointment.query.order_by(Appointment.id.desc()).limit(3).all()
    print("Recent Appointments:")
    for a in appts:
        print(f"ID: {a.id}, Date: {a.appointment_date}, Doctor: {a.doctor_id}, Patient: {a.patient_id}, Status: {a.status}, Reminder Sent: {a.reminder_sent}")

    convos = Conversation.query.order_by(Conversation.id.desc()).limit(3).all()
    print("\nRecent Conversations:")
    for c in convos:
        print(f"ID: {c.id}, Patient: {c.patient_id}, Staff: {c.staff_id}")

    msgs = Message.query.order_by(Message.id.desc()).limit(5).all()
    print("\nRecent Messages:")
    for m in msgs:
        print(f"ID: {m.id}, Convo: {m.conversation_id}, Sender: {m.sender_id}, Content: {m.content}")
