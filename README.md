# CommonCare

A healthcare management web application that connects patients with medical staff. Patients can book appointments and track their health over time; staff can record biomarker readings, manage medical histories, and monitor patient trends.

**Stack:** React + Vite · Flask · PostgreSQL

**Live App:** [https://case-buttitta.github.io/CommonCare/](https://case-buttitta.github.io/CommonCare/)

---

## Architecture

| Component | Provider | URL |
|-----------|----------|-----|
| Frontend  | GitHub Pages | [case-buttitta.github.io/CommonCare](https://case-buttitta.github.io/CommonCare/) |
| Backend   | Railway      | [backend-production-3564d.up.railway.app](https://backend-production-3564d.up.railway.app) |
| Database  | Aiven        | Managed PostgreSQL 15 with SSL |

- The **frontend** is a static React build deployed to GitHub Pages on every push to `main`.
- The **backend** is a Flask API running on Railway via Docker (gunicorn).
- The **database** is hosted on Aiven Cloud — there is no local database.

The frontend calls the Railway backend directly using the `VITE_API_URL` environment variable, which is set at build time in the GitHub Actions workflow.

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

## Local Development

The entire local development environment including the database, backend, and frontend is fully containerized. There is no need to install Node/Python locally or decrypt cloud secrets for local development.

### 1. Start all services

```bash
docker compose up --build
```
*(The local database will be automatically seeded with users and historical data on its first boot!)*

### 2. Access the apps

- **Frontend:** [http://localhost:5174](http://localhost:5174) *(Hot-reloads automatically when you edit React files!)*
- **Backend API:** [http://localhost:5001](http://localhost:5001)

### 3. Stop services

```bash
docker compose down
```

> **Note:** If you ever need to completely wipe your local database and let it re-seed from scratch, use `docker compose down -v` to delete the volume before starting it up again.

---

## Deployment

### GitHub Pages (Frontend)

The frontend auto-deploys on every push to `main` via `.github/workflows/deploy.yml`. The workflow sets `VITE_API_URL` to the Railway backend URL at build time.

**One-time setup (repo owner):**

1. Go to the repo on GitHub → **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. Push to `main` — deploys automatically

### Railway (Backend)

The backend deploys from the `backend/` directory using its `Dockerfile`. Railway builds and runs the container automatically.

**Environment variables to set in Railway dashboard:**

| Variable       | Value |
|----------------|-------|
| `DATABASE_URL` | `check manage_secrets` |
| `SECRET_KEY`   | Any random string for JWT signing |

> The backend auto-converts `postgres://` to `postgresql+psycopg://` for SQLAlchemy compatibility.

### Aiven (Database)

The PostgreSQL database is hosted on Aiven Cloud. The connection string is stored encrypted in `secrets.enc` and set as `DATABASE_URL` on Railway.

---

## Running Tests

```bash
python -m pytest tests
```

---

## Project Structure

```
CommonCare/
├── backend/
│   ├── app/
│   │   ├── __init__.py       # App factory, CORS config
│   │   ├── auth.py           # JWT helpers & auth routes
│   │   ├── models.py         # SQLAlchemy models
│   │   └── routes.py         # API endpoints
│   ├── config.py             # DB URL auto-fix, app config
│   ├── run.py                # Dev entry point
│   ├── seed_cloud_db.py      # Seed script for Aiven DB
│   ├── requirements.txt
│   └── Dockerfile            # Production build (gunicorn)
├── frontend/
│   ├── src/
│   │   ├── api.js            # API helper (prepends VITE_API_URL)
│   │   ├── App.jsx
│   │   ├── AuthContext.jsx
│   │   ├── Login.jsx
│   │   ├── Signup.jsx
│   │   ├── PatientDashboard.jsx
│   │   ├── StaffDashboard.jsx
│   │   └── components/
│   └── vite.config.js
├── db/
│   └── init.sql              # Reference schema
├── .github/
│   └── workflows/
│       └── deploy.yml        # GitHub Pages deploy (sets VITE_API_URL)
├── docker-compose.yml        # Local backend dev only
├── manage_secrets.py         # Encrypt/decrypt .env secrets
├── secrets.enc               # Encrypted environment variables
└── pytest.ini
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

The local development database (and cloud database) automatically seeds the following test accounts:

| Role    | Email               | Password    |
|---------|---------------------|-------------|
| Patient | patient@test.com    | password123 |
| Staff   | doctor@test.com     | password123 |
