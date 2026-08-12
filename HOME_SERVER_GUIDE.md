# 🚀 Home Server Setup Guide for INOMS RepairTrack ERP

This guide walks you through deploying your INOMS RepairTrack ERP application on your spare Windows machine using Docker Desktop, bypassing Firestore quota limits forever while keeping your organization's live data safe.

---

## 📋 Overview of the Architecture

```
[ Your Windows Home Server ]
   ├── Docker Desktop (WSL2 Engine)
   │     └── Container: repairtrack-erp (Port 3000)
   └── Cloudflare Tunnel (Free & Secure)
         └── https://your-domain.com or trycloudflare URL
               └── Access from any phone/PC anywhere in the world!
```

---

## 🛠️ Step 1: Export Code & Download Live Data

### A. Download Code from AI Studio
1. In AI Studio, click **Settings / Export** (or export to ZIP / GitHub).
2. Save the repository files to a folder on your Windows machine (e.g., `C:\repairtrack-erp`).

### B. Download Live Data Backup
1. Open your live app (`repairtrack.ai.studio`).
2. Log in as Master Admin or Organization Owner.
3. Click **Download Local JSON Backup** (or go to System Master -> Database Backup).
4. Save the `.json` file containing all your live clients, jobs, invoices, products, and ledger data.

---

## 🐳 Step 2: Build & Start the Docker Container

1. Open **PowerShell** or **Command Prompt** as Administrator on your Windows Home Server.
2. Navigate to your project folder:
   ```cmd
   cd C:\repairtrack-erp
   ```
3. Run Docker Compose to build and start the application:
   ```cmd
   docker compose up -d --build
   ```
4. Verify the container is running:
   ```cmd
   docker ps
   ```
5. Test locally on your server by opening your browser at:
   `http://localhost:3000`

---

## 🌐 Step 3: Secure Remote Access (Cloudflare Tunnel)

To access your home server securely from anywhere over HTTPS without opening router ports or exposing your home IP:

1. Create a free account at [Cloudflare Zero Trust](https://one.dash.cloudflare.com/).
2. Go to **Networks** -> **Tunnels** -> **Create a Tunnel**.
3. Name your tunnel (e.g., `repairtrack-home`).
4. Select **Docker** or **Windows** connector and copy your tunnel token.
5. In your `docker-compose.yml`, uncomment the `cloudflared` service and paste your token:
   ```yaml
   cloudflared:
     image: cloudflare/cloudflared:latest
     container_name: repairtrack-tunnel
     restart: unless-stopped
     command: tunnel --no-autoupdate run --token YOUR_TOKEN_HERE
   ```
6. Route traffic in Cloudflare Dashboard:
   - **Public Hostname**: `repairtrack.yourdomain.com` (or free Cloudflare domain)
   - **Service**: `http://repairtrack-erp:3000` (or `http://localhost:3000`)
7. Restart containers:
   ```cmd
   docker compose up -d
   ```

---

## 📥 Step 4: Import Live Data into Home Server

1. Open your new URL (`http://localhost:3000` or `https://repairtrack.yourdomain.com`).
2. Log in with your Organization credentials or Master PIN (`814986`).
3. Go to **Settings / Backup & Restore** or click **Restore from JSON Backup**.
4. Select the `.json` file downloaded in Step 1B.
5. All your live clients, jobs, products, and financial ledger items will immediately restore and persist in your home server!

---

## 🔄 Step 5: Data Persistence & Backup Strategy

- All local app storage and server configurations are kept inside Docker volumes (`repairtrack-data`).
- To schedule automated daily backups on Windows:
  Create a Windows Task Scheduler job running:
  ```cmd
  docker exec repairtrack-erp node dist/server.cjs --backup
  ```
