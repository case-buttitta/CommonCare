from app import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    full_name = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(200))
    location = db.Column(db.String(50), nullable=False, default='Charlotte')
    user_type = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    patient_appointments = db.relationship(
        'Appointment',
        back_populates='patient',
        foreign_keys='Appointment.patient_id',
        cascade='all, delete-orphan',
        lazy='dynamic'
    )
    doctor_appointments = db.relationship(
        'Appointment',
        back_populates='doctor',
        foreign_keys='Appointment.doctor_id',
        cascade='all, delete-orphan',
        lazy='dynamic'
    )
    
    medical_history = db.relationship(
        'MedicalHistory', back_populates='patient', lazy='dynamic', cascade='all, delete-orphan'
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'full_name': self.full_name,
            'address': self.address,
            'location': self.location,
            'user_type': self.user_type,
            'created_at': self.created_at.isoformat()
        }

    def __repr__(self):
        return f'<User {self.email}>'


class Appointment(db.Model):
    __tablename__ = 'appointments'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    doctor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    appointment_date = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='pending')  # pending, completed, cancelled
    reason = db.Column(db.String(500))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship to biomarker readings
    biomarker_readings = db.relationship('BiomarkerReading', backref='appointment', lazy='dynamic',
                                         cascade='all, delete-orphan')
    patient = db.relationship(
        "User",
        back_populates="patient_appointments",
        foreign_keys=[patient_id]
    )

    doctor = db.relationship(
        "User",
        back_populates="doctor_appointments",
        foreign_keys=[doctor_id]
    )

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'doctor_id': self.doctor_id,
            'patient_name': self.patient.full_name if self.patient else None,
            'doctor_name': self.doctor.full_name if self.doctor else None,
            'appointment_date': self.appointment_date.isoformat(),
            'status': self.status,
            'reason': self.reason,
            'notes': self.notes,
            'created_at': self.created_at.isoformat(),
            'biomarker_readings': [r.to_dict() for r in self.biomarker_readings]
        }

    def __repr__(self):
        return f'<Appointment {self.id} - {self.status}>'


class BiomarkerReading(db.Model):
    __tablename__ = 'biomarker_readings'

    id = db.Column(db.Integer, primary_key=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointments.id'), nullable=False)
    biomarker_type = db.Column(db.String(50), nullable=False)  # e.g. blood_pressure_systolic
    value = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20), nullable=False)  # e.g. mmHg
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'appointment_id': self.appointment_id,
            'biomarker_type': self.biomarker_type,
            'value': self.value,
            'unit': self.unit,
            'created_at': self.created_at.isoformat()
        }

    def __repr__(self):
        return f'<BiomarkerReading {self.biomarker_type}: {self.value}>'


class MedicalHistory(db.Model):
    __tablename__ = 'medical_history'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    condition = db.Column(db.String(200), nullable=False)
    diagnosis_date = db.Column(db.String(100))  # e.g. "2023-01-15" or "Childhood"
    status = db.Column(db.String(50), default='Active')  # Active, Resolved, Managed
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    patient = db.relationship("User", back_populates="medical_history")

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'condition': self.condition,
            'diagnosis_date': self.diagnosis_date,
            'status': self.status,
            'notes': self.notes,
            'created_at': self.created_at.isoformat()
        }

    def __repr__(self):
        return f'<MedicalHistory {self.condition}>'

class Conversation(db.Model):
    __tablename__ = 'conversations'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    staff_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = db.relationship('User', foreign_keys=[patient_id], backref='patient_conversations')
    staff = db.relationship('User', foreign_keys=[staff_id], backref='staff_conversations')
    messages = db.relationship('Message', back_populates='conversation', cascade='all, delete-orphan',
                               order_by='Message.created_at')

    __table_args__ = (
        db.UniqueConstraint('patient_id', 'staff_id', name='uq_conversation_pair'),
    )

    def to_dict(self, current_user_id=None):
        last_msg = Message.query.filter_by(conversation_id=self.id).order_by(Message.created_at.desc()).first()
        unread = 0
        if current_user_id:
            unread = Message.query.filter_by(conversation_id=self.id, is_read=False)\
                .filter(Message.sender_id != current_user_id).count()
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'staff_id': self.staff_id,
            'patient_name': self.patient.full_name if self.patient else None,
            'staff_name': self.staff.full_name if self.staff else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'last_message': last_msg.to_dict() if last_msg else None,
            'unread_count': unread,
        }

    def __repr__(self):
        return f'<Conversation {self.id}: patient={self.patient_id}, staff={self.staff_id}>'


class Message(db.Model):
    __tablename__ = 'messages'

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversations.id'), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    message_type = db.Column(db.String(20), default='text')  # text, image, reference
    reference_type = db.Column(db.String(30))  # appointment, biomarker
    reference_id = db.Column(db.Integer)
    image_url = db.Column(db.String(500))
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    conversation = db.relationship('Conversation', back_populates='messages')
    sender = db.relationship('User', foreign_keys=[sender_id])
    reactions = db.relationship('MessageReaction', back_populates='message', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'conversation_id': self.conversation_id,
            'sender_id': self.sender_id,
            'sender_name': self.sender.full_name if self.sender else None,
            'content': self.content,
            'message_type': self.message_type,
            'reference_type': self.reference_type,
            'reference_id': self.reference_id,
            'image_url': self.image_url,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat(),
            'reactions': [r.to_dict() for r in self.reactions],
        }

    def __repr__(self):
        return f'<Message {self.id} in conv={self.conversation_id}>'


class MessageReaction(db.Model):
    __tablename__ = 'message_reactions'

    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey('messages.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    emoji = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    message = db.relationship('Message', back_populates='reactions')
    user = db.relationship('User', foreign_keys=[user_id])

    __table_args__ = (
        db.UniqueConstraint('message_id', 'user_id', 'emoji', name='uq_reaction'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'message_id': self.message_id,
            'user_id': self.user_id,
            'user_name': self.user.full_name if self.user else None,
            'emoji': self.emoji,
        }


class MessageRequest(db.Model):
    __tablename__ = 'message_requests'

    id = db.Column(db.Integer, primary_key=True)
    from_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    to_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, accepted, rejected
    message = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    from_user = db.relationship('User', foreign_keys=[from_user_id])
    to_user = db.relationship('User', foreign_keys=[to_user_id])

    def to_dict(self):
        return {
            'id': self.id,
            'from_user_id': self.from_user_id,
            'to_user_id': self.to_user_id,
            'from_user_name': self.from_user.full_name if self.from_user else None,
            'from_user_type': self.from_user.user_type if self.from_user else None,
            'to_user_name': self.to_user.full_name if self.to_user else None,
            'to_user_type': self.to_user.user_type if self.to_user else None,
            'status': self.status,
            'message': self.message,
            'created_at': self.created_at.isoformat(),
        }


class NormalRange(db.Model):
    __tablename__ = 'normal_ranges'

    id = db.Column(db.Integer, primary_key=True)
    biomarker_type = db.Column(db.String(100), nullable=False)
    min_value = db.Column(db.Float, nullable=False)
    max_value = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'biomarker_type': self.biomarker_type,
            'min_value': self.min_value,
            'max_value': self.max_value,
            'unit': self.unit
        }
