# CommonCare

A healthcare management web application that connects patients with medical staff. Patients can book appointments and track their health over time; staff can record biomarker readings, manage medical histories, and monitor patient trends.

**Stack:** React + Vite · Flask · PostgreSQL (Aiven Cloud)

---

## Features

### Patient
- Book appointments with available staff members
- View pending and completed appointments
- Track biomarker readings (blood pressure) with trend charts
- Review personal medical history

### Staff
- View and search all patients
- Complete appointments by recording blood pressure readings and notes
- Add, edit, and delete medical history records per patient
- View per-patient health trend charts and biomarker history

### General
- JWT-based authentication with patient/staff role separation
- Account deletion
- Error boundaries for graceful UI failure handling

---

## Quick Start (Docker)

The easiest way to run the full stack locally.

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/) with the Compose plugin

```bash
# Clone the repo, then from the project root:

# Linux / macOS
./start.sh

# Windows
start.bat
```

The dev server starts at **http://localhost:5173**

To stop all containers:

```bash
docker compose down
```

### What Docker runs

| Service  | Port  | Description                   |
|----------|-------|-------------------------------|
| frontend | 5173  | Vite dev server (HMR enabled) |
| backend  | 5000  | Flask API                     |

The database is hosted on Aiven Cloud — no local Postgres container is needed.

---

## Manual Setup (No Docker)

Use this if you prefer to run services directly on your machine.

### Prerequisites

- Python 3.11
- Node.js (LTS)
- PostgreSQL 15+ (only needed if running a local DB instead of the cloud one)

### 1. Environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

The two required variables are:

| Variable       | Description                            | Default (local DB)                                             |
|----------------|----------------------------------------|----------------------------------------------------------------|
| `DATABASE_URL` | PostgreSQL connection string           | `postgresql+psycopg://postgres:postgres@localhost:5432/commoncare` |
| `SECRET_KEY`   | Flask secret key for JWT signing       | Any random string works for development                        |

> The repo's `.env` is pre-configured to use the shared Aiven Cloud database. You can leave it as-is or point `DATABASE_URL` at a local Postgres instance.

### 2. Local database (skip if using Aiven)

If you want a fully local setup, create a Postgres database:

```sql
CREATE DATABASE commoncare;
```

Then initialise the schema:

```bash
psql -U postgres -d commoncare -f db/init.sql
```

### 3. Backend

From the repo root, install Python dependencies and start Flask:

```bash
pip install -r backend/requirements.txt
python backend/run.py
```

The API runs at **http://localhost:5000**

**Linux / macOS alternative** — export vars inline:
```bash
DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5432/commoncare" \
SECRET_KEY="dev-secret-key" \
python backend/run.py
```

**Windows (PowerShell) alternative:**
```powershell
$env:DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5432/commoncare"
$env:SECRET_KEY="dev-secret-key"
python backend/run.py
```

### 4. Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite starts at **http://localhost:5173**

### 5. Running tests

From the repo root:

```bash
python -m pytest tests
```

---

## Project Structure

```
ITSC4155_Project/
├── backend/
│   ├── app/
│   │   ├── __init__.py       # App factory
│   │   ├── auth.py           # JWT helpers & auth routes
│   │   ├── models.py         # SQLAlchemy models
│   │   └── routes.py         # API endpoints
│   ├── config.py
│   ├── run.py                # Entry point
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── AuthContext.jsx   # Auth state (Context API)
│   │   ├── Login.jsx
│   │   ├── Signup.jsx
│   │   ├── PatientDashboard.jsx
│   │   ├── StaffDashboard.jsx
│   │   └── components/
│   │       ├── BiomarkerChart.jsx
│   │       ├── MedicalHistory.jsx
│   │       └── ConfirmationModal.jsx
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   ├── nginx.conf            # Used in production builds
│   └── vite.config.js
├── db/
│   └── init.sql              # Schema + seed data
├── docker-compose.yml
├── .env.example
├── start.sh                  # Linux/macOS Docker launcher
└── start.bat                 # Windows Docker launcher
```

---

## API Overview

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/health` | Health check | — |
| POST | `/api/auth/signup` | Register | — |
| POST | `/api/auth/login` | Login | — |
| GET | `/api/auth/me` | Current user | Required |
| DELETE | `/api/auth/account` | Delete account | Required |
| GET | `/api/staff` | List all staff | Required |
| GET | `/api/patients` | List all patients | Staff only |
| GET | `/api/appointments` | List appointments | Required |
| POST | `/api/appointments` | Book appointment | Patient only |
| PUT | `/api/appointments/<id>` | Complete appointment + record readings | Staff only |
| GET | `/api/patients/<id>/biomarkers` | Biomarker history | Required |
| GET | `/api/patients/<id>/history` | Medical history | Required |
| POST | `/api/patients/<id>/history` | Add history record | Staff only |
| PUT | `/api/history/<id>` | Update history record | Staff only |
| DELETE | `/api/history/<id>` | Delete history record | Staff only |

---

## Test Accounts

The shared cloud database includes seeded test accounts:

| Role    | Email               | Password    |
|---------|---------------------|-------------|
| Patient | patient@test.com    | password123 |
| Staff   | doctor@test.com     | password123 |
