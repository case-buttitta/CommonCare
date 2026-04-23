from marshmallow import Schema, fields, validate

class MedicalHistorySchema(Schema):
    id = fields.Int(dump_only=True)
    patient_id = fields.Int(required=True)
    condition = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    diagnosis_date = fields.Str(validate=validate.Length(max=100), allow_none=True)
    status = fields.Str(validate=validate.Length(max=50), load_default="Active", allow_none=True)
    notes = fields.Str(allow_none=True)
    created_at = fields.DateTime(dump_only=True)

class MedicalHistoryUpdateSchema(Schema):
    condition = fields.Str(validate=validate.Length(min=1, max=200))
    diagnosis_date = fields.Str(validate=validate.Length(max=100), allow_none=True)
    status = fields.Str(validate=validate.Length(max=50), allow_none=True)
    notes = fields.Str(allow_none=True)

class UserSchema(Schema):
    id = fields.Int(dump_only=True)
    email = fields.Str()
    full_name = fields.Str()
    user_type = fields.Str()
    location_id = fields.Int()

class UserQueryArgsSchema(Schema):
    location_id = fields.Int(required=True, description="Filter users by location ID")
    user_type = fields.Str(required=False, description="Filter by user type (e.g. staff, patient)")
