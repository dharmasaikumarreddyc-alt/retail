# Aisle — Agentic AI Checkout

A food-ordering prototype with a Next.js customer and merchant experience and a
FastAPI backend for authentication, orders, merchant analytics, and AI features.

## Project layout

```text
retail/
├── app/                  # Next.js frontend and frontend API routes
├── backend/              # FastAPI backend
│   ├── .env.example      # Safe template for local backend configuration
│   └── requirements.txt  # Python dependencies
├── package.json          # Frontend scripts and dependencies
└── package-lock.json     # Locked frontend dependency versions
```

## Prerequisites

- **Node.js 20.9 or newer** and npm, for the frontend.
- **Python 3.10 or newer** and pip, for the backend.
- An AI provider API key only if you want to use AI-powered backend features.

Check the installed tools in PowerShell:

```powershell
node --version
npm --version
python --version
```

## Install dependencies

Use two PowerShell terminals, or complete both installs in one terminal.

### Frontend — project root

From the `retail` directory (the directory containing `package.json`):

```powershell
npm ci
```

This installs the locked Next.js, React, TypeScript, Tailwind CSS, and ESLint
dependencies into the root `node_modules` directory.

### Backend — `backend` directory

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

The virtual environment and Python packages are kept under `backend\venv`.
If PowerShell blocks virtual-environment activation, either allow scripts for
your current PowerShell session:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
```

Or skip activation and use the virtual-environment Python executable directly:

```powershell
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe main.py
```

## Configure the backend

In the `backend` directory, copy the example configuration:

```powershell
Copy-Item .env.example .env
```

Open `backend\.env` in an editor and set a unique `SECRET_KEY`. For AI-backed
features, add a key for at least one provider supported by the backend, such as
`GOOGLE_API_KEY` or `GROQ_API_KEY`. The example file lists the supported
variables and default development settings.

Keep API keys and other secrets private. Do not paste them into source files,
commit `.env`, or share them in screenshots. The backend can serve many
non-AI endpoints without a provider key, but AI features need a configured
provider.

For local development, the example configuration uses SQLite at
`backend\aisle.db`, allows the frontend origin at `http://localhost:3000`, and
the backend initializes its development database on startup.

## Run the application

Start the backend first, then the frontend. Keep both terminals open.

### Terminal 1 — backend

From the `retail\backend` directory, with the virtual environment activated:

```powershell
python main.py
```

The API runs at `http://localhost:8000`. Interactive API documentation is at
`http://localhost:8000/docs`, and the health check is
`http://localhost:8000/health`.

### Terminal 2 — frontend

From the `retail` project root:

```powershell
npm run dev
```

Open `http://localhost:3000` in your browser. The frontend uses
`http://localhost:8000` as the default backend URL. If your backend runs
elsewhere, create a root-level `.env.local` containing the public backend URL:

```dotenv
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

Restart the frontend after changing `.env.local`. This URL is exposed to the
browser; never put API keys or other secrets in `NEXT_PUBLIC_*` variables.

To stop either server, press `Ctrl+C` in its terminal.

## Useful commands

Run these frontend commands from the project root:

```powershell
npm run dev       # Start the development frontend
npm run build     # Build the production frontend
npm run start     # Serve a completed production build
npm run lint      # Run ESLint
```

Run backend database migrations from the `backend` directory when needed:

```powershell
python -m alembic upgrade head
```

The development server initializes the local SQLite database automatically.
Production deployment requires running migrations as a separate deployment
step; see [backend/README.md](./backend/README.md) for deployment, database
migration, demo merchant, and API details.

## Checkout behavior

Checkout is prototype-only: selecting a payment method places the order without
connecting to a payment gateway. Orders and customer-provided cooking
instructions are saved for the customer and the merchant. Do not enter real
payment credentials.

## Troubleshooting

- **Frontend cannot reach the backend:** confirm the backend is running at
  `http://localhost:8000`, check `http://localhost:8000/health`, and verify
  `NEXT_PUBLIC_BACKEND_URL` if you changed the backend address.
- **`ModuleNotFoundError` or missing Python package:** activate the backend
  virtual environment and rerun `pip install -r requirements.txt` from
  `backend`.
- **AI feature reports a provider error:** check that the provider key is set
  in `backend\.env`, that the backend was restarted after the change, and that
  the provider account has available quota.
- **Port already in use:** stop the other process using port `3000` or `8000`,
  or configure the relevant development server to use another port.
