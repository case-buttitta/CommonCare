"""Tests for GET /api/health — no auth required."""


class TestHealthCheck:
    def test_returns_200(self, client):
        res = client.get('/api/health')
        assert res.status_code == 200

    def test_returns_healthy_status(self, client):
        data = client.get('/api/health').get_json()
        assert data['status'] == 'healthy'

    def test_returns_message(self, client):
        data = client.get('/api/health').get_json()
        assert 'message' in data

    def test_no_auth_required(self, client):
        """Health endpoint must be reachable without a token."""
        res = client.get('/api/health')
        assert res.status_code != 401
