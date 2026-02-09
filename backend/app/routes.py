from flask import Blueprint, jsonify, request
from app import db
from app.models import User
from app.auth import generate_token, token_required

main = Blueprint('main', __name__)


@main.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'API is running'})


@main.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.get_json()

    # Validate required fields
    required_fields = ['email', 'password', 'full_name', 'user_type']
    for field in required_fields:
        if not data or not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    # Validate user_type
    if data['user_type'] not in ['patient', 'staff']:
        return jsonify({'error': 'user_type must be either patient or staff'}), 400

    # Check if email already exists
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 400

    # Validate password length
    if len(data['password']) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    # Create new user
    user = User(
        email=data['email'],
        full_name=data['full_name'],
        address=data.get('address', ''),
        location=data.get('location', 'Charlotte'),
        user_type=data['user_type']
    )
    user.set_password(data['password'])

    db.session.add(user)
    db.session.commit()

    token = generate_token(user.id)

    return jsonify({
        'message': 'Account created successfully',
        'token': token,
        'user': user.to_dict()
    }), 201


@main.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()

    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password are required'}), 400

    user = User.query.filter_by(email=data['email']).first()

    if not user or not user.check_password(data['password']):
        return jsonify({'error': 'Invalid email or password'}), 401

    token = generate_token(user.id)

    return jsonify({
        'message': 'Login successful',
        'token': token,
        'user': user.to_dict()
    })


@main.route('/api/auth/me', methods=['GET'])
@token_required
def get_current_user(current_user):
    return jsonify(current_user.to_dict())


@main.route('/api/auth/account', methods=['DELETE'])
@token_required
def delete_account(current_user):
    db.session.delete(current_user)
    db.session.commit()
    return jsonify({'message': 'Account deleted successfully'})
