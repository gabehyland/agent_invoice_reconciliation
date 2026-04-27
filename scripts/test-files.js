/**
 * Test: use upload_file tool to send files, then have agent process them.
 */
const path = require('path');
const fs = require('fs');
const backendDir = path.resolve(__dirname, '..', 'backend');
const dotenv = require(path.join(backendDir, 'node_modules', 'dotenv'));
const axios = require(path.join(backendDir, 'node_modules', 'axios'));
dotenv.config({ path: path.join(backendDir, '.env') });

const BASE_URL = process.env.HYLAND_BASE_URL;
const IAM_URL = `https://auth.iam.${process.env.HYLAND_ENV}.experience.hyland.com/idp/connect/token`;
const AGENT_ID = process.env.ANALYST_AGENT_ID;
const AGENT_VERSION = process.env.ANALYST_AGENT_VERSION;

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
  const token = await getToken();
  console.log('Token obtained.');

  // Read the real files
  const pdfPath = path.resolve(__dirname, '..', 'Statement-300358.pdf');
  const xlsxPath = path.resolve(__dirname, '..', 'register.xlsx');
  
  const pdfBuffer = fs.readFileSync(pdfPath);
  const xlsxBuffer = fs.readFileSync(xlsxPath);
  
  console.log(`PDF size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);
  console.log(`XLSX size: ${(xlsxBuffer.length / 1024).toFixed(1)} KB`);
  console.log(`PDF base64 size: ${(pdfBuffer.toString('base64').length / 1024).toFixed(1)} KB`);
  console.log(`XLSX base64 size: ${(xlsxBuffer.toString('base64').length / 1024).toFixed(1)} KB`);
  
  const pdfB64 = pdfBuffer.toString('base64');
  const xlsxB64 = xlsxBuffer.toString('base64');
  
  // Try sending files via upload_file in the prompt
  const prompt = `I need to reconcile a vendor statement against an invoice registry.

Please use code execution to:
1. First, decode and save these base64 files
2. Parse the PDF vendor statement to extract invoice entries
3. Read the XLSX invoice registry
4. Compare and reconcile them

Here is the vendor statement PDF (base64-encoded):
<file name="statement.pdf" encoding="base64">
${pdfB64}
</file>

Here is the invoice registry XLSX (base64-encoded):
<file name="register.xlsx" encoding="base64">
${xlsxB64}
</file>

After reconciliation, return ONLY a JSON object with this structure:
{
  "vendor_name": "...",
  "statement_date": "...",
  "summary": {
    "total_on_statement": 0,
    "matched": 0,
    "missing_from_registry": 0,
    "missing_from_statement": 0,
    "statement_total": 0,
    "registry_total": 0,
    "discrepancy": 0
  },
  "matched_invoices": [],
  "missing_from_registry": [],
  "missing_from_statement": []
}`;

  console.log(`\nTotal prompt size: ${(Buffer.byteLength(prompt) / 1024).toFixed(1)} KB`);
  
  const url = `${BASE_URL}/v1/agents/${AGENT_ID}/versions/${AGENT_VERSION}/invoke`;
  console.log(`Invoking: ${url}`);
  
  try {
    const res = await axios.post(url, {
      messages: [{ role: 'user', content: prompt }],
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 180000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    console.log('\nSUCCESS!');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.log('\nFAILED:', err.response?.status);
    console.log(JSON.stringify(err.response?.data, null, 2));
  }
}

main().catch(console.error);
