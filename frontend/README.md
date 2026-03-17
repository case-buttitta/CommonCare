# CommonCare — Frontend

React + Vite frontend for the CommonCare healthcare management app.

## Tech Stack

- **React 19** with hooks and Context API
- **Vite 7** — dev server with hot module replacement
- **Recharts** — biomarker trend charts
- **ESLint** — code quality

## Structure

```
src/
├── App.jsx                  # Root component & routing logic
├── AuthContext.jsx           # JWT auth state (Context API)
├── Login.jsx                # Login page
├── Signup.jsx               # Registration page
├── PatientDashboard.jsx     # Patient view (appointments, biomarkers, history)
├── StaffDashboard.jsx       # Staff view (patients, appointments)
└── components/
    ├── BiomarkerChart.jsx   # Line chart for health metric history
    ├── MedicalHistory.jsx   # Add / edit / delete medical conditions
    └── ConfirmationModal.jsx
```

## Running Locally

From the `frontend/` directory:

```bash
npm install
npm run dev       # http://localhost:5173
```

Or from the repo root:

```bash
npm install --prefix frontend
npm run dev --prefix frontend
```

The frontend expects the Flask backend running at **http://localhost:5000**. See the root [README](../README.md) for full setup instructions.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

## Authentication

- JWT token stored in `localStorage`
- `AuthContext` provides `user`, `login`, and `logout` to the component tree
- On page load, the app checks `localStorage` for an existing token and restores the session automatically
- Route rendering is determined by `user.user_type` (`patient` or `staff`)

## Environment

The Vite dev server proxies `/api` requests to the backend. This is configured in [vite.config.js](vite.config.js).
