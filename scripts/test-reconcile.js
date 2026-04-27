/**
 * End-to-end test: full reconciliation with the real statement and registry.
 */
const path = require('path');
const fs = require('fs');
const backendDir = path.resolve(__dirname, '..', 'backend');
const dotenv = require(path.join(backendDir, 'node_modules', 'dotenv'));
const axios = require(path.join(backendDir, 'node_modules', 'axios'));
dotenv.config({ path: path.join(backendDir, '.env') });

// Re-use the backend modules directly
process.chdir(backendDir);
const config = require(path.join(backendDir, 'src', 'config'));
const { getToken } = require(path.join(backendDir, 'src', 'services', 'auth'));
const pdfjsLib = require(path.join(backendDir, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs'));

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

async function main() {
  const token = await getToken();
  console.log('Token OK');

  const { agentId, agentVersion, baseUrl } = config.hyland;
  const invokeUrl = `${baseUrl}/v1/agents/${agentId}/versions/${agentVersion}/invoke`;

  // 1. Extract PDF text
  const pdfPath = path.resolve(__dirname, '..', 'Statement-300358.pdf');
  const pdfBuf = fs.readFileSync(pdfPath);
  console.log('Extracting PDF text...');
  const statementText = await extractPdfText(pdfBuf);
  console.log(`PDF text: ${statementText.length} chars`);
  console.log('Preview:', statementText.slice(0, 200));

  // 2. Upload registry
  const xlsxPath = path.resolve(__dirname, '..', 'register.xlsx');
  const xlsxBuf = fs.readFileSync(xlsxPath);
  console.log(`\nUploading registry (${(xlsxBuf.length/1024).toFixed(1)} KB)...`);
  
  const uploadRes = await axios.post(`${baseUrl}/v1/files`, {
    fileName: 'invoice-registry.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sizeBytes: xlsxBuf.length,
    isShared: false,
  }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });

  const fileId = uploadRes.data.id;
  const putRes = await axios.put(uploadRes.data.uploadUrl, xlsxBuf, {
    headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    maxBodyLength: Infinity,
  });
  console.log('File ID:', fileId, '| PUT:', putRes.status);

  // 3. Build prompt (same as agentClient.js)
  const { invokeAnalystAgent } = require(path.join(backendDir, 'src', 'services', 'agentClient'));
  
  // Actually, let's just call invokeAnalystAgent directly
  console.log('\n=== Invoking reconciliation ===');
  console.log('Time:', new Date().toLocaleTimeString());
  const result = await invokeAnalystAgent(pdfBuf, xlsxBuf);
  console.log('Done:', new Date().toLocaleTimeString());
  
  console.log('\n=== Raw output types ===');
  for (const item of (result.output || [])) {
    console.log(`  type: ${item.type}, status: ${item.status || 'n/a'}`);
    if (item.type === 'function_call') {
      console.log(`    name: ${item.name}, callId: ${item.callId}`);
      // Show truncated arguments
      const args = item.arguments || '';
      console.log(`    args (first 300): ${args.slice(0, 300)}`);
    }
    if (item.content) {
      for (const block of item.content) {
        if (block.type === 'output_text') {
          console.log(`    text (first 500): ${block.text.slice(0, 500)}`);
        }
      }
    }
  }

  // 4. Parse the report
  const { parseAgentResponse, extractResearchNotes } = require(path.join(backendDir, 'src', 'services', 'reportParser'));
  const parsed = parseAgentResponse(result);
  const { report, research_notes } = extractResearchNotes(parsed);

  console.log('\n=== Parsed Report ===');
  console.log(JSON.stringify(report, null, 2));
  console.log('\n=== Research Notes ===');
  console.log(research_notes);
}

main().catch(e => {
  console.error('Error:', e.message);
  if (e.response) {
    console.error('Status:', e.response.status);
    console.error('Data:', JSON.stringify(e.response?.data, null, 2));
  }
});
