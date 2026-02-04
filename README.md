# CommonCare

React + Flask + PostgreSQL

You need:
- Docker
- Python 3.11

pip install -r requirements.txt

to run  tests:
python -m pytest tests            
              
## Quick Start (Docker)

**Prerequisites:** Docker

```bash
# Linux/macOS
./start.sh

# Windows
start.bat
```

App runs at **http://localhost:8080**

## Stop

```bash
docker compose down
```

## Stack

- **Frontend:** React (Vite) → port 8080
- **Backend:** Flask → port 5000
- **Database:** PostgreSQL → port 5432

## No Docker Setup

### Prerequisites

- Python 3.11
- Node.js (LTS recommended)
- PostgreSQL 15+

### 1) Create the database

Create a local Postgres database and user that match the default connection string.

- DB name: `commoncare`
- User: `postgres`
- Password: `postgres`
- Port: `5432`

If you prefer different credentials, set `DATABASE_URL` (see below).

### 2) Backend (Flask)

From the repo root:

```bash
pip install -r requirements.txt
```

Set environment variables (PowerShell example):

```powershell
$env:DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5432/commoncare"
$env:SECRET_KEY="dev-secret-key-change-in-production"
```

Start the backend (runs on **http://localhost:5000**):

```bash
python backend/run.py
```

### 3) Frontend (Vite)

In a second terminal:

```bash
npm install --prefix frontend
npm run dev --prefix frontend
```

Vite will print the dev URL (commonly **http://localhost:5173**).

### 4) Running tests

From the repo root:

```bash
python -m pytest tests
```
