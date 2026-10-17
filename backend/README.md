# Aisle Backend - Agentic AI Checkout

A Python backend using FastAPI and Microsoft AutoGen for the Aisle AI-powered shopping assistant.

## Architecture

### Agents (AutoGen)

The system uses multiple specialized agents that work together:

1. **Orchestrator Agent** - Coordinates the entire shopping workflow
2. **Shopping Agent** - Searches for products across multiple merchants
3. **Comparison Agent** - Compares prices across stores
4. **Rules Agent** - Enforces spending rules and guardrails
5. **Checkout Agent** - Handles secure checkout with virtual cards

### Flow

```
User Task → Orchestrator → Shopping Agent → Comparison Agent → Rules Agent → (Approval if needed) → Checkout Agent → Order
```

## Setup

### Prerequisites

- Python 3.10+
- pip

### Installation

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Configuration

Copy `.env.example` to `.env` for local development and set a replacement AI
provider key if you use agent features. Do not reuse provider keys that were
shared in chat; revoke those keys. Do not commit `.env`.

The backend uses Azure OpenAI when fully configured, then Groq when
`GROQ_API_KEY` is set, then Google AI Studio when `GOOGLE_API_KEY` is set.
Login and other non-AI APIs can start without an AI key; agent requests require
one.

### Running

```bash
python main.py
```

The API will be available at:
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Production deployment

Deploy the Next.js frontend and FastAPI backend as separate services. Configure
these variables in the backend host's secret/environment settings:

- `ENVIRONMENT=production`
- `DEBUG=false`
- `SECRET_KEY`: a unique random value of at least 32 characters
- `DATABASE_URL`: the Neon PostgreSQL connection string (the backend adapts
  `postgresql://` URLs for its async driver)
- `CORS_ORIGINS`: a JSON array containing only the deployed HTTPS frontend
  origin, for example `["https://shop.example.com"]`
- One AI provider key if agent endpoints will be used

Set `NEXT_PUBLIC_BACKEND_URL` in the frontend deployment to the public HTTPS
backend origin. This is a browser-visible URL, not a secret. The frontend now
uses it consistently for backend calls.

For production, run migrations as the backend service's release/pre-deploy
command:

```powershell
python -m alembic upgrade head
```

The production app does not create or alter tables at startup. Back up the
SQLite database before migration. To copy existing SQLite rows to an **empty**
Neon database, configure the Neon `DATABASE_URL`, run the migration above, then
run this once from `backend`:

```powershell
python migrate_sqlite_to_postgres.py --source .\aisle.db
```

The migration refuses to write into non-empty application tables, checks row
counts, and leaves the SQLite source unchanged. Keep the SQLite file as a
backup until the Neon data has been verified.

### Merchant analytics demo

The merchant dashboard is tied to the authenticated account, not a public
merchant selector. To create the Starbucks demo merchant and its login, set
`DEMO_MERCHANT_EMAIL` to a dedicated, unused merchant email and
`DEMO_MERCHANT_PASSWORD` to a private password of 12-72 UTF-8 bytes in the
backend environment. Then run:

```powershell
python -m alembic upgrade head
python seed_merchant_demo.py
```

This creates one merchant account with 780 clearly marked synthetic orders
covering the previous year and 260 synthetic reviews. Demo sales/reviews are
stored separately from customer order history. The seed is idempotent and
refuses to overwrite a non-demo merchant or partially seeded dataset. To load
the analytics without creating a merchant login yet, use
`python seed_merchant_demo.py --data-only`; rerun without that flag after
setting the dedicated login values to attach the account without duplicating
the sample data. Never use a customer's login as the merchant account.

Merchant sign-in is available at `/merchant/login`; customer sign-in remains
at `/login`. A customer account cannot access merchant analytics. The merchant AI review coach and today's sales outlook use Gemini via
`GOOGLE_API_KEY` and `GOOGLE_MODEL`. Review suggestions are grounded in
low-rated reviews, order and cancellation metrics, and top-selling products.
The outlook compares today's weekday and remaining hours with up to one year
of historical orders in the merchant's local time zone, then asks Gemini to
explain the strongest item trends and a practical preparation step. If Gemini
is unavailable or quota-limited, both AI panels show a clearly labeled
evidence-based fallback instead of failing. The dashboard's seeded historical
analytics are synthetic presentation data and must not be presented as real
customer activity.

Run the backend with the host's assigned port and without reload mode, for
example `uvicorn main:app --host 0.0.0.0 --port 8000` (configure the actual
port variable in the hosting provider's start command).

Checkout is prototype-only: every selected payment option places the order
directly without opening a payment gateway or collecting payment details.
Orders are recorded in customer history and merchant analytics with payment
marked as not collected. Non-onboarded merchants cannot accept checkout orders.

Before inviting real users, configure host-level/API rate limiting for
authentication and AI endpoints, move browser authentication tokens from
`localStorage` to a secure `HttpOnly`, `Secure`, `SameSite` cookie flow, and
rotate any provider keys that were previously exposed. Store replacement keys
only in private local environment files or the hosting provider's secret
manager; never commit them.

## API Endpoints

### Authentication
- `POST /auth/signup` - Create account
- `POST /auth/login` - Login (form)
- `POST /auth/login/json` - Login (JSON)
- `GET /auth/me` - Get current user
- `PUT /auth/me` - Update profile

### Customer checkout
- `POST /payments/checkout` - Create a server-priced prototype order without collecting payment details; accepts optional `cookingInstructions`
- `POST /payments/reviews` - Submit one 1–5 star review for an order owned by the signed-in customer
- Cooking instructions are saved with the customer and merchant order records and shown in the merchant's recent-orders view.
- Customer reviews are linked to the order's merchant and appear in the merchant dashboard's customer reviews list.

### Agent
- `POST /agent/task` - Disabled (`503`) until real checkout is implemented
- `GET /agent/tasks` - List tasks
- `GET /agent/tasks/{id}` - Get task details
- `GET /agent/feed` - Get activity feed
- `PUT /agent/pause` - Pause agent
- `PUT /agent/resume` - Resume agent

### Orders
- `GET /orders` - List the signed-in customer's persisted orders
- `GET /orders/{id}` - Get order details, saved cooking instructions, and any submitted review
- `GET /orders/stats` - Get statistics

### Approvals
- `GET /approvals` - List pending approvals
- `GET /approvals/count` - Get pending count
- `POST /approvals/{id}/approve` - Disabled (`503`) until real checkout is implemented
- `POST /approvals/{id}/decline` - Decline purchase

### Wallet
- `GET /wallet/cards` - List virtual cards
- `POST /wallet/cards` - Create card
- `PUT /wallet/cards/{id}/pause` - Pause card
- `PUT /wallet/cards/{id}/resume` - Resume card
- `DELETE /wallet/cards/{id}` - Destroy card
- `GET /wallet/transactions` - List transactions
- `GET /wallet/balance` - Get balance

### Rules
- `GET /rules` - Get spending rules
- `PUT /rules` - Update rules

### Dashboard
- `GET /dashboard/overview` - Get full dashboard data
- `GET /dashboard/stats` - Get statistics
- `GET /dashboard/feed` - Get activity feed

## Database

Uses SQLite for simplicity. Database file: `aisle.db`

Tables:
- `users` - User accounts
- `orders` - Purchase orders
- `approvals` - Pending approvals
- `virtual_cards` - Virtual card records
- `transactions` - Transaction history
- `agent_runs` - Agent task executions
- `spending_rules` - User spending rules
- `feed_events` - Activity feed events

## Agent Workflow

### Shopping Task Example

When a user submits "order my usual protein bars":

1. **Shopping Agent** extracts keywords and searches product database
2. **Comparison Agent** compares prices across merchants (Amazon, Flipkart, HealthKart, etc.)
3. **Rules Agent** checks against user's spending rules
4. If amount > approval threshold or other rules violated → **Creates Approval**
5. If rules pass → **Checkout Agent** generates virtual card and places order
6. Order confirmation and card destruction

### Spending Rules

- Monthly budget limits
- Category-specific limits (Groceries, Electronics, etc.)
- Approval thresholds (e.g., require approval above $50)
- Merchant whitelist/blacklist
- International transaction blocking

## Security

- JWT authentication
- Single-use virtual cards for payments
- Password hashing with bcrypt
- All purchases logged in immutable ledger

## Development

### Project Structure

```
backend/
├── main.py                 # FastAPI app
├── config.py               # Configuration
├── agents/                 # AutoGen agents
│   ├── orchestrator.py     # Main coordinator
│   ├── shopping_agent.py   # Product search
│   ├── comparison_agent.py # Price comparison
│   ├── rules_agent.py      # Rules enforcement
│   └── checkout_agent.py   # Checkout handler
├── routers/                # API routes
│   ├── auth.py
│   ├── agent.py
│   ├── orders.py
│   ├── approvals.py
│   ├── wallet.py
│   ├── rules.py
│   └── dashboard.py
├── services/               # Business logic
│   ├── auth_service.py
│   ├── agent_service.py
│   └── order_service.py
├── models/                 # Pydantic models
├── database/               # SQLAlchemy models
└── requirements.txt
```
