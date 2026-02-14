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
        'Appointment', foreign_keys='Appointment.patient_id', backref='patient', lazy='dynamic'
    )
    doctor_appointments = db.relationship(
        'Appointment', foreign_keys='Appointment.doctor_id', backref='doctor', lazy='dynamic'
    )
    
    medical_history = db.relationship(
        'MedicalHistory', backref='patient', lazy='dynamic', cascade='all, delete-orphan'
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
