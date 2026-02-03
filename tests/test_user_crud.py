import pytest
import requests
import time
import re
import os


class TestUserCRUD:
    """Test suite for user CRUD operations including API, SQL file, and UI verification."""

    def test_add_user_via_api(self, api_base_url, sample_user_data):
        """Test adding a user through the API."""
        response = requests.post(
            f"{api_base_url}/api/users",
            json=sample_user_data
        )
        assert response.status_code == 201
        data = response.json()
        assert data['username'] == sample_user_data['username']
        assert data['email'] == sample_user_data['email']
        assert data['role'] == sample_user_data['role']
        assert 'id' in data
        return data['id']

    def test_get_user_via_api(self, api_base_url, sample_user_data):
        """Test retrieving users through the API."""
        response = requests.get(f"{api_base_url}/api/users")
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)

    def test_user_appears_in_sql_after_export(self, api_base_url, db_sql_path, sample_user_data):
        """Test that after adding a user and exporting, it appears in the SQL file."""
        create_response = requests.post(
            f"{api_base_url}/api/users",
            json={
                'username': 'sql_test_user',
                'email': 'sql_test@example.com',
                'role': 'staff'
            }
        )
        assert create_response.status_code == 201
        user_id = create_response.json()['id']

        export_response = requests.post(f"{api_base_url}/api/db/export")
        assert export_response.status_code == 200

        time.sleep(0.5)

        with open(db_sql_path, 'r') as f:
            sql_content = f.read()

        assert 'sql_test_user' in sql_content
        assert 'sql_test@example.com' in sql_content
        assert 'staff' in sql_content

        requests.delete(f"{api_base_url}/api/users/{user_id}")

    def test_delete_user_via_api(self, api_base_url):
        """Test deleting a user through the API."""
        create_response = requests.post(
            f"{api_base_url}/api/users",
            json={
                'username': 'delete_test_user',
                'email': 'delete_test@example.com',
                'role': 'patient'
            }
        )
        assert create_response.status_code == 201
        user_id = create_response.json()['id']

        delete_response = requests.delete(f"{api_base_url}/api/users/{user_id}")
        assert delete_response.status_code == 200

        get_response = requests.get(f"{api_base_url}/api/users/{user_id}")
        assert get_response.status_code == 404

    def test_deleted_user_removed_from_sql_after_export(self, api_base_url, db_sql_path):
        """Test that after deleting a user and exporting, it is removed from the SQL file."""
        create_response = requests.post(
            f"{api_base_url}/api/users",
            json={
                'username': 'remove_sql_test',
                'email': 'remove_sql@example.com',
                'role': 'patient'
            }
        )
        assert create_response.status_code == 201
        user_id = create_response.json()['id']

        export_response = requests.post(f"{api_base_url}/api/db/export")
        assert export_response.status_code == 200
        time.sleep(0.5)

        with open(db_sql_path, 'r') as f:
            sql_content = f.read()
        assert 'remove_sql_test' in sql_content

        delete_response = requests.delete(f"{api_base_url}/api/users/{user_id}")
        assert delete_response.status_code == 200

        export_response = requests.post(f"{api_base_url}/api/db/export")
        assert export_response.status_code == 200
        time.sleep(0.5)

        with open(db_sql_path, 'r') as f:
            sql_content = f.read()
        assert 'remove_sql_test' not in sql_content

    def test_user_role_validation(self, api_base_url):
        """Test that invalid roles are rejected."""
        response = requests.post(
            f"{api_base_url}/api/users",
            json={
                'username': 'invalid_role_user',
                'email': 'invalid_role@example.com',
                'role': 'invalid_role'
            }
        )
        assert response.status_code == 400
        assert 'error' in response.json()

    def test_duplicate_username_rejected(self, api_base_url):
        """Test that duplicate usernames are rejected."""
        user_data = {
            'username': 'dup_username_test',
            'email': 'dup1@example.com',
            'role': 'patient'
        }
        response1 = requests.post(f"{api_base_url}/api/users", json=user_data)
        if response1.status_code == 201:
            user_id = response1.json()['id']

            user_data['email'] = 'dup2@example.com'
            response2 = requests.post(f"{api_base_url}/api/users", json=user_data)
            assert response2.status_code == 400

            requests.delete(f"{api_base_url}/api/users/{user_id}")

    def test_duplicate_email_rejected(self, api_base_url):
        """Test that duplicate emails are rejected."""
        user_data = {
            'username': 'dup_email_test1',
            'email': 'dup_email@example.com',
            'role': 'staff'
        }
        response1 = requests.post(f"{api_base_url}/api/users", json=user_data)
        if response1.status_code == 201:
            user_id = response1.json()['id']

            user_data['username'] = 'dup_email_test2'
            response2 = requests.post(f"{api_base_url}/api/users", json=user_data)
            assert response2.status_code == 400

            requests.delete(f"{api_base_url}/api/users/{user_id}")

    def test_health_endpoint(self, api_base_url):
        """Test the health check endpoint."""
        response = requests.get(f"{api_base_url}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'healthy'
