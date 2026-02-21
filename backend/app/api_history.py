from flask_smorest import Blueprint, abort
from flask import jsonify, request
from flask.views import MethodView
from app import db
from app.models import User, MedicalHistory
from app.auth import token_required
from app.schemas import MedicalHistorySchema, MedicalHistoryUpdateSchema

blp = Blueprint(
    'Medical History API', 'medical_history', url_prefix='/api',
    description='Operations on medical history'
)

# NOTE: Since flask_smorest.Blueprint replaces flask.Blueprint, we can use 
# standard decorators inside the routes, but we can't cleanly integrate the 
# global @token_required wrapper without some tricks, or we can just apply it normally!
# Let's apply it and retrieve current_user from it.
# However, `flask-smorest` decorators must be the outermost ones.

@blp.route('/patients/<int:patient_id>/medical-history')
class PatientMedicalHistoryList(MethodView):
    @blp.response(200, MedicalHistorySchema(many=True))
    @token_required
    def get(current_user, self, patient_id):
        """List medical history for a patient"""
        # Access control
        if current_user.user_type == 'patient' and current_user.id != patient_id:
            abort(403, message='Access denied: Cannot view other patients\' history')
        
        # Verify patient exists
        if not User.query.get(patient_id):
            abort(404, message='Patient not found')

        history = MedicalHistory.query.filter_by(patient_id=patient_id).order_by(MedicalHistory.created_at.desc()).all()
        return history

@blp.route('/medical-history')
class MedicalHistoryResource(MethodView):
    @blp.arguments(MedicalHistorySchema)
    @blp.response(201, MedicalHistorySchema)
    @token_required
    def post(current_user, self, data):
        """Create a new medical history record. Staff only."""
        if current_user.user_type != 'staff':
            abort(403, message='Staff access required')
            
        # Ensure patient_id exists
        if not User.query.get(data['patient_id']):
            abort(404, message='Patient not found')

        record = MedicalHistory(
            patient_id=data['patient_id'],
            condition=data['condition'],
            diagnosis_date=data.get('diagnosis_date', ''),
            status=data.get('status', 'Active'),
            notes=data.get('notes', '')
        )
        
        db.session.add(record)
        db.session.commit() # DB COMMIT HAPPENS HERE
        return record


@blp.route('/medical-history/<int:record_id>')
class MedicalHistoryItem(MethodView):
    @blp.arguments(MedicalHistoryUpdateSchema)
    @blp.response(200, MedicalHistorySchema)
    @token_required
    def put(current_user, self, data, record_id):
        """Update a medical history record. Staff only."""
        if current_user.user_type != 'staff':
            abort(403, message='Staff access required')

        record = MedicalHistory.query.get(record_id)
        if not record:
            abort(404, message='Record not found')

        if 'condition' in data:
            record.condition = data['condition']
        if 'diagnosis_date' in data:
            record.diagnosis_date = data['diagnosis_date']
        if 'status' in data:
            record.status = data['status']
        if 'notes' in data:
            record.notes = data['notes']

        db.session.commit() # DB COMMIT HAPPENS HERE
        return record

    @blp.response(200, description="Record deleted successfully")
    @token_required
    def delete(current_user, self, record_id):
        """Delete a medical history record. Staff only."""
        if current_user.user_type != 'staff':
            abort(403, message='Staff access required')

        record = MedicalHistory.query.get(record_id)
        if not record:
            abort(404, message='Record not found')

        db.session.delete(record)
        db.session.commit() # DB COMMIT HAPPENS HERE
        return jsonify({'message': 'Record deleted successfully'})
