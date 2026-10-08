# InfraControl — Enterprise Infrastructure Control Plane

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node: >=18.0.0](https://img.shields.io/badge/Node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![React: 18](https://img.shields.io/badge/React-18-cyan.svg)](https://react.dev/)
[![Docker: Ready](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](docker-compose.yml)

**InfraControl** is a modern, full-stack multi-tenant infrastructure management platform designed for DevOps teams and Cloud Engineers. It provides centralized control across multi-cloud servers, live Linux hardware telemetry, in-browser Web SSH terminals, safe allow-listed operation workflows, automated threshold alerts, capacity resizing, and granular role-based access control with immutable audit logging.

---

## 🚀 Key Features

* **Multi-Tenant Hierarchy:** Organize infrastructure cleanly across **Clients (Spaces) &rarr; Projects &rarr; Environments (Prod / Staging / Dev) &rarr; Servers**.
* **Real-Time Telemetry & Health Engine:** Ingest real-time CPU, RAM, Disk, and Load telemetry via a lightweight host agent daemon (`infra-agent`) or Prometheus `remote_write`.
* **In-Browser Web SSH Terminal:** Interactive WebSockets-based terminal powered by `@xterm/xterm` with built-in 1-click diagnostic presets (`htop`, `docker ps`, `df -h`, `free -m`, `systemctl status`).
* **Intelligent Incident Alerting:** Automated metric threshold monitoring and offline heartbeat sweepers with formatted HTML alerts dispatched via SMTP.
* **Safe Operations Engine:** Run parameterized, pre-approved maintenance operations (service restarts, cache clears, state sync, log rotation) without arbitrary shell security risks.
* **Capacity Planning & Resizing:** Multi-step instance resize workflow integrated with cloud provider catalog pricing (AWS, DigitalOcean, Hetzner, GCP).
* **Cost Accrual & Billing Analytics:** Automated hourly cost snapshot calculations per server, project, and tenant without slow external API delays.
* **Granular RBAC & Audit Trail:** 6 scoped roles (*Platform Admin, DevOps, Project Admin, Client Admin, Viewer, Billing*) with immutable audit logging tracking every action.

---

## 🏛️ Architecture Overview

```
                          ┌───────────────────────────┐
                          │   React 18 SPA Frontend   │
                          │   (Vite + Tailwind CSS)   │
                          └─────────────┬─────────────┘
                                        │  HTTPS / WSS
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Node.js / Express Control Plane                     │
│                                                                         │
│  ┌─────────────────┐   ┌───────────────────┐   ┌──────────────────────┐ │
│  │ REST API Engine │   │ Web SSH Terminal  │   │ Telemetry Ingest     │ │
│  │ (Auth & RBAC)   │   │ (WebSocket Bridge)│   │ (Prometheus / Agent) │ │
│  └────────┬────────┘   └─────────┬─────────┘   └──────────┬───────────┘ │
│           │                      │                        │             │
│  ┌────────▼──────────────────────▼────────────────────────▼───────────┐ │
│  │  Background Workers: Heartbeat Sweeper · Cost Accrual · Resizer    │ │
│  └────────────────────────────────┬───────────────────────────────────┘ │
└───────────────────────────────────┼─────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌──────────────────────┐                         ┌───────────────────────┐
│       MongoDB        │                         │  Remote Linux Hosts   │
│  (Data & Audit Logs) │                         │  (Telemetry & SSH)    │
└──────────────────────┘                         └───────────────────────┘
```

---

## 🛠️ Tech Stack

* **Frontend:** React 18, Vite, Tailwind CSS, Lucide Icons, Recharts, Xterm.js, Axios.
* **Backend:** Node.js, Express.js, MongoDB / Mongoose, WebSockets (`ws`), `ssh2`, JWT, `nodemailer`, `snappyjs`, Helmet, Express-Rate-Limit.
* **Telemetry & Agent:** Zero-dependency Node daemon (`infra-agent.js`), Prometheus `remote_write` receiver.
* **DevOps / Containerization:** Docker, Docker Compose, Caddy Reverse Proxy.

---

## 📁 Repository Structure

```
InfraControl/
├── backend/
│   ├── src/
│   │   ├── config/          # Database and environment configurations
│   │   ├── controllers/     # REST API endpoint handlers
│   │   ├── middleware/      # Auth, RBAC scoping, and error handling
│   │   ├── models/          # Mongoose database models
│   │   ├── routes/          # Express route definitions
│   │   ├── services/        # SSH Bridge, Telemetry, Email, Cost, and Resize services
│   │   ├── seed/            # Development database seed script
│   │   └── server.js        # Main Express server entry point
│   ├── scripts/             # Admin creation & pipeline validation utilities
│   ├── .env.example         # Backend environment configuration template
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components, modals, charts & terminals
│   │   ├── context/         # Auth, Theme, and Toast React contexts
│   │   ├── pages/           # Dashboard, Servers, Projects, Clients, Alerts, Costs
│   │   ├── routes/          # Protected and public route definitions
│   │   └── services/        # Axios API client
│   ├── tailwind.config.js
│   └── package.json
│
├── telemetry/
│   ├── infra-agent.js       # Standalone host telemetry collector daemon
│   └── prometheus/          # Prometheus configuration
│
├── docker-compose.yml       # Production multi-container composition
├── Dockerfile               # Production container definition
└── README.md
```

---

## ⚡ Quick Start & Local Setup

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **MongoDB**: Running locally on `mongodb://localhost:27017` or a MongoDB Atlas connection string

### 1. Clone & Configure Environment
```bash
git clone https://github.com/YOUR_USERNAME/InfraControl.git
cd InfraControl
```

Configure backend environment variables:
```bash
cp backend/.env.example backend/.env
```

### 2. Start the Backend API
```bash
cd backend
npm install
npm run seed      # Populates development workspace with initial tenants & servers
npm run dev       # Starts Express API server on http://localhost:5000
```

### 3. Start the Frontend Application
```bash
cd ../frontend
npm install
npm run dev       # Starts Vite development server on http://localhost:5173
```

---

## 🐳 Docker Deployment

To launch the complete platform (Backend + Frontend + MongoDB) in a single command:

```bash
docker-compose up -d --build
```

---

## 🔐 Security & Governance

* **Zero Arbitrary Shell Execution:** All operational interventions run strictly via allow-listed, validated operation templates.
* **Authentication Security:** JWT with secure HTTP-only configurations, bcrypt password hashing with automatic salts, and rate limiting against brute-force attacks.
* **Token Isolation:** Host agent tokens are cryptographically hashed; regenerating an agent credential immediately revokes stale access tokens.
* **Strict Scoping:** Multi-tenant query scoping ensures tenants only access data explicitly assigned to their organization.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
