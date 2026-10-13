# InfraControl — Enterprise Infrastructure Control Plane

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node: >=18.0.0](https://img.shields.io/badge/Node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![React: 19](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev/)
[![Docker: Ready](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](docker-compose.yml)

**InfraControl** is a modern, full-stack multi-tenant infrastructure control plane designed for DevOps, SRE, and platform engineering teams. It centralizes inventory management across cloud and on-premise hosts, real-time Linux hardware telemetry, in-browser Web SSH terminals, safe allow-listed operation workflows, database replication health, automated threshold alerts, capacity planning and resizing, and granular role-based access control (RBAC) with immutable audit logging.

---

## 🚀 Key Features

* **Multi-Tenant Hierarchy:** Organize infrastructure cleanly across **Clients (Spaces) &rarr; Projects &rarr; Environments (Production / Staging / Development) &rarr; Servers**.
* **Real-Time Telemetry & Health Engine:** Ingest real-time CPU, RAM, Disk, Network, and Load metrics via an outbound-only host agent (`infra-agent`) or Prometheus `remote_write` gateway with cryptographic token validation.
* **In-Browser Web SSH Terminal:** Interactive WebSockets-based terminal powered by `@xterm/xterm` with built-in 1-click diagnostic presets (`htop`, `docker ps`, `df -h`, `free -m`, `systemctl status`).
* **Intelligent Incident Alerting:** Automated metric threshold monitoring and offline heartbeat sweepers with formatted alert notifications and automatic recovery notices.
* **Safe Operations Engine:** Run parameterized, catalog-approved operations (Health Check, Service Restart, Disk Cleanup, Agent Update, Reboot, Replica Sync) using signed HMAC jobs without opening unrestricted shell access or listening ports.
* **Database Replication Management:** Explicit primary &rarr; replica topology tracking with localized lag measurement for PostgreSQL and MySQL, automated degraded/critical alerts, and pre-checked sync/recovery workflows.
* **Capacity Planning & Resizing:** Multi-step instance resize workflow integrated with cloud provider catalog pricing, pre-checks, snapshots, and 2-person approval gating in production.
* **Cost Accrual & Billing Analytics:** Automated hourly cost snapshot calculations per server, project, and tenant without live billing API latency.
* **Granular RBAC & Audit Trail:** 7 scoped roles (*Platform Admin, DevOps, Project Admin, Client Admin, Client Viewer, Auditor, Billing*) with immutable audit logging tracking every privileged action.

---

## 🏛️ Architecture Overview

```
                          ┌───────────────────────────┐
                          │   React 19 SPA Frontend   │
                          │   (Vite + Tailwind CSS)   │
                          └─────────────┬─────────────┘
                                        │  HTTPS / WSS
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Node.js / Express Control Plane                          │
│                                                                             │
│  ┌──────────────────┐   ┌───────────────────┐   ┌────────────────────────┐  │
│  │  REST API Engine │   │ Web SSH Terminal  │   │ Remote-Write Gateway   │  │
│  │  (Auth & RBAC)   │   │ (WebSocket Bridge)│   │ (/ingest/metrics)      │  │
│  └────────┬─────────┘   └─────────┬─────────┘   └───────────┬────────────┘  │
│           │                       │                         │               │
│  ┌────────▼───────────────────────▼─────────────────────────▼────────────┐  │
│  │ Background Workers: Heartbeat Sweeper · Cost Accrual · Resizer · Jobs │  │
│  └────────────────────────────────┬──────────────────────────────────────┘  │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌──────────────────────┐                         ┌─────────────────────────┐
│       MongoDB        │                         │   Remote Linux Hosts    │
│ (Data & Audit Logs)  │                         │ (infra-agent & vmagent) │
└──────────────────────┘                         └─────────────────────────┘
```

---

## 🛠️ Tech Stack

* **Frontend:** React 19, Vite, Tailwind CSS, Lucide Icons, Recharts, Xterm.js (`@xterm/xterm`), Axios.
* **Backend:** Node.js, Express.js, MongoDB / Mongoose, WebSockets (`ws`), `ssh2`, JWT, `nodemailer`, `snappyjs`, Helmet, Express-Rate-Limit.
* **Telemetry & Agent:** Standalone host daemon (`infra-agent.js`), `node_exporter`, VictoriaMetrics agent (`vmagent`), Prometheus TSDB storage.
* **DevOps / Deployment:** Docker, Docker Compose, Caddy Reverse Proxy (automated TLS via Let's Encrypt).

---

## 📁 Repository Structure

```
InfraControl/
├── backend/
│   ├── src/
│   │   ├── config/          # Database connection and environment verification
│   │   ├── controllers/     # REST API endpoint controllers
│   │   ├── middleware/      # Auth, tenant scoping, and central error handling
│   │   ├── models/          # Mongoose database models
│   │   ├── routes/          # Express route definitions
│   │   ├── services/        # SSH Bridge, Telemetry, Operations, Replication, Cost, Resize
│   │   ├── seed/            # Seed data script with realistic multi-tenant hierarchy
│   │   └── server.js        # Main Express server entry point & single-origin SPA handler
│   ├── scripts/             # Admin generator, fleet simulator & test suites
│   ├── package.json
│   └── nodemon.json
│
├── frontend/
│   ├── src/
│   │   ├── components/      # UI components, modals, charts, terminals & layout
│   │   ├── context/         # Auth, Theme, and Toast React contexts
│   │   ├── pages/           # Dashboard, Servers, Operations, Replication, Costs, Users, Alerts
│   │   ├── routes/          # Protected and public route definitions
│   │   └── services/        # Axios API client
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── telemetry/
│   ├── infra-agent.js       # Outbound host heartbeat & job execution daemon
│   └── prometheus/          # Prometheus configuration for metrics ingestion
│
├── deploy/
│   └── Caddyfile            # Production reverse proxy configuration with TLS headers
│
├── .env.production.example  # Production environment template
├── docker-compose.yml       # Production multi-container composition
├── Dockerfile               # Production multi-stage container build
├── package.json             # Root monorepo scripts
└── README.md
```

---

## ⚡ Quick Start (Local Development)

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **MongoDB**: Running on `mongodb://localhost:27017`

### 1. Install Dependencies
```bash
# Backend dependencies
npm --prefix backend install

# Frontend dependencies
npm --prefix frontend install
```

### 2. Configure Backend Environment
Create `backend/.env`:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/server_management_platform
CLIENT_URL=http://localhost:5173
JWT_SECRET=dev_jwt_secret_key_server_management_infra_2026
INTEGRATION_SECRET_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

### 3. Seed Database & Start Applications
```bash
# Seed development database with tenants, servers, and users
npm --prefix backend run seed

# Terminal 1: Start Backend API
npm --prefix backend run dev

# Terminal 2: Start Frontend App
npm --prefix frontend run dev
```

Open your browser at **http://localhost:5173**.

---

## 👥 Seeded Accounts (Development Workspace)

When seeded via `npm run seed`, the following default accounts are available:

| Email | Password | Role | Access Scope |
|:---|:---|:---|:---|
| `admin@example.com` | `Admin@123` | **Platform Admin** | Full global access across all tenants |
| `devops@example.com` | `DevOps@123` | **DevOps / Infrastructure** | Infrastructure & operations across assigned clients |
| `client.admin@example.com` | `Client@123` | **Client Admin** | Client management, scoped to Nexus FinTech |
| `viewer@example.com` | `Viewer@123` | **Client Viewer** | Read-only observability, scoped to Nexus FinTech |
| `auditor@example.com` | `Auditor@123` | **Auditor** | Read-only compliance & full audit log access |
| `billing@example.com` | `Billing@123` | **Billing / Finance** | Cost reports and invoice management |

---

## 🤖 Fleet Simulator

To test live telemetry, metric graphs, and operations without needing real cloud servers, start the fleet simulator daemon:

```bash
npm --prefix backend run simulate
```

The simulator emulates running agents across all servers, pushing periodic heartbeats and metrics to the control plane. You can trigger live incidents by typing commands directly into the simulator terminal:

* `cpu <ServerName>` — simulates elevated CPU saturation (>95%).
* `memory <ServerName>` — simulates a memory leak scenario.
* `disk <ServerName>` — simulates disk partition filling up.
* `lag <ServerName>` — simulates replication delay on a replica.
* `offline <ServerName>` — halts heartbeats to trigger offline detection.
* `ok <ServerName>` — restores nominal operating parameters.
* `list` — displays current active scenarios.

---

## 🧪 Automated Test Suites

The backend includes comprehensive end-to-end test suites validating core system guarantees:

```bash
# 1. RBAC & Tenant Isolation (gated routes, role checks, audit logs, terminal access)
npm --prefix backend run test:rbac

# 2. Resize Workflow (provider linking, plan candidates, approval lifecycle)
npm --prefix backend run test:resize

# 3. Operations & Replication (HMAC signatures, reboot proofs, secret redactions, sync)
npm --prefix backend run test:operations

# 4. Metrics Pipeline (remote_write gateway, spoofed ID rewrite, Prometheus queries)
npm --prefix backend run test:metrics
```

---

## 🐳 Production Deployment (Docker Compose)

The production stack is packaged into a self-contained, single-server setup using Docker Compose and Caddy for automated TLS.

### 1. VPS Sizing & Preparation
* **Recommended Specs:** 2 vCPU / 4 GB RAM / 50 GB SSD (Ubuntu 22.04 or 24.04).
* Point your DNS A-Record (e.g., `panel.example.com`) to your VPS IP address.
* Ensure firewall ports `80` (HTTP) and `443` (HTTPS) are open.

### 2. Configure Production Secrets
Copy and edit the production environment configuration:
```bash
cp .env.production.example .env
```

Generate 64-character random hex keys for security tokens:
```bash
openssl rand -hex 32
```

Configure key variables in `.env`:
```env
DOMAIN=panel.example.com
CLIENT_URL=https://panel.example.com
NODE_ENV=production
JWT_SECRET=your_generated_random_64_hex_chars
INTEGRATION_SECRET_KEY=your_second_generated_64_hex_chars
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=YourStrongPassword123!
```

### 3. Build & Launch Containers
```bash
docker compose up -d --build
```

### 4. Create Platform Admin Account
```bash
docker compose exec app npm run create-admin
```

Verify system health:
```bash
curl -s https://panel.example.com/api/health
```

---

## 💻 Installing Agent on Managed Servers

To connect a remote Linux host to InfraControl:
1. Open the panel &rarr; Navigate to your **Server** &rarr; Open the **Agent** tab.
2. Click **Generate Token** to obtain a fresh agent token.
3. Run the generated non-interactive curl command on the target host with root privileges:

```bash
curl -fsSL https://panel.example.com/api/agent/install.sh | sudo SMP_URL=https://panel.example.com SMP_TOKEN=<YOUR_TOKEN> bash
```

The installer:
* Installs `node_exporter` (metrics collection on localhost `9100`).
* Installs `vmagent` (pushes metrics outbound over HTTPS via `/ingest/metrics`).
* Installs `infra-agent` (outbound heartbeat, replication checks, and signed job execution).
* **Requires zero open inbound ports** on the managed host.

---

## 🔐 Security & Governance Principles

* **No Arbitrary Shell Access:** Operational interventions run strictly through pre-compiled catalog scripts; free-form shell input is rejected by design.
* **Cryptographic Job Signatures:** Operations dispatched to agents are signed via HMAC-SHA256 derived from the server's unique agent credential.
* **Strict Two-Person Rule:** Destructive and high-risk operations (Reboot, Sync, Production Service Restarts, Instance Resizes) enforce independent peer approval.
* **Sensitive Data Redaction:** Execution logs automatically filter private keys, bearer tokens, AWS credentials, and database passwords before persisting.
* **Tenant Isolation:** Scoped query middleware guarantees client tenants cannot access, view, or infer metadata from neighboring organizations.
* **Rate Limiting & Hardening:** Brute-force protection on authentication endpoints, secure HTTP headers via Helmet, and unprivileged container runtime execution.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
