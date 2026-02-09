-- Initialize CommonCare database

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(256) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    address VARCHAR(200),
    location VARCHAR(50) NOT NULL DEFAULT 'Charlotte',
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('patient', 'staff')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
