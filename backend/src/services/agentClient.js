const axios = require('axios');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
const config = require('../config');
const { getToken } = require('./auth');

async function extractPdfText(buffer) {
  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str).join(' ') + '\n';
  }
  return text;
}

const RECONCILIATION_PROMPT = `Use the code execution tool to run a SINGLE Python script that reconciles a vendor statement against an invoice registry. Both files are in the current working directory:
- "invoice-registry.xlsx" — the invoice registry
- "statement.txt" — extracted text from the vendor statement PDF

Run this complete script in ONE code execution call:

import pandas as pd, json, re

# Load registry
df_raw = pd.read_excel("invoice-registry.xlsx", header=None)
header_row = None
for idx in range(10):
    if 'Supplier Code' in df_raw.iloc[idx].astype(str).str.cat(sep=' '):
        header_row = idx
        break
df = pd.read_excel("invoice-registry.xlsx", header=header_row)
df.columns = df.columns.str.strip()

# Load statement
statement_text = open("statement.txt").read()
full_text = " ".join(statement_text.split())

# Parse vendor info
date_match = re.search(r'(\\d{1,2}-[A-Z]{3}-\\d{2,4})', full_text)
statement_date = date_match.group(1) if date_match else ""

# Try INVCE format
inv_matches = re.findall(r'INVCE\\s+(\\d{2}/\\d{2}/\\d{2})\\s+(\\S+)\\s+(?:\\S+\\s+)?([\\d,]+\\.\\d{2})', full_text)
invoices = [{"ref": m[1], "date": m[0], "amount": float(m[2].replace(",",""))} for m in inv_matches]

# Try document number format if no INVCE found
if not invoices:
    doc_matches = re.findall(r'(\\d{7,})\\s+(?:.*?\\s+)?(\\d{1,2}-\\w{3}-\\d{2,4})\\s+([\\d,]+\\.\\d{2})\\s+([\\d,-]+\\.\\d{2})', full_text)
    for m in doc_matches:
        amt = float(m[2].replace(",",""))
        if amt > 0:
            invoices.append({"ref": m[0], "date": m[1], "amount": amt})

# Extract vendor name
vendor_name = ""
v = re.search(r'FAO Credit Controller\\s+(.*?)(?:Viscount|House|Finance|PO Box)', full_text)
if v:
    vendor_name = v.group(1).strip()
if not vendor_name:
    v2 = re.search(r"Account.*?Statement.*?([A-Z][a-z].*?(?:Hospital|Trust|NHS|Ltd|Limited))", full_text)
    if v2:
        vendor_name = v2.group(1).strip()

print(f"Parsed {len(invoices)} invoices, vendor: {vendor_name}, date: {statement_date}")

# Find vendor in registry by first reference
supplier_code = None
for inv in invoices:
    match = df[df["UP Their Reference"].astype(str).str.strip().str.upper() == inv["ref"].strip().upper()]
    if len(match) > 0:
        supplier_code = str(match.iloc[0]["Supplier Code"]).strip()
        vendor_registry_name = str(match.iloc[0]["Supplier Name"]).strip()
        print(f"Found vendor: {vendor_registry_name} (code: {supplier_code}) via ref {inv['ref']}")
        break

if not supplier_code:
    print("ERROR: No matching vendor found in registry")
    print(json.dumps({"error": "Vendor not found", "vendor_name": vendor_name, "statement_date": statement_date, "research_notes": "Could not find any statement invoice references in the registry.", "summary": {"total_on_statement": len(invoices), "matched": 0, "missing_from_registry": len(invoices), "missing_from_statement": 0, "statement_total": sum(i["amount"] for i in invoices), "registry_total": 0, "discrepancy": sum(i["amount"] for i in invoices)}, "matched_invoices": [], "missing_from_registry": [{"invoice_number": i["ref"], "date": i["date"], "amount": i["amount"]} for i in invoices], "missing_from_statement": []}))
else:
    vendor_df = df[df["Supplier Code"].astype(str).str.strip() == supplier_code]
    stmt_refs = {i["ref"].strip().upper() for i in invoices}
    matched, missing_reg = [], []
    for inv in invoices:
        r = vendor_df[vendor_df["UP Their Reference"].astype(str).str.strip().str.upper() == inv["ref"].strip().upper()]
        if len(r) > 0:
            ra = float(r.iloc[0]["UP Gross Value"])
            matched.append({"invoice_number": inv["ref"], "date": inv["date"], "statement_amount": inv["amount"], "registry_amount": ra, "amount_match": abs(inv["amount"]-ra) < 0.01})
        else:
            missing_reg.append({"invoice_number": inv["ref"], "date": inv["date"], "amount": inv["amount"]})
    missing_stmt = []
    for _, row in vendor_df.iterrows():
        ref = str(row["UP Their Reference"]).strip()
        if ref and ref.upper() != "NAN" and ref.upper() not in stmt_refs:
            missing_stmt.append({"invoice_number": ref, "date": "", "amount": float(row["UP Gross Value"]) if pd.notna(row["UP Gross Value"]) else 0})
    st = sum(i["amount"] for i in invoices)
    rt = sum(m["registry_amount"] for m in matched)
    if not vendor_name: vendor_name = vendor_registry_name
    print(json.dumps({"vendor_name": vendor_name, "statement_date": statement_date, "research_notes": f"Reconciled {len(invoices)} statement invoices against {len(vendor_df)} registry entries for {vendor_registry_name} (code {supplier_code}). {len(matched)} matched, {len(missing_reg)} missing from registry, {len(missing_stmt)} missing from statement. Statement total: {st}, Registry matched total: {rt}, Discrepancy: {st-rt}.", "summary": {"total_on_statement": len(invoices), "matched": len(matched), "missing_from_registry": len(missing_reg), "missing_from_statement": len(missing_stmt), "statement_total": st, "registry_total": rt, "discrepancy": st-rt}, "matched_invoices": matched, "missing_from_registry": missing_reg, "missing_from_statement": missing_stmt}))

Return ONLY the JSON output from the print statement. No markdown, no explanation.`;

async function uploadFile(token, fileName, contentType, buffer) {
  const { baseUrl } = config.hyland;

  console.log(`Requesting presigned URL for ${fileName}...`);
  const res = await axios.post(`${baseUrl}/v1/files`, {
    fileName,
    contentType,
    sizeBytes: buffer.length,
    isShared: false,
  }, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const { id, uploadUrl } = res.data;
  console.log(`Got file ID: ${id}, uploading ${(buffer.length / 1024).toFixed(1)} KB...`);
  console.log(`Upload URL domain: ${new URL(uploadUrl).hostname}`);

  const putRes = await axios.put(uploadUrl, buffer, {
    headers: { 'Content-Type': contentType },
    maxBodyLength: Infinity,
  });

  console.log(`Upload response status: ${putRes.status}`);
  console.log(`Uploaded ${fileName} successfully.`);
  return { fileId: id, fileName, mediaType: contentType };
}

async function invokeAnalystAgent(statementBuffer, registryBuffer) {
  const token = await getToken();

  const { agentId, agentVersion, baseUrl } = config.hyland;
  const url = `${baseUrl}/v1/agents/${agentId}/versions/${agentVersion}/invoke`;

  console.log(`Invoking agent at: ${url}`);

  // Extract text from the PDF on our backend (PDF not supported for upload)
  console.log('Extracting text from PDF statement...');
  const statementText = await extractPdfText(statementBuffer);
  console.log(`Extracted ${statementText.length} chars from PDF`);

  // Upload the statement text as a .txt file
  const statementTxtBuffer = Buffer.from(statementText, 'utf-8');
  const statementFile = await uploadFile(
    token,
    'statement.txt',
    'text/plain',
    statementTxtBuffer
  );

  // Upload the XLSX registry via presigned URL (XLSX is supported)
  const registryFile = await uploadFile(
    token,
    'invoice-registry.xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    registryBuffer
  );

  const body = {
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: RECONCILIATION_PROMPT },
          {
            type: 'container_upload',
            fileId: statementFile.fileId,
            fileName: statementFile.fileName,
            mediaType: statementFile.mediaType,
          },
          {
            type: 'container_upload',
            fileId: registryFile.fileId,
            fileName: registryFile.fileName,
            mediaType: registryFile.mediaType,
          },
        ],
      },
    ],
  };

  console.log('Sending reconciliation request to agent...');
  console.log('Files attached:', [statementFile.fileName, registryFile.fileName]);
  const res = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 300_000,
  });

  return res.data;
}

module.exports = { invokeAnalystAgent };
