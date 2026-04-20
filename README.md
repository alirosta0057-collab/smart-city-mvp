# Smart City MVP

A virtual smart-city platform that connects citizens with nearby businesses and a layered support system (autonomous AI bot + human agents).

## Features

- **3 user roles**: `admin`, `citizen`, `agent` — with JWT-based auth and RBAC.
- **Business directory**: categorized local businesses with geo search by citizen location.
- **IP-based geolocation**: automatic location detection on login (fallback to manual pick).
- **SOS / ticketing**: citizens open a ticket; the system routes it to the nearest available agent.
- **Autonomous bot first, human fallback**: a pluggable agent (rule-based by default, LLM-ready) tries to resolve the ticket; if it can't, the ticket is escalated to a human agent in the queue.
- **Real-time chat**: WebSocket-based live chat between citizen, bot, and agent.
- **Admin panel**: user management, category CRUD, analytics.

## Stack

- **Backend**: FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL, Redis, WebSockets, Pydantic v2.
- **Frontend**: Next.js 14 (App Router), TypeScript, TailwindCSS.
- **Infra**: Docker Compose for local dev; ready for any container host.

## Architecture

```
┌────────────┐      ┌─────────────────────┐       ┌──────────────┐
│  Next.js   │◄────►│  FastAPI + WS       │◄─────►│  PostgreSQL  │
│ (citizen / │ HTTP │  - auth / RBAC       │       │  (users,     │
│  agent /   │  +   │  - businesses        │       │   tickets,   │
│  admin)    │ WS   │  - tickets / SOS     │       │   messages)  │
└────────────┘      │  - nearest-agent     │       └──────────────┘
                    │  - bot agent         │
                    │  - WS chat hub       │──┐
                    └─────────────────────┘  │
                                             ▼
                                       ┌──────────┐
                                       │  Redis   │
                                       │ (queue,  │
                                       │  pubsub) │
                                       └──────────┘
```

### Ticket lifecycle

```
citizen.sos()
  └─► POST /api/tickets        (status = OPEN, assigned_bot)
       └─► bot attempts N tool-calls
             ├── resolved  → status = RESOLVED
             └── escalated → status = QUEUED
                  └─► nearest online agent picks up → status = IN_PROGRESS
                       └─► agent resolves → status = RESOLVED
```

## Quick start (local dev)

```bash
docker compose up --build
# seed demo data
docker compose exec backend python -m app.seed
```

- Frontend: http://localhost:3000
- Backend (OpenAPI): http://localhost:8000/docs

### Demo accounts (after seed)

| Role    | Email                   | Password |
| ------- | ----------------------- | -------- |
| admin   | admin@smartcity.example   | admin123 |
| citizen | citizen@smartcity.example | pass123  |
| agent   | agent@smartcity.example   | pass123  |

## Environment variables

See `.env.example` at the repo root.

## License

MIT
