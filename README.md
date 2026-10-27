# ⚡ DevResolve

> **AI-Powered Incident Investigation Engineer for Developers**  
> Diagnoses production errors, performs AST-aware code retrieval, formulates root-cause hypotheses, generates unified diff patches, and validates fixes inside isolated Docker sandboxes.

---

[![CI Pipeline](https://github.com/your-org/devresolve/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/devresolve/actions/workflows/ci.yml)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TS-61DAFB.svg?logo=react)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20pgvector-336791.svg?logo=postgresql)](https://github.com/pgvector/pgvector)
[![Docker](https://img.shields.io/badge/Sandbox-Docker%20Isolated-2496ED.svg?logo=docker)](https://www.docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📖 Table of Contents

- [Overview](#-overview)
- [System Architecture](#-system-architecture)
- [Investigation Workflow](#-investigation-workflow)
- [System Design & Database Principles](#-system-design--database-principles)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Option A: One-Command Docker Compose (Recommended)](#option-a-one-command-docker-compose-recommended)
  - [Option B: Local Development Setup](#option-b-local-development-setup)
- [Configuration & Environment Variables](#-configuration--environment-variables)
- [API Endpoints](#-api-endpoints)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🔍 Overview

When a production incident occurs (e.g., 500 error, database connection exhaustion, latency spike, or failing integration test), developers waste hours correlating stack traces, digging through repository commits, and manually writing regression tests.

**DevResolve** acts as an autonomous tier-1 and tier-2 incident engineer:
1. **Evidence Ingestion:** Accepts error logs, Sentry crash reports, or failing unit test traces.
2. **Hybrid RAG Retrieval:** Parses AST function/class symbols and uses `pgvector` cosine similarity combined with full-text search to locate relevant source files.
3. **Root Cause Analysis (RCA):** Executes multi-step reasoning with leading LLMs (OpenAI GPT-4o, Anthropic Claude 3.5 Sonnet, or Google Gemini 1.5 Pro).
4. **Code Patch Generation:** Produces clean, minimal unified git diffs addressing the root cause without side effects.
5. **Docker Sandbox Validation:** Tests patches inside isolated Linux containers (`--network none`, memory & CPU limits) executing pytest suites to verify fixes before any pull request is opened.
6. **Automated PR & Reporting:** Generates audit-ready incident reports and opens GitHub Pull Requests with a single click.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Client["Client Layer"]
        UI["React 18 + TypeScript + Vite SPA<br/>(Tailwind CSS, Dark Mode, Glassmorphism)"]
    end

    subgraph Gateway["API Gateway Layer"]
        API["FastAPI Backend<br/>(JWT Bearer, Request Tracing, CORS, Audit Logging)"]
    end

    subgraph Storage["Persistence & Search Layer"]
        PG[("PostgreSQL 16 + pgvector<br/>(3NF Normalization + RLS + Triggers)")]
    end

    subgraph Agent["AI Agent Pipeline"]
        STM["7-Phase Investigation State Machine<br/>(Retrieve ➔ Analyze ➔ Inspect ➔ Hypothesize ➔ Fix ➔ Test ➔ Report)"]
        RAG["AST Code Chunking + Hybrid Embeddings"]
        LLM["Inference Engines<br/>(GPT-4o / Claude 3.5 / Gemini Pro)"]
    end

    subgraph Sandbox["Test Execution Sandbox"]
        DOCKER["Docker Micro-Containers<br/>(--network none, 1024MB RAM, pytest)"]
    end

    UI <-->|"REST APIs & SSE Streams"| API
    API <-->|"Async Sessions (asyncpg)"| PG
    API -->|"Dispatches Investigation"| STM
    STM <-->|"Semantic Search"| RAG
    RAG <-->|"pgvector Similarity"| PG
    STM <-->|"Diagnostic Reasoning"| LLM
    STM -->|"Run Verification Suite"| DOCKER
    DOCKER -->|"Validation Report & Diff"| STM
```

---

## ⚡ Investigation Workflow

The agent workflow executes a non-blocking 7-phase state machine that streams real-time Server-Sent Events (SSE) to the frontend:

```
[1. RETRIEVE]    Query pgvector embeddings & AST symbols for error signatures
      │
[2. ANALYZE]     Parse call stack, trace logs, and variable bindings
      │
[3. INSPECT]     Examine code blocks around suspects with AST hierarchy
      │
[4. HYPOTHESIZE] Formulate high-confidence architectural / concurrency root causes
      │
[5. FIX]         Generate unified git diff patch addressing the failure
      │
[6. TEST]        Spin up isolated Docker container (--network none) & run pytest
      │
[7. REPORT]      Emit verified RCA report, test proofs, and one-click GitHub PR
```

---

## 🛡️ System Design & Database Principles

### 1. 3NF Normalization
Core entities (`users`, `organizations`, `projects`, `conversations`, `messages`, `api_keys`) are strictly normalized to Third Normal Form (3NF) to eliminate data redundancy and anomalies:
- Junction tables (`organization_members`) manage M:N tenancy.
- Immutable UUIDv4 primary keys protect against Insecure Direct Object Reference (IDOR) attacks.

### 2. Controlled Denormalization
For read-intensive dashboard and investigation views, specific fields are denormalized and maintained synchronously via high-performance PostgreSQL triggers:
- `projects.incident_count` and `projects.last_activity_at`
- `conversations.message_count` and `conversations.last_message_at`
- `messages.sender_display_name` (eliminates joins on chat stream rendering)

### 3. Row-Level Security (RLS)
PostgreSQL Row-Level Security is enabled across all project and conversation tables:
```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_project_isolation ON projects
    FOR ALL
    USING (organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
    ));
```

### 4. Sandbox Security & Egress Isolation
Code patches are executed with extreme caution:
- `--network none`: Blocks outbound network egress to prevent credential or data exfiltration.
- `--memory 1024m` & `--cpus 1.0`: Prevents Denial-of-Service and memory starvation of the host.
- Read-only root filesystem mounts.

---

## 💻 Tech Stack

### Frontend
- **Framework:** React 18 + TypeScript + Vite
- **Styling:** Vanilla Tailwind CSS with custom glassmorphism design system
- **Routing:** React Router v7
- **Icons:** Lucide React + Bespoke responsive SVG components
- **Resilience:** React `ErrorBoundary` with instant recovery

### Backend
- **Framework:** Python 3.10 + FastAPI
- **ORM & Driver:** SQLAlchemy 2.0 (Async) + `asyncpg`
- **Database Migrations:** Alembic with pgvector and trigger definitions
- **Security:** PyJWT / `python-jose`, cryptography `Fernet` AES-256 for API keys
- **AI / RAG:** AST parser, pgvector hybrid search, Server-Sent Events (SSE)

### Infrastructure & Sandboxing
- **Database:** PostgreSQL 16 with `pgvector`, `uuid-ossp`, and `pg_trgm`
- **Orchestration:** Docker Compose
- **Web Server:** Nginx (SPA reverse proxy with unbuffered SSE streaming)
- **CI/CD:** GitHub Actions

---

## 📁 Project Structure

```
DevResolve/
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI workflow
├── backend/
│   ├── alembic/                 # Database migrations (RLS, pgvector, triggers)
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/          # Auth, Projects, Conversations, Health routes
│   │   ├── core/
│   │   │   ├── config.py        # Pydantic BaseSettings
│   │   │   ├── middleware.py    # Request ID tracing & audit logging
│   │   │   └── security.py      # JWT validation & Fernet secret encryption
│   │   ├── db/
│   │   │   └── session.py       # Async SQLAlchemy engine with pool pre-ping
│   │   ├── models/
│   │   │   └── models.py        # 3NF models, soft-delete, audit mixins
│   │   ├── schemas/             # Pydantic v2 schemas
│   │   └── services/            # Auth, Project, Conversation, RAG, Agent, Sandbox
│   ├── Dockerfile               # Python 3.10 production container
│   └── requirements.txt         # Pinned backend dependencies
├── frontend/
│   ├── src/
│   │   ├── components/          # DashboardLayout, ErrorBoundary, icons
│   │   ├── lib/                 # API client, Supabase config
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx  # Hero with terminal demo & CTA
│   │   │   ├── LoginPage.tsx    # Sign in with OAuth
│   │   │   ├── SignupPage.tsx   # Sign up with validation
│   │   │   ├── OnboardingPage.tsx# 4-step setup wizard
│   │   │   ├── Dashboard.tsx    # Project cards & stats
│   │   │   ├── ChatPage.tsx     # Split-view investigation & evidence tabs
│   │   │   ├── IntegrationsPage.tsx# GitHub, Sentry, Datadog connectors
│   │   │   ├── ReportsPage.tsx  # RCA logs, MTTR metrics, patch diff previews
│   │   │   └── SettingsPage.tsx # AI models, sandbox limits, API keys
│   │   ├── App.tsx              # Application router
│   │   └── index.css            # Custom CSS design system & tokens
│   ├── Dockerfile               # Multi-stage Nginx production container
│   ├── nginx.conf               # SPA routing & API reverse proxy
│   └── package.json
├── docker-compose.yml           # Full-stack Docker orchestration
├── .env.example                 # Documented configuration variables
├── .gitignore                   # Multi-language git ignore
└── README.md                    # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- *Or for local development:* Node.js 20+, Python 3.10+, PostgreSQL 16 with pgvector

---

### Option A: One-Command Docker Compose (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/devresolve.git
   cd devresolve
   ```

2. **Copy environment variables:**
   ```bash
   cp .env.example .env
   ```

3. **Start the complete stack:**
   ```bash
   docker compose up --build -d
   ```

4. **Access the application:**
   - **Frontend UI:** [http://localhost](http://localhost) (or `http://localhost:5173` if running dev server)
   - **FastAPI Documentation:** [http://localhost:8000/api/docs](http://localhost:8000/api/docs)
   - **PostgreSQL Database:** `localhost:5432` (`devresolve` database)

---

### Option B: Local Development Setup

#### 1. Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start FastAPI dev server
uvicorn app.main:app --reload --port 8000
```

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## ⚙️ Configuration & Environment Variables

Key variables defined in `.env.example`:

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | Async PostgreSQL connection string | `postgresql+asyncpg://postgres:postgres@localhost:5432/devresolve` |
| `SUPABASE_JWT_SECRET` | Secret used to validate incoming JWT bearer tokens | `dev-secret-super-safe-key` |
| `API_KEY_ENCRYPTION_KEY` | 32-byte Fernet base64 key for encrypting provider keys | `X9gP3W8q...` |
| `DB_POOL_SIZE` | SQLAlchemy connection pool base size | `10` |
| `DB_MAX_OVERFLOW` | Maximum overflow connections under burst | `20` |
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o & embeddings | *(Optional)* |
| `ANTHROPIC_API_KEY` | Claude 3.5 Sonnet API key | *(Optional)* |
| `GEMINI_API_KEY` | Google Gemini 1.5 Pro API key | *(Optional)* |

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Healthcheck and version info |
| `GET` | `/api/auth/me` | Current authenticated user profile |
| `GET` | `/api/projects` | List projects (paginated, sorted by activity) |
| `POST` | `/api/projects` | Create a new scoped project |
| `GET` | `/api/projects/{id}` | Retrieve project details |
| `GET` | `/api/conversations` | List incident investigations for project |
| `POST` | `/api/conversations` | Start a new incident investigation |
| `GET` | `/api/conversations/{id}` | Detailed investigation message history |
| `POST` | `/api/conversations/{id}/messages` | Post user message to investigation |
| `GET` | `/api/conversations/{id}/stream` | **SSE stream** for live AI agent steps, diffs & test results |

---

## 🤝 Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
