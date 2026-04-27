/**
 * Creates the GOSH Reconciliation Analyst Agent on the Hyland Agent Builder platform.
 * 
 * Usage:  node scripts/create-agent.js
 * 
 * Reads credentials from backend/.env and creates the agent, then prints
 * the agent ID and version ID to plug back into .env.
 */

const path = require('path');

// Resolve dependencies from the backend folder
const backendDir = path.resolve(__dirname, '..', 'backend');
const dotenv = require(path.join(backendDir, 'node_modules', 'dotenv'));
const axios = require(path.join(backendDir, 'node_modules', 'axios'));

dotenv.config({ path: path.join(backendDir, '.env') });

const BASE_URL = process.env.HYLAND_BASE_URL;
const IAM_URL = `https://auth.iam.${process.env.HYLAND_ENV}.experience.hyland.com/idp/connect/token`;

const SYSTEM_PROMPT = `You are a vendor statement reconciliation analyst for Great Ormond Street Hospital (GOSH).

You will receive two files:
1. A vendor statement (PDF) — a statement from a supplier listing invoices they believe are outstanding or paid.
2. An invoice registry (XLSX) — the hospital's internal record of invoices.

Your task is to reconcile these two sources by following these steps:

Step 1 — Extract statement data:
  Parse the vendor statement PDF and extract every invoice entry. For each entry capture: invoice number, date, and amount. Also extract the vendor/supplier name and statement date from the document header.

Step 2 — Read registry data:
  Read the invoice registry XLSX. Identify all columns related to invoice number, date, amount, vendor/supplier name, and payment status.

Step 3 — Match invoices:
  Compare invoices between the statement and registry by invoice number. For matched invoices, note whether the amounts agree.

Step 4 — Identify gaps:
  a) Invoices on the statement that are NOT in the registry (missing from registry).
  b) Invoices in the registry for this vendor that are NOT on the statement (missing from statement).

Step 5 — Summarise:
  Calculate totals for each category and the overall discrepancy.

Return the results as a JSON object with exactly this structure (no other text):
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
}`;

const AGENT_PAYLOAD = {
  name: 'GOSH Reconciliation Analyst',
  description:
    'Reconciles vendor statements against the GOSH invoice registry. Parses PDF statements and XLSX registry data, matches invoices, and identifies discrepancies.',
  agentType: 'tool',
  versionLabel: 'v1.0',
  notes: 'Initial version — statement reconciliation for GOSH demo',
  config: {
    llmModelId: 'anthropic.claude-haiku-4-5-20251001-v1:0',
    systemPrompt: SYSTEM_PROMPT,
    tools: [
      {
        toolType: 'code_execution',
      },
    ],
    inferenceConfig: {
      maxTokens: 8000,
      temperature: 0.1,
    },
  },
};

async function getToken() {
  const params = new URLSearchParams({
    client_id: process.env.HYLAND_CLIENT_ID,
    client_secret: process.env.HYLAND_CLIENT_SECRET,
    scope: 'hxp environment_authorization',
    grant_type: 'client_credentials',
  });

  const res = await axios.post(IAM_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return res.data.access_token;
}

async function main() {
  console.log('Authenticating with Hyland IAM...');
  const token = await getToken();
  console.log('Token obtained.\n');

  console.log('Creating agent: GOSH Reconciliation Analyst');
  console.log(`Endpoint: ${BASE_URL}/v1/agents\n`);

  try {
    const res = await axios.post(`${BASE_URL}/v1/agents`, AGENT_PAYLOAD, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const { id, currentVersionId, name, status } = res.data;

    console.log('Agent created successfully!');
    console.log('─'.repeat(50));
    console.log(`  Name:       ${name}`);
    console.log(`  Status:     ${status}`);
    console.log(`  Agent ID:   ${id}`);
    console.log(`  Version ID: ${currentVersionId}`);
    console.log('─'.repeat(50));
    console.log('\nAdd these to your backend/.env:');
    console.log(`  ANALYST_AGENT_ID=${id}`);
    console.log(`  ANALYST_AGENT_VERSION=${currentVersionId}`);
  } catch (err) {
    console.error('Failed to create agent:');
    if (err.response) {
      console.error(`  Status: ${err.response.status}`);
      console.error(`  Error:  ${JSON.stringify(err.response.data, null, 2)}`);
    } else {
      console.error(`  ${err.message}`);
    }
    process.exit(1);
  }
}

main();
