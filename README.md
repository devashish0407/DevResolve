# ⚡ DevResolve — Autonomous AI Incident Engineer

> **An Agentic AI & Multi-Role Engineering Platform for Autonomous Production Incident Diagnosis, Root-Cause Analysis, Unified Git Patching, and Sandbox Verification.**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TS-61DAFB.svg?logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Bundler-Vite%205-646CFF.svg?logo=vite)](https://vitejs.dev)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20pgvector-336791.svg?logo=postgresql)](https://github.com/pgvector/pgvector)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com)
[![Docker](https://img.shields.io/badge/Sandbox-Docker%20Isolated-2496ED.svg?logo=docker)](https://www.docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📖 Table of Contents

- [⚡ DevResolve — Autonomous AI Incident Engineer](#-devresolve--autonomous-ai-incident-engineer)
  - [📖 Table of Contents](#-table-of-contents)
  - [🎯 Executive Summary \& Problem Statement](#-executive-summary--problem-statement)
    - [The Problem in Modern Engineering](#the-problem-in-modern-engineering)
    - [What is DevResolve?](#what-is-devresolve)
  - [💡 Why DevResolve? (Key Value Proposition)](#-why-devresolve-key-value-proposition)
  - [🤖 Agentic AI \& Multi-Agent Architecture](#-agentic-ai--multi-agent-architecture)
    - [Is this an Agentic AI Project?](#is-this-an-agentic-ai-project)
    - [Multi-Agent Model: Deterministic Orchestrated Pipeline](#multi-agent-model-deterministic-orchestrated-pipeline)
      - [The 5 Specialized Sub-Agent Roles:](#the-5-specialized-sub-agent-roles)
  - [⚡ The 7-Phase Autonomous Investigation Pipeline](#-the-7-phase-autonomous-investigation-pipeline)
  - [🌐 Universal LLM Gateway \& Multi-Provider Architecture](#-universal-llm-gateway--multi-provider-architecture)
    - [Key Gateway Capabilities:](#key-gateway-capabilities)
  - [✨ Core System Features \& Capabilities](#-core-system-features--capabilities)
    - [1. Incident Diagnosis \& Chat Workspace](#1-incident-diagnosis--chat-workspace)
    - [2. Multi-Channel Authentication \& Re-Verification](#2-multi-channel-authentication--re-verification)
    - [3. Modern Dark-Mode UI / UX](#3-modern-dark-mode-ui--ux)
  - [🛡️ Enterprise Security \& Privacy Guardrails](#️-enterprise-security--privacy-guardrails)
  - [🏛️ Complete System Architecture \& Diagrams](#️-complete-system-architecture--diagrams)
  - [💻 Technology Stack](#-technology-stack)
    - [Frontend](#frontend)
    - [Backend](#backend)
    - [Cloud Infrastructure](#cloud-infrastructure)
  - [🚀 Cloud Deployment Architecture](#-cloud-deployment-architecture)
    - [Phase 1: Database Setup (Supabase)](#phase-1-database-setup-supabase)
    - [Phase 2: Backend Setup (Render)](#phase-2-backend-setup-render)
    - [Phase 3: Frontend Setup (Vercel)](#phase-3-frontend-setup-vercel)
  - [🛠️ Local Development \& Quickstart](#️-local-development--quickstart)
    - [Prerequisites](#prerequisites)
    - [Step 1: Start the Backend (FastAPI)](#step-1-start-the-backend-fastapi)
    - [Step 2: Start the Frontend (React + Vite)](#step-2-start-the-frontend-react--vite)
    - [📋 Complete Commands Cheatsheet](#-complete-commands-cheatsheet)
  - [🔑 Environment Variables Reference](#-environment-variables-reference)
    - [Backend (`backend/.env` / Render)](#backend-backendenv--render)
    - [Frontend (`frontend/.env` / Vercel)](#frontend-frontendenv--vercel)
  - [📦 Dependencies \& Libraries](#-dependencies--libraries)
    - [Python Backend (`backend/requirements.txt`)](#python-backend-backendrequirementstxt)
    - [JavaScript/TypeScript Frontend (`frontend/package.json`)](#javascripttypescript-frontend-frontendpackagejson)
  - [⚠️ Operational Precautions \& Troubleshooting](#️-operational-precautions--troubleshooting)
  - [📄 License \& Acknowledgments](#-license--acknowledgments)

---

## 🎯 Executive Summary & Problem Statement

### The Problem in Modern Engineering
When production breaks at 2:00 AM—whether due to an unhandled `HTTP 500`, a PostgreSQL connection pool exhaustion, memory leak, or a broken dependency—on-call developers face severe bottlenecks:
* **Log Fatigue & Context Fragmentation**: Engineers spend hours jumping between Datadog, Sentry, GitHub commits, and microservice traces trying to locate the line of code that triggered the failure.
* **Mean Time to Resolution (MTTR) Inflation**: Every minute of downtime costs modern enterprises an average of **\$5,000 to \$9,000**.
* **AI Hallucination Risk**: Generic AI chatbots (ChatGPT, generic coding assistants) guess solutions without understanding repo context, often suggesting hallucinated functions that introduce new bugs.
* **Untested Code Patches**: AI-generated code without containerized verification is dangerous to apply directly to mission-critical repositories.

### What is DevResolve?
**DevResolve** is an autonomous Tier-1 and Tier-2 AI Incident Engineer. It does not simply chat—it has **agency**. It ingests stack traces, queries your codebase using hybrid vector search (RAG) and Abstract Syntax Tree (AST) parsing, diagnoses the architectural root cause, synthesizes a surgical unified git diff, and **executes tests inside an isolated Docker sandbox** to guarantee zero regressions before presenting a verified resolution report.

---

## 💡 Why DevResolve? (Key Value Proposition)

| Traditional Incident Response | Generic AI Chatbots (ChatGPT / Copilot) | DevResolve (Autonomous Incident Engineer) |
| :--- | :--- | :--- |
| Manual log digging across 5+ monitoring tabs | Conversational guessing without repository awareness | **Autonomous 7-phase investigation pipeline** |
| 45–180 minutes average MTTR | Hallucinated code snippets that break build pipelines | **Sub-60-second root cause diagnosis** |
| Manual patch authoring and testing | No verification or test execution capability | **Surgical git diff patches verified in Docker sandboxes** |
| Post-mortems written days later | No regression safety guarantees | **Audit-ready incident reports & 1-click PR exports** |

---

## 🤖 Agentic AI & Multi-Agent Architecture

### Is this an Agentic AI Project?
**Yes.** Unlike passive text-generation tools, DevResolve is an **Agentic AI platform**. It pursues complex technical goals autonomously through:
1. **Perception**: Scans runtime errors, vector-indexes repositories, and traverses AST symbol trees.
2. **Tool Execution**: Invokes RAG vector search, MCP (Model Context Protocol) endpoints, GitHub APIs, and Docker sandboxes.
3. **Reflection & Self-Correction**: Formulates root-cause hypotheses, assesses confidence scores, evaluates diffs against tests, and detects regressions.

### Multi-Agent Model: Deterministic Orchestrated Pipeline
Rather than relying on unpredictable, conversational multi-agent chat swarms (which frequently hallucinate or loop indefinitely), DevResolve implements a **Hierarchical Orchestrated Multi-Role Agent Architecture** (aligned with Anthropic's *Building Effective Agents* best practices).

```mermaid
flowchart TD
    Incident["Production Incident / Error Trace"] --> Orchestrator["Agent Orchestrator (InvestigationService)"]
    
    subgraph MultiAgentRoles["Specialized Sub-Agent Roles"]
        Orchestrator --> Agent1["1. Retrieval Agent<br/>(Hybrid Vector Search & AST Discovery)"]
        Agent1 --> Agent2["2. Diagnostic & RCA Agent<br/>(Stack Parsing & Root Cause Analysis)"]
        Agent2 --> Agent3["3. Patch Synthesis Agent<br/>(Minimal Unified Git Diff Generation)"]
        Agent3 --> Agent4["4. Sandbox Verification Agent<br/>(Docker Execution & Test Runner)"]
        Agent4 --> Agent5["5. Incident Scribe Agent<br/>(Post-Mortem & GitHub PR Exporter)"]
    end
    
    Agent5 --> Output["Verified Pull Request & Post-Mortem Report"]
```

#### The 5 Specialized Sub-Agent Roles:
1. **Retrieval Agent** ([rag_service.py](file:///d:/project/DevResolve/backend/app/services/rag_service.py)): Generates 1536-dimensional embeddings, scans indexed codebase chunks, and expands queries contextually across conversation memory.
2. **Diagnostic & RCA Agent** ([investigation_service.py](file:///d:/project/DevResolve/backend/app/services/investigation_service.py)): Resolves call hierarchies, unhandled error cascade boundaries, and computes a confidence score for the defect.
3. **Patch Synthesis Agent**: Formulates production-grade, minimal unified diffs (`.diff`) that alter only the broken logic without side-effects.
4. **Sandbox Verification Agent** ([sandbox_service.py](file:///d:/project/DevResolve/backend/app/services/sandbox_service.py)): Applies patches into isolated, network-disabled micro-containers (`--network none`) and runs test suites (`pytest`, `npm test`).
5. **Incident Scribe Agent**: Compiles executive summaries, affected microservice boundaries, SLA impacts, and GitHub-ready PR payloads.

---

## ⚡ The 7-Phase Autonomous Investigation Pipeline

When an incident report or crash trace is submitted, the engine executes a non-blocking 7-phase state machine that streams real-time Server-Sent Events (SSE) to the frontend:

```
[1. RETRIEVE]    Query pgvector embeddings & AST symbols for error signatures
      │
[2. ANALYZE]     Parse call stack, trace logs, and variable bindings
      │
[3. INSPECT]     Examine code blocks around suspects with AST hierarchy
      │
[4. HYPOTHESIZE] Formulate high-confidence architectural / concurrency root causes
      │
[5. FIX]         Synthesize surgical, minimal unified git diff patch
      │
[6. TEST]        Execute patch inside isolated Docker sandbox (pytest / npm test)
      │
[7. REPORT]      Stream incident report, confidence metrics, and export PR
```

1. **Phase 1: Retrieve**: Hybrid search combining vector cosine similarity with lexical keyword overlap over indexed source files and documentation.
2. **Phase 2: Analyze**: Extracts failing stack frames, microservice boundaries, and unhandled exceptions.
3. **Phase 3: Inspect**: Reads AST trees (Python / TypeScript) to inspect variable states, unclosed streams, or missing boundary checks.
4. **Phase 4: Hypothesize**: Produces a diagnosis (e.g. unclosed DB cursor, JWT expiration mismatch, or unhandled null pointer).
5. **Phase 5: Fix**: Generates a surgical git unified diff patch addressing the exact fault lines.
6. **Phase 6: Test**: Applies the patch inside a Docker container with strict CPU/memory limits and zero network access (`--network none`).
7. **Phase 7: Report**: Generates post-mortems with pass/fail test counts and GitHub export options.

---

## 🌐 Universal LLM Gateway & Multi-Provider Architecture

DevResolve includes a native, unified **LLM Gateway** ([llm_service.py](file:///d:/project/DevResolve/backend/app/services/llm_service.py)) that abstracts multiple AI reasoning providers behind a single resilient API:

```mermaid
flowchart LR
    Orchestrator["Agent Pipeline"] --> Gateway["Universal LLM Gateway"]
    Gateway -->|Primary (Ultra-Fast)| Groq["Groq Cloud<br/>(Qwen 3.8 27B / Llama 3.3 70B)"]
    Gateway -->|Automated Fallback| Gemini["Google Gemini<br/>(1.5 Flash / 2.0 Flash)"]
    Gateway -->|Enterprise Tier| OpenAI["OpenAI<br/>(GPT-4o / GPT-4o-mini)"]
    Gateway -->|Complex Reasoning| Anthropic["Anthropic<br/>(Claude 3.5 Sonnet)"]
```

### Key Gateway Capabilities:
* **Automated Provider Failover**: If the primary provider (e.g. Groq) encounters cloud traffic surges, rate limits (HTTP 429), or service degradation, DevResolve automatically and transparently reroutes the prompt to a secondary provider (e.g. Google Gemini) without crashing the user session.
* **Dynamic BYOK (Bring Your Own Key)**: Developers and teams can configure personal Groq, Gemini, OpenAI, or Anthropic keys directly in the frontend UI without restarting backend containers.
* **Token Budget & Quota Tracking**: Enforces complimentary 5,000-token free-tier budgets per user, monitoring platform master key headroom.
* **Alert Cooldown System**: Alerts administrators of platform quota exhaustion via automated email, with a 15-minute cooldown to prevent inbox flooding.

---

## ✨ Core System Features & Capabilities

### 1. Incident Diagnosis & Chat Workspace
* **Context-Aware Streaming**: Natural real-time SSE streaming for both conversational technical Q&A and 7-phase incident investigations.
* **AST Symbol Resolution**: Understands line-level queries (e.g., *"What is happening on line 5 of Lexer.test.jsx?"*).
* **Code Diff Viewer**: Interactive, color-coded unified diff viewer displaying deletions (red) and insertions (green).

### 2. Multi-Channel Authentication & Re-Verification
* **Email & Password Authentication**: Case-insensitive, whitespace-trimmed email handling with duplicate account protection.
* **Dynamic Password Strength Meter**: Real-time multi-segment visual progress bar (WEAK / FAIR / STRONG) and 4 interactive rule pills:
  * `6+ characters`
  * `1 uppercase (A-Z)`
  * `1 number (0-9)`
  * `1 symbol ($#@&*!)`
* **Signup Email OTP Re-Verification**: 6-digit OTP dispatched to user's Gmail via SMTP with a 10-minute validity window. Features 6-digit auto-advancing inputs, paste support, a 60-second resend cooldown timer, and an email-edit toggle.
* **Forgot Password Workflow**: Time-limited cryptographic reset links dispatched via Gmail SMTP with dedicated `/reset-password` token verification.
* **Direct Google & GitHub OAuth 2.0**: Native OAuth consent flows with automatic user provisioning.

### 3. Modern Dark-Mode UI / UX
* **Glassmorphic Aesthetic**: Designed with a sleek `#0b0f19` dark terminal theme, radial background glows, and responsive layouts.
* **Dynamic Custom Favicon & Branding**: Branded purple-blue gradient squircle with a luminous 4-point resolution star.

---

## 🛡️ Enterprise Security & Privacy Guardrails

Security is baked into every architectural layer:

1. **Cryptographic Password Hashing**: Utilizes **PBKDF2-SHA256** with unique 16-byte random salts and 100,000 iterations via [security.py](file:///d:/project/DevResolve/backend/app/core/security.py). Plaintext passwords are never stored.
2. **Encrypted Secret Storage**: User BYOK API keys are encrypted at rest using **Fernet (AES-128-CBC with HMAC-SHA256 authentication)**.
3. **Stateless JWT Authorization**: HS256 signed JSON Web Tokens carrying strict expiration (`exp`) and audience (`aud: authenticated`) claims.
4. **Tenant Isolation**: Strict organization-scoped row-level filtering preventing cross-tenant data leakage.
5. **Air-Gapped Docker Sandboxing**: All test executions run in isolated containers with `--network none`, strict RAM limits (`512MB-1024MB`), and 60-second timeouts.
6. **Input Sanitization**: Pydantic v2 validation models on all request payloads.

---

## 🏛️ Complete System Architecture & Diagrams

```mermaid
flowchart TD
    subgraph ClientLayer["Frontend Client (Vercel)"]
        UI["React 18 + TypeScript + Vite SPA"]
        AuthContext["Auth Context (JWT + LocalStorage)"]
        SSEHook["SSE Stream Consumer"]
    end

    subgraph APILayer["API Gateway (Render Web Service)"]
        FastAPI["FastAPI Application (app.main:app)"]
        CORS["CORS Middleware (Vercel Origin)"]
        AuthRouter["/api/auth (Login, Register, OTP, Reset)"]
        ChatRouter["/api/conversations (Investigate SSE)"]
        RAGRouter["/api/rag (Index & Search)"]
    end

    subgraph StorageLayer["Data & Persistence (Supabase)"]
        Postgres[("PostgreSQL 16 Engine")]
        PGVector["pgvector Extension (1536-dim embeddings)"]
    end

    subgraph ExternalServices["External Infrastructure"]
        Gmail["Google Gmail SMTP (Port 587 STARTTLS)"]
        LLMs["AI Providers (Groq / Gemini / OpenAI / Anthropic)"]
    end

    UI <-->|"REST APIs & SSE Streams"| FastAPI
    FastAPI <-->|"asyncpg Sessions"| Postgres
    Postgres <--> PGVector
    AuthRouter -->|"Dispatches OTPs & Resets"| Gmail
    ChatRouter -->|"Queries Reasoning"| LLMs
```

---

## 💻 Technology Stack

### Frontend
* **Core**: React 18, TypeScript, Vite 5
* **Routing**: React Router v6 (SPA with `vercel.json` rewrites)
* **Styling**: Tailwind CSS, PostCSS, Lucide Icons
* **State & Networking**: Custom AuthProvider, Native Fetch, EventSource (SSE streaming)

### Backend
* **Core**: Python 3.11, FastAPI 0.104, Uvicorn (ASGI)
* **Settings & Models**: Pydantic v2, Pydantic-Settings
* **Database Driver & ORM**: SQLAlchemy 2.0 (Async), `asyncpg` (PostgreSQL), `aiosqlite` (local fallback)
* **Vectors & Embeddings**: `pgvector`, NumPy, TikToken
* **Security & Crypto**: `python-jose`, `cryptography` (Fernet), `hashlib`, `secrets`
* **Mail Protocol**: `smtplib` with STARTTLS, `email.mime`

### Cloud Infrastructure
* **Frontend**: Vercel Global Edge Network
* **Backend**: Render Linux Web Service
* **Database**: Supabase Managed PostgreSQL + pgvector
* **Mail Server**: Google Gmail SMTP

---

## 🚀 Cloud Deployment Architecture

Deploying DevResolve to production takes three clean phases:

```mermaid
flowchart LR
    VercelDeploy["1. Deploy Frontend<br/>(Vercel)"] --> RenderDeploy["2. Deploy Backend<br/>(Render)"]
    RenderDeploy --> SupabaseDeploy["3. Connect Database<br/>(Supabase)"]
```

### Phase 1: Database Setup (Supabase)
1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Click **Connect** in the top bar $\rightarrow$ **Connection Pooling** $\rightarrow$ copy the **URI**:
   ```text
   postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```

### Phase 2: Backend Setup (Render)
1. Push your repository to GitHub.
2. In [render.com](https://render.com), click **New +** $\rightarrow$ **Web Service** $\rightarrow$ connect your repo.
3. Configure the settings:
   * **Root Directory**: `backend`
   * **Runtime**: `Python 3`
   * **Build Command**: `pip install -r requirements.txt`
   * **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add the required Environment Variables (see [Environment Variables Reference](#-environment-variables-reference)).
5. Click **Create Web Service**.

### Phase 3: Frontend Setup (Vercel)
1. In [vercel.com](https://vercel.com), click **Add New...** $\rightarrow$ **Project** $\rightarrow$ import your repo.
2. Configure project settings:
   * **Framework Preset**: `Vite`
   * **Root Directory**: `frontend`
3. Add Environment Variable:
   * `VITE_API_URL`: `https://your-backend.onrender.com/api`
4. Click **Deploy**.

---

## 🛠️ Local Development & Quickstart

### Prerequisites
* **Python**: 3.10 or 3.11 installed (`python --version`)
* **Node.js**: v18+ and `npm` installed (`node --version` and `npm --version`)
* **Git**: Installed (`git --version`)
* *(Optional)* **Docker**: For running sandbox execution containers locally

---

### Step 1: Start the Backend (FastAPI)

Open your terminal and run:

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Create a Python virtual environment (if not already created)
python -m venv .venv

# 3. Activate the virtual environment
# On Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# On Windows (Command Prompt):
.\.venv\Scripts\activate.bat
# On Linux / macOS:
source .venv/bin/activate

# 4. Install all required backend dependencies
pip install -r requirements.txt

# 5. Start the backend development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

* **Live Backend API**: `http://localhost:8000`
* **Health Check**: `http://localhost:8000/api/health`
* **Interactive Swagger API Documentation**: `http://localhost:8000/api/docs`

---

### Step 2: Start the Frontend (React + Vite)

Open a **second terminal window** and run:

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install all required npm packages
npm install

# 3. Start the Vite local development server
npm run dev
```

* **Live Frontend App**: `http://localhost:5173`

---

### 📋 Complete Commands Cheatsheet

| Task | Location | Command |
| :--- | :--- | :--- |
| **Install Frontend Packages** | `frontend/` | `npm install` |
| **Start Frontend Dev Server** | `frontend/` | `npm run dev` |
| **Build Frontend for Production** | `frontend/` | `npm run build` |
| **Preview Frontend Production Build** | `frontend/` | `npm run preview` |
| **Create Python Virtual Environment** | `backend/` | `python -m venv .venv` |
| **Activate Virtual Environment (Windows)** | `backend/` | `.\.venv\Scripts\activate` |
| **Activate Virtual Environment (Mac/Linux)** | `backend/` | `source .venv/bin/activate` |
| **Install Backend Dependencies** | `backend/` | `pip install -r requirements.txt` |
| **Start Backend Dev Server** | `backend/` | `uvicorn app.main:app --reload --port 8000` |
| **Run Backend Unit Tests** | `backend/` | `pytest` |

---

## 🔑 Environment Variables Reference

### Backend (`backend/.env` / Render)

| Variable | Description | Sample / Default |
| :--- | :--- | :--- |
| `APP_NAME` | Name of application | `DevResolve` |
| `ENVIRONMENT` | Runtime environment | `development` or `production` |
| `DEBUG` | Enable verbose debugging | `false` |
| `DATABASE_URL` | PostgreSQL or SQLite connection URI | `postgresql+asyncpg://user:pass@host:5432/postgres` |
| `JWT_SECRET_KEY` | 64-char secret key for JWT signatures | `310036221c7aa3c83fbc...` |
| `ALLOWED_ORIGINS` | Permitted CORS origins (list or comma-separated) | `["https://devresolve.vercel.app","http://localhost:5173"]` |
| `FRONTEND_URL` | Base public URL of frontend | `https://devresolve.vercel.app` |
| `BACKEND_URL` | Base public URL of backend | `https://devresolve-backend.onrender.com` |
| `SMTP_HOST` | Outbound SMTP host | `smtp.gmail.com` |
| `SMTP_PORT` | Outbound SMTP port | `587` |
| `SMTP_USER` | SMTP account email | `you@gmail.com` |
| `SMTP_PASSWORD` | 16-character Google App Password | `xxxx xxxx xxxx xxxx` |
| `SMTP_FROM_EMAIL`| Sender email address | `you@gmail.com` |
| `GROQ_API_KEY` | Primary Groq reasoning API key | `gsk_...` |
| `GEMINI_API_KEY` | Fallback Google Gemini API key | `AIzaSy...` |
| `OPENAI_API_KEY` | Optional OpenAI key | `sk-proj-...` |
| `ANTHROPIC_API_KEY`| Optional Anthropic key | `sk-ant-...` |

### Frontend (`frontend/.env` / Vercel)

| Variable | Description | Sample / Default |
| :--- | :--- | :--- |
| `VITE_API_URL` | Target FastAPI backend URL with `/api` | `https://devresolve-backend.onrender.com/api` |

---

## 📦 Dependencies & Libraries

### Python Backend (`backend/requirements.txt`)
```text
fastapi==0.104.1            # Modern, high-performance web framework
uvicorn[standard]==0.24.0   # Lightning-fast ASGI web server
pydantic==2.5.2             # Data validation and parsing
pydantic-settings==2.1.0    # Hierarchical settings management
email-validator>=2.0.0      # RFC-compliant email address validation
sqlalchemy==2.0.23          # Comprehensive SQL toolkit and Object Relational Mapper
alembic==1.13.0             # Lightweight database migration tool
asyncpg==0.29.0             # High-performance async PostgreSQL driver
aiosqlite==0.19.0           # Async driver for SQLite local fallback
pgvector==0.2.4             # Vector similarity search for PostgreSQL
python-jose[cryptography]   # JWT token encoding, decoding, and verification
cryptography>=41.0.0        # Symmetric Fernet encryption for credentials
httpx==0.25.2               # Next-generation async HTTP client for Python
openai==1.6.1               # Official OpenAI Python client
tiktoken==0.5.2             # Fast BPE token counter for OpenAI & open models
numpy>=1.24.0               # Vector cosine similarity computations
aiofiles==23.2.1            # Asynchronous file operations
```

### JavaScript/TypeScript Frontend (`frontend/package.json`)
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2",
    "lucide-react": "^0.446.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.2"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.4.2",
    "tailwindcss": "^3.4.13",
    "postcss": "^8.4.47",
    "autoprefixer": "^10.4.20"
  }
}
```

---

## ⚠️ Operational Precautions & Troubleshooting

1. **Python Version Pinning (Render)**:
   * Always ensure Render uses Python **`3.11.9`** (via `.python-version` or `PYTHON_VERSION=3.11.9`). Python 3.14 lacks pre-built wheels and causes Cargo compile errors.
2. **Special Characters in Database Passwords**:
   * If your Supabase password contains `@`, `#`, or `$`, the `@` symbol breaks connection URL parsing. Either URL-encode the characters (`@` $\rightarrow$ `%40`) or reset your password to alphanumeric characters.
3. **Gmail SMTP Setup**:
   * Do not use your regular Gmail login password. You must generate a **16-character Google App Password** via Google Account $\rightarrow$ Security $\rightarrow$ 2-Step Verification $\rightarrow$ App Passwords.
4. **CORS Whitelisting**:
   * Ensure `ALLOWED_ORIGINS` on Render includes your exact Vercel production URL (e.g. `https://devresolve.vercel.app`).
5. **Vercel Client-Side Routing**:
   * Ensure [frontend/vercel.json](file:///d:/project/DevResolve/frontend/vercel.json) exists with rewrite rules to `/index.html` to avoid 404 errors when refreshing subpages like `/app` or `/signup`.

---

## 📄 License & Acknowledgments

This project is licensed under the **MIT License**. See the `LICENSE` file for details.

