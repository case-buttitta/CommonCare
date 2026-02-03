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
