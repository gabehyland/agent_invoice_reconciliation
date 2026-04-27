# GOSH Invoice Reconciliation

A web application that reconciles vendor statements against an invoice registry using the Hyland Agent Builder platform. Upload a vendor statement PDF, and the AI agent analyses it against the XLSX registry to identify matched, missing, and discrepant invoices.

## Architecture

```
┌──────────────┐       ┌───────────────┐       ┌──────────────────────┐
│  React/Vite  │──────▶│ Node/Express  │──────▶│  Hyland Agent Builder│
│  Frontend    │ /api  │  Backend      │ REST  │  (Code Execution)    │
└──────────────┘       └───────────────┘       └──────────────────────┘
```

- **Frontend** — React 19, Vite 8, Tailwind CSS 4. Drag-and-drop PDF upload with reconciliation report display.
- **Backend** — Express 5. Extracts PDF text, uploads the registry via presigned URL, invokes the Hyland Analyst Agent, and returns structured results.
- **Agent** — Hyland Agent Builder Tool Agent with code execution (Claude Haiku 4.5). Runs Python in a sandbox to parse the registry XLSX and match invoices.

## Prerequisites

- **Node.js** v18+
- **Hyland Agent Builder** credentials (client ID, secret, agent ID)
- A configured agent on the Hyland platform (see [Agent Setup](#agent-setup))

## Project Structure

```
GOSH/
├── backend/                  Node/Express API server
│   ├── src/
│   │   ├── index.js          Entry point
│   │   ├── config.js         Environment config
│   │   ├── routes/
│   │   │   └── reconcile.js  POST /api/reconcile
│   │   └── services/
│   │       ├── auth.js       Hyland IAM token management
│   │       ├── agentClient.js Agent invocation + file upload
│   │       └── reportParser.js Response parsing
│   ├── .env                  Credentials (not committed)
│   └── .env.example          Template
├── frontend/                 React SPA
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── UploadPanel.jsx
│   │   │   ├── ReportView.jsx
│   │   │   ├── SummaryCards.jsx
│   │   │   ├── InvoiceTable.jsx
│   │   │   ├── StatusBadge.jsx
│   │   │   └── ToolCallHistory.jsx
│   │   └── services/
│   │       └── api.js
│   └── vite.config.js
├── scripts/                  Utility scripts
│   ├── create-agent.js       Create the agent on Hyland platform
│   ├── list-agents.js        List/lookup agents
│   ├── test-invoke.js        Test agent invocation
│   └── test-tools.js         Discover agent tools
├── register.xlsx             Invoice registry (sample data)
├── Statement-300358.pdf      Sample vendor statement
├── buildplan.md              Build plan document
└── README.md                 This file
```

## Getting Started

### 1. Clone and install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure environment variables

Copy the example env file and fill in your Hyland credentials:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your values:

```env
HYLAND_CLIENT_ID=your-client-id
HYLAND_CLIENT_SECRET=your-client-secret
HYLAND_ENV=staging
HYLAND_BASE_URL=https://api.agents.ai.staging.experience.hyland.com
ANALYST_AGENT_ID=your-agent-id
ANALYST_AGENT_VERSION=latest
PORT=3005
```

> **Note:** The frontend dev server proxies `/api` requests to port **3005**. Make sure the `PORT` in `.env` matches.

### 3. Place the registry file

Ensure `register.xlsx` is in the project root directory (one level above `backend/`). The backend reads it from `../../register.xlsx` relative to the routes directory.

### 4. Start the backend

```bash
cd backend
npm run dev
```

The server starts on `http://localhost:3005`. Verify with:

```bash
curl http://localhost:3005/api/health
```

### 5. Start the frontend

In a separate terminal:

```bash
cd frontend
npm run dev
```

Vite starts on `http://localhost:5173` (default). Open it in your browser.

### 6. Run a reconciliation

1. Open `http://localhost:5173` in your browser.
2. Drag and drop a vendor statement PDF onto the upload area (or click to browse).
3. Click **Run Reconciliation**.
4. Wait for the agent to process (can take 30–60 seconds).
5. View the report: summary cards, matched/missing invoice tables, agent research note, and tool call history.

## Agent Setup

If you need to create the agent on the Hyland platform:

```bash
cd scripts
node create-agent.js
```

This creates a Tool Agent named "GOSH Reconciliation Analyst" with the `code_execution` tool. Note the agent ID and version from the output, and add them to `backend/.env`.

To verify the agent exists:

```bash
node list-agents.js
```

## Available Scripts

| Location | Command | Description |
|----------|---------|-------------|
| `backend/` | `npm run dev` | Start backend with auto-reload |
| `backend/` | `npm start` | Start backend (production) |
| `frontend/` | `npm run dev` | Start Vite dev server |
| `frontend/` | `npm run build` | Build for production |
| `scripts/` | `node create-agent.js` | Create agent on Hyland platform |
| `scripts/` | `node list-agents.js` | List/lookup agents |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/reconcile` | Upload a statement PDF and get a reconciliation report. Send as `multipart/form-data` with field name `statement`. |

## Troubleshooting

**Backend won't start**
- Check that `backend/.env` exists and has all required values.
- Verify `ANALYST_AGENT_ID` is set (the health endpoint reports this).

**"Invoice registry file not found"**
- Ensure `register.xlsx` is in the project root (not inside `backend/`).

**Agent returns "file not found" in research notes**
- The XLSX upload via presigned URL may have failed. Check backend terminal logs for upload status.
- The agent's sandbox may not find the file at the expected path. The prompt instructs the agent to discover the file location.

**Timeout errors**
- Agent invocations can take up to 3 minutes. The backend timeout is set to 180 seconds.

**Port mismatch**
- The frontend Vite config proxies `/api` to `http://localhost:3005`. Ensure `PORT=3005` in `backend/.env`.
