from flask import Blueprint, jsonify, request
import subprocess
import os
from app import db
from app.models import User

main = Blueprint('main', __name__)


@main.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'API is running'})


@main.route('/api/users', methods=['GET'])
def get_users():
    users = User.query.all()
    return jsonify([user.to_dict() for user in users])


@main.route('/api/users', methods=['POST'])
def create_user():
    data = request.get_json()

    if not data or not data.get('username') or not data.get('email'):
        return jsonify({'error': 'Username and email are required'}), 400

    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already exists'}), 400

    role = data.get('role', 'patient')
    if role not in ['patient', 'staff']:
        return jsonify({'error': 'Role must be either patient or staff'}), 400

    user = User(username=data['username'], email=data['email'], role=role)
    db.session.add(user)
    db.session.commit()

    return jsonify(user.to_dict()), 201


@main.route('/api/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict())


@main.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'User deleted successfully'})


@main.route('/api/db/export', methods=['POST'])
def export_db():
    try:
        users = User.query.all()
        
        sql_content = """-- Initialize CommonCare test database

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(80) UNIQUE NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'staff')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed test data
"""
        if users:
            sql_content += "INSERT INTO users (username, email, role) VALUES\n"
            user_values = []
            for user in users:
                user_values.append(f"    ('{user.username}', '{user.email}', '{user.role}')")
            sql_content += ",\n".join(user_values)
            sql_content += "\nON CONFLICT DO NOTHING;\n"
        
        db_path = os.environ.get('DB_EXPORT_PATH', '/db/init.sql')
        with open(db_path, 'w') as f:
            f.write(sql_content)
        
        return jsonify({'message': 'Database exported successfully', 'path': db_path})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
