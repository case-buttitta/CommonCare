-- Initialize CommonCare test database

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(80) UNIQUE NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'staff')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed test data
INSERT INTO users (username, email, role) VALUES
    ('john_doe', 'john.doe@example.com', 'patient'),
    ('jane_smith', 'jane.smith@example.com', 'staff'),
    ('bob_wilson', 'bob.wilson@example.com', 'patient'),
    ('alice_johnson', 'alice.johnson@example.com', 'staff'),
    ('charlie_brown', 'charlie.brown@example.com', 'patient'),
    ('test', 'test@gmail.com', 'staff'),
    ('test_user_pytest', 'test_pytest@example.com', 'patient')
ON CONFLICT DO NOTHING;
