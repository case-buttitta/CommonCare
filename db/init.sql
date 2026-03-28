-- ============================================================================
-- CommonCare Database Schema & Seed Data
-- Mirrors backend/app/models.py exactly
-- ============================================================================

-- ── Users ───────────────────────────────────────────────────────────────────
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

-- ── Appointments ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_date TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    reason VARCHAR(500),
    notes TEXT,
    treatments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Biomarker Readings ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biomarker_readings (
    id SERIAL PRIMARY KEY,
    appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    biomarker_type VARCHAR(50) NOT NULL,
    value FLOAT NOT NULL,
    unit VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Medical History ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_history (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    condition VARCHAR(200) NOT NULL,
    diagnosis_date VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Conversations ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    staff_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_conversation_pair UNIQUE (patient_id, staff_id)
);

-- ── Messages ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    reference_type VARCHAR(30),
    reference_id INTEGER,
    image_url VARCHAR(500),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Message Reactions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_reactions (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_reaction UNIQUE (message_id, user_id, emoji)
);

-- ── Message Requests ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_requests (
    id SERIAL PRIMARY KEY,
    from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    message VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Normal Ranges ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS normal_ranges (
    id SERIAL PRIMARY KEY,
    biomarker_type VARCHAR(100) NOT NULL,
    min_value FLOAT NOT NULL,
    max_value FLOAT NOT NULL,
    unit VARCHAR(20) NOT NULL
);

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- ── Normal Ranges (medically accurate defaults) ─────────────────────────────
INSERT INTO normal_ranges (biomarker_type, min_value, max_value, unit) VALUES
    ('blood_pressure_systolic',   90,    120,   'mmHg'),
    ('blood_pressure_diastolic',  60,    80,    'mmHg'),
    ('heart_rate',                60,    100,   'bpm'),
    ('cholesterol_total',         125,   200,   'mg/dL'),
    ('blood_sugar',               70,    100,   'mg/dL'),
    ('vitamin_d',                 30,    100,   'ng/mL'),
    ('bmi',                       18.5,  24.9,  'kg/m²'),
    ('hba1c',                     4.0,   5.6,   '%'),
    ('kidney_function_egfr',      90,    120,   'mL/min'),
    ('liver_enzymes_alt',         7,     56,    'U/L'),
    ('calcium',                   8.5,   10.5,  'mg/dL'),
    ('hemoglobin',                12.0,  17.5,  'g/dL'),
    ('oxygen_saturation',         95,    100,   '%'),
    ('temperature',               97.0,  99.0,  '°F'),
    ('respiratory_rate',          12,    20,    'breaths/min'),
    ('triglycerides',             0,     150,   'mg/dL'),
    ('cholesterol_ldl',           0,     100,   'mg/dL'),
    ('cholesterol_hdl',           40,    60,    'mg/dL'),
    ('weight',                    50,    120,   'kg'),
    ('height',                    150,   200,   'cm');

-- ── Users ───────────────────────────────────────────────────────────────────
-- NOTE: Password hashes are for 'password123' generated by werkzeug.
-- The backend auto-seeds via __init__.py on startup if the DB is empty,
-- so this SQL seed is a fallback / reference. The backend seed is authoritative.

-- The actual password hashing is handled by Python (werkzeug), so we leave
-- user seeding to the Flask app's _seed_if_needed() on first boot.
-- The schema above is the important part for the Docker Postgres init.
