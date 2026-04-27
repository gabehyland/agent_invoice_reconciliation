# GOSH Vendor Statement Reconciliation — Build Plan

## 1. Project Overview

**Objective:** Build a web-based demo application that reconciles vendor statements against an invoice registry. A user uploads a vendor statement (PDF), the app sends it along with the invoice registry to the Hyland Agent Builder **Data Analyst Agent**, and displays a reconciliation report identifying matched and missing invoices.

**Target Customer:** Great Ormond Street Hospital (GOSH)

---

## 2. Architecture

```
┌─────────────────────────┐
│     Web Frontend        │
│  (React / Vite)         │
│                         │
│  • Statement upload     │
│  • Report display       │
│  • Status indicators    │
└────────┬────────────────┘
         │  HTTP (upload + poll)
         ▼
┌─────────────────────────┐
│     Backend API         │
│  (Node.js / Express)    │
│                         │
│  • Auth token mgmt      │
│  • File handling         │
│  • Agent invocation      │
│  • Response parsing      │
└────────┬────────────────┘
         │  REST API
         ▼
┌─────────────────────────┐
│  Hyland Agent Builder   │
│  Platform               │
│                         │
│  Data Analyst Agent     │
│  (Tool agent +          │
│   code_execution)       │
└─────────────────────────┘
```

### Component Summary

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | React + Vite + Tailwind CSS | Upload UI, report rendering |
| Backend | Node.js + Express | Auth, file relay, agent invocation |
| Agent | Hyland Agent Builder (Data Analyst) | PDF/XLSX analysis via code execution |

---

## 3. Data Analyst Agent

The Analyst Agent is a pre-configured **Tool agent** on the Hyland Agent Builder platform:

```json
{
  "name": "Data Analyst",
  "description": "An agent that analyzes data and generates visualizations",
  "agentType": "tool",
  "config": {
    "llmModelId": "anthropic.claude-haiku-4-5-20251001-v1:0",
    "systemPrompt": "You are a data analysis assistant. Use the code execution tool to analyze uploaded files, generate visualizations, and provide statistical insights.",
    "tools": [{ "toolType": "code_execution" }]
  }
}
```

**Key Capability:** The `code_execution` tool allows the agent to run Python code at invocation time. This means it can:
- Parse PDF vendor statements (extract invoice numbers, amounts, dates)
- Read the XLSX invoice registry
- Compare the two datasets
- Produce a structured reconciliation report

**Invocation approach:** We will invoke the agent via `POST /v1/agents/{agent_id}/versions/latest/invoke` using the multi-part content format (text prompt + document attachments).

---

## 4. Reference Data

The following files are bundled with the application or pre-loaded at startup:

| File | Type | Role |
|------|------|------|
| `register.xlsx` | Excel | Invoice registry — the source of truth |
| `Suppliers_details .1.xlsx` | Excel | Supplier reference data |
| `Great Ormond Street Hospitals_1010_1054.pdf` | PDF | Sample vendor statement (demo/test) |
| `Statement-300358.pdf` | PDF | Sample vendor statement (demo/test) |

The registry (`register.xlsx`) is treated as a **static reference dataset** that the backend sends to the agent alongside each uploaded statement.

---

## 5. Detailed Feature Spec

### 5.1 Frontend

#### Pages / Views

1. **Upload View**
   - Drag-and-drop or file-picker for vendor statement PDF
   - "Reconcile" button to submit
   - Loading/progress indicator while the agent processes

2. **Report View**
   - Summary metrics: total invoices on statement, matched count, missing count, total value discrepancy
   - **Matched Invoices** table: invoice number, date, amount (statement vs. registry)
   - **Missing from Registry** table: invoices found on the statement but not in the registry
   - **Missing from Statement** table: invoices in the registry for this vendor but not on the statement
   - Option to download the report as CSV or PDF
   - "New Reconciliation" button to return to Upload View

#### UI Considerations
- Colour-coded status: green (matched), red (missing from registry), amber (missing from statement)
- Responsive layout for demo on projector/screen share
- Hyland branding placeholder

### 5.2 Backend API

#### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/reconcile` | Upload statement PDF, triggers agent invocation |
| `GET`  | `/api/reconcile/:id` | Poll for reconciliation result |
| `GET`  | `/api/health` | Health check |

#### `POST /api/reconcile` — Flow

1. Receive uploaded PDF (multipart/form-data)
2. Read the registry file (`register.xlsx`) from server storage
3. Obtain/refresh Hyland IAM bearer token (client credentials grant)
4. Invoke the Data Analyst Agent:
   - Send a message with multi-part content:
     - **Text:** A prompt instructing the agent to reconcile the statement against the registry (see §6)
     - **Document 1:** The uploaded vendor statement PDF (base64 or URL)
     - **Document 2:** The registry XLSX (base64 or URL)
5. Parse the agent response — extract structured reconciliation data
6. Return the report JSON to the frontend

#### Authentication Flow (Hyland IAM)

```
POST https://auth.iam.<ENV>.experience.hyland.com/idp/connect/token
Content-Type: application/x-www-form-urlencoded

client_id=<CLIENT_ID>
client_secret=<CLIENT_SECRET>
scope=hxp environment_authorization
grant_type=client_credentials
```

- Token is cached and refreshed on expiry
- Client ID/secret stored in environment variables (`.env`), never committed

#### Environment Variables

| Variable | Description |
|----------|-------------|
| `HYLAND_CLIENT_ID` | IAM client ID |
| `HYLAND_CLIENT_SECRET` | IAM client secret |
| `HYLAND_ENV` | Environment slug (e.g. `dev`, `staging`) |
| `HYLAND_BASE_URL` | Agent Builder API base URL |
| `ANALYST_AGENT_ID` | Data Analyst agent ID |
| `ANALYST_AGENT_VERSION` | Agent version ID (or `latest`) |
| `PORT` | Server port (default: 3001) |

### 5.3 Agent Invocation Detail

#### Prompt Design

The user message sent to the Data Analyst Agent should instruct it to:

```
You have been given two files:
1. A vendor statement (PDF) — this is a statement from a supplier listing invoices they believe are outstanding.
2. An invoice registry (XLSX) — this is the hospital's internal record of invoices.

Please perform the following reconciliation:

a) Extract all invoice entries from the vendor statement PDF (invoice number, date, amount).
b) Read the invoice registry XLSX.
c) Match invoices by invoice number between the two sources.
d) Identify invoices that appear on the statement but are NOT in the registry (missing from registry).
e) Identify invoices in the registry for this vendor that are NOT on the statement (missing from statement).
f) Calculate total amounts for each category.

Return the results as a JSON object with this structure:
{
  "vendor_name": "...",
  "statement_date": "...",
  "summary": {
    "total_on_statement": <int>,
    "matched": <int>,
    "missing_from_registry": <int>,
    "missing_from_statement": <int>,
    "statement_total": <number>,
    "registry_total": <number>,
    "discrepancy": <number>
  },
  "matched_invoices": [
    { "invoice_number": "...", "date": "...", "statement_amount": <number>, "registry_amount": <number>, "amount_match": <bool> }
  ],
  "missing_from_registry": [
    { "invoice_number": "...", "date": "...", "amount": <number> }
  ],
  "missing_from_statement": [
    { "invoice_number": "...", "date": "...", "amount": <number> }
  ]
}
```

#### Message Format (API Call)

```json
{
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "<reconciliation prompt above>"
        },
        {
          "type": "document",
          "source": { "type": "base64", "media_type": "application/pdf", "data": "<base64-encoded-statement>" }
        },
        {
          "type": "document",
          "source": { "type": "base64", "media_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "data": "<base64-encoded-registry>" }
        }
      ]
    }
  ]
}
```

> **Note:** Verify exact document attachment format against Hyland API behavior. The agent's `code_execution` tool should receive the files and be able to process them with Python (pandas, openpyxl, pdfplumber, etc.).

---

## 6. Project Structure

```
GOSH/
├── buildplan.md                          # This file
├── agent-builder.md                      # Hyland Agent Builder API spec
├── analystagent.txt                      # Data Analyst agent config
├── register.xlsx                         # Invoice registry (reference data)
├── Suppliers_details .1.xlsx             # Supplier details
├── Great Ormond Street Hospitals_1010_1054.pdf  # Sample statement
├── Statement-300358.pdf                  # Sample statement
│
├── backend/
│   ├── package.json
│   ├── .env.example                      # Template for env vars
│   ├── src/
│   │   ├── index.js                      # Express server entry point
│   │   ├── routes/
│   │   │   └── reconcile.js              # /api/reconcile endpoints
│   │   ├── services/
│   │   │   ├── auth.js                   # Hyland IAM token management
│   │   │   ├── agentClient.js            # Agent Builder API client
│   │   │   └── reportParser.js           # Parse agent response → report JSON
│   │   └── config.js                     # Environment config
│   └── data/
│       └── register.xlsx                 # Copy of registry for runtime access
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── src/
    │   ├── App.jsx
    │   ├── main.jsx
    │   ├── components/
    │   │   ├── UploadPanel.jsx            # File upload + submit
    │   │   ├── ReportView.jsx             # Reconciliation report display
    │   │   ├── SummaryCards.jsx            # Metric summary cards
    │   │   ├── InvoiceTable.jsx            # Reusable invoice table
    │   │   └── StatusBadge.jsx             # Match status indicator
    │   ├── services/
    │   │   └── api.js                      # HTTP client for backend
    │   └── styles/
    │       └── index.css                   # Tailwind imports + custom styles
    └── public/
        └── hyland-logo.svg                 # Branding asset placeholder
```

---

## 7. Build Phases

### Phase 1 — Foundation (Backend + Agent Integration)

| # | Task | Detail |
|---|------|--------|
| 1.1 | Project scaffolding | Initialize backend (Express) and frontend (Vite + React) projects |
| 1.2 | Auth service | Implement Hyland IAM client credentials token fetch + caching |
| 1.3 | Agent client | Build wrapper for `POST /v1/agents/{id}/versions/latest/invoke` with document attachments |
| 1.4 | Reconcile endpoint | `POST /api/reconcile` — accept PDF upload, attach registry, call agent, return raw response |
| 1.5 | Test with sample data | Invoke agent with `Great Ormond Street Hospitals_1010_1054.pdf` + `register.xlsx`, validate response |

### Phase 2 — Report Parsing & Frontend

| # | Task | Detail |
|---|------|--------|
| 2.1 | Response parser | Extract structured JSON from agent response; handle edge cases (partial data, errors) |
| 2.2 | Upload UI | Build `UploadPanel` component with drag-and-drop and file validation (PDF only) |
| 2.3 | Report UI | Build `ReportView`, `SummaryCards`, `InvoiceTable` components |
| 2.4 | API integration | Wire frontend to backend `/api/reconcile` endpoint |
| 2.5 | End-to-end test | Upload sample statement through UI → view rendered report |

### Phase 3 — Polish & Demo Readiness

| # | Task | Detail |
|---|------|--------|
| 3.1 | Error handling | Friendly error messages for upload failures, agent timeouts, bad files |
| 3.2 | Loading state | Spinner/progress bar during agent processing (can take 30-60s) |
| 3.3 | Report export | Download reconciliation report as CSV |
| 3.4 | Styling & branding | Apply Hyland/GOSH branding, clean responsive layout |
| 3.5 | Demo script | Prepare a walkthrough script with the two sample statements |

---

## 8. Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent type | Data Analyst (Tool + code_execution) | Can run Python to parse PDFs and XLSX — no need to pre-process files on our backend |
| File transmission | Base64 in message content | Simplest approach; avoids needing Content Lake upload for a demo |
| Auth token storage | In-memory with TTL refresh | Demo app; no persistent session store needed |
| Frontend framework | React + Vite | Fast dev cycle, widely understood, good for demos |
| Streaming | Not used (Phase 1) | Simpler to parse a complete response; streaming can be added later for UX |

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Agent can't parse statement PDF reliably | Bad reconciliation results | Test with both sample PDFs early; refine prompt; consider pre-extracting text if needed |
| File size limits on agent invocation | Upload rejected | Check Hyland API limits; compress or chunk if needed |
| Agent response not in expected JSON format | Frontend can't render report | Build flexible parser with fallback to raw text display |
| Long agent processing time (>60s) | Timeout or bad UX | Implement async pattern (submit → poll); show progress indicator |
| Token expiry mid-request | 401 errors | Auto-refresh token before each invocation; handle 401 with retry |

---

## 10. Out of Scope (for demo)

- User authentication / multi-tenancy
- Persistent storage of reconciliation history
- Editing the registry through the UI
- Automated scheduled reconciliation
- Production deployment / CI/CD

---

## 11. Prerequisites

- [ ] Hyland Agent Builder environment access (client_id + client_secret)
- [ ] Data Analyst Agent created on the platform (agent_id + version_id)
- [ ] Confirmed that the `code_execution` tool can process PDF + XLSX attachments
- [ ] Node.js 18+ installed locally
- [ ] Sample data validated (registry and statements have overlapping invoice numbers for demo)
