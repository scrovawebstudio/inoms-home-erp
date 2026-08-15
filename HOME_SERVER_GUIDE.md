# 🚀 INOMS Home Server Guide — PostgreSQL Multi-Tenant Architecture

This guide walks you through deploying **INOMS (Inward Outward Management System)** on your Windows Home Server using **Docker Desktop, PostgreSQL 16, and Cloudflare Tunnel**.

---

## 🏗️ 1. Architecture Overview

```text
               User Web Browser / INOMS Client
                             │
                             │ HTTPS (Encrypted)
                             ▼
               Cloudflare Edge / Tunnel
                             │
                             │ Docker Internal Bridge Network (inoms-network)
                             ▼
┌───────────────────────────────────────────────────────────────┐
│ Windows Home Server (Docker Desktop Engine)                   │
│                                                               │
│   ┌─────────────────────────┐     ┌────────────────────────┐  │
│   │ inoms-home (Port 3000)  │────▶│ inoms-postgres         │  │
│   │ Node.js/Express Backend │     │ PostgreSQL 16 Engine   │  │
│   │ React SPA Web App       │     │ (Internal port 5432)   │  │
│   └─────────────────────────┘     └───────────┬────────────┘  │
│                                               │               │
│                                     ┌─────────▼────────────┐  │
│                                     │ postgres_data Volume │  │
│                                     │ (Persistent Storage) │  │
│                                     └──────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

- **Zero Direct PostgreSQL Exposure**: PostgreSQL runs entirely inside the private Docker network (`inoms-network`). Port `5432` is **NOT** exposed to the host or internet.
- **Client Security**: The React frontend connects **only** to the backend API (`/api/*`). Database credentials remain server-side.
- **Tenant Isolation**: Every query enforces `WHERE tenant_id = $1` verified from authenticated session tokens.

---

## 🛠️ 2. Step-by-Step Setup on Windows Home Server

### Step A: Prerequisites
1. Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) with WSL2 enabled.
2. Clone or extract the INOMS project to a directory (e.g. `C:\inoms` or `D:\inoms`).

### Step B: Configure Environment Variables
Create a `.env` file in the project root (or copy `.env.example` to `.env`):

```env
NODE_ENV=production
PORT=3000
MASTER_PIN=814986

# PostgreSQL Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=inoms
DB_USER=inoms_admin
DB_PASSWORD=your_super_secret_strong_password_here
```

### Step C: Start Services with Docker Compose
Open **PowerShell** or **Command Prompt** as Administrator:

```powershell
cd C:\inoms

# Build and start all services in detached mode
docker compose up -d --build
```

Docker Compose will automatically:
1. Provision the **PostgreSQL 16** container (`inoms-postgres`).
2. Run database health checks.
3. Build and launch the **INOMS Backend Server** (`inoms-home`).
4. Execute initial schema migrations (`server/migrations/001_initial_schema.sql`).
5. Migrate existing SQLite / JSON data into PostgreSQL seamlessly with zero data loss.

### Step D: Verify Service Health
1. Open your browser on the home server and navigate to:
   `http://localhost:3000/api/health`
2. You will receive:
   ```json
   {
     "status": "ok",
     "database": "connected",
     "engine": "postgresql",
     "version": "3.0.0",
     "organizations": 2,
     "timestamp": "2026-08-15T05:00:00.000Z"
   }
   ```

---

## 🌐 3. Expose Securely via Cloudflare Tunnel (HTTPS)

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/) -> **Networks** -> **Tunnels**.
2. Click **Create a Tunnel** and name it (e.g. `inoms-tunnel`).
3. Copy your Cloudflare Tunnel Token.
4. In `docker-compose.yml`, uncomment the `cloudflared` block and paste your token:
   ```yaml
   cloudflared:
     image: cloudflare/cloudflared:latest
     container_name: inoms-tunnel
     restart: unless-stopped
     command: tunnel --no-autoupdate run --token YOUR_TOKEN_HERE
     networks:
       - inoms-network
     depends_on:
       - inoms-app
   ```
5. In Cloudflare Tunnel Public Hostname configuration:
   - **Service**: `HTTP`
   - **URL**: `inoms-app:3000`
6. Restart Docker Compose:
   ```powershell
   docker compose up -d
   ```
7. Your app is now accessible worldwide over HTTPS at your custom domain (e.g. `https://inoms.yourdomain.com`).

---

## 💾 4. Production Database Backups (`pg_dump`)

Docker volume storage (`postgres_data`) protects against container recreation, but proper disaster recovery requires regular database dumps.

### One-Command Manual Backup:
```powershell
docker exec -t inoms-postgres pg_dump -U inoms_admin -d inoms -F c -b -v -f /var/lib/postgresql/data/inoms_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump
```

Or export SQL format:
```powershell
docker exec -t inoms-postgres pg_dump -U inoms_admin -d inoms > C:\inoms\backups\inoms_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql
```

### Restore Database from Backup:
```powershell
# Restore from custom format dump
docker exec -i inoms-postgres pg_restore -U inoms_admin -d inoms -v -c /var/lib/postgresql/data/your_backup.dump

# Or restore from SQL script
cat backup.sql | docker exec -i inoms-postgres psql -U inoms_admin -d inoms
```

### Automated Daily Backup via Windows Task Scheduler
Create a `.bat` script (e.g. `C:\inoms\backup.bat`):
```bat
@echo off
set TIMESTAMP=%date:~-4,4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
docker exec -t inoms-postgres pg_dump -U inoms_admin -d inoms -F c -b -f /var/lib/postgresql/data/inoms_backup_%TIMESTAMP%.dump
```
Add this script to Windows Task Scheduler to run nightly at 2:00 AM.
