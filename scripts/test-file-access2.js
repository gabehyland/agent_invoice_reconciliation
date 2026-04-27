const path = require('path');
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
  console.log('Token OK');

  // Upload small CSV
  const csv = 'id,name,amount\n1,Test Invoice,100.50\n2,Another,200.75\n';
  const buf = Buffer.from(csv, 'utf-8');
  
  console.log('\n=== Uploading CSV ===');
  const uploadRes = await axios.post(`${BASE_URL}/v1/files`, {
    fileName: 'test.csv',
    contentType: 'text/csv',
    sizeBytes: buf.length,
    isShared: false,
  }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });

  const fileId = uploadRes.data.id;
  const putRes = await axios.put(uploadRes.data.uploadUrl, buf, {
    headers: { 'Content-Type': 'text/csv' },
  });
  console.log('File ID:', fileId, '| PUT status:', putRes.status);

  // Test: invoke with container_upload
  console.log('\n=== Invoking agent with container_upload ===');
  const invokeUrl = `${BASE_URL}/v1/agents/${AGENT_ID}/versions/${AGENT_VERSION}/invoke`;
  
  const body = {
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Read the uploaded CSV file and print its contents. Also run: import os; print("CWD:", os.getcwd()); print("Files in CWD:", os.listdir(".")); print("Files in /tmp:", os.listdir("/tmp"))' },
        { type: 'container_upload', fileId: fileId, fileName: 'test.csv', mediaType: 'text/csv' },
      ],
    }],
  };

  console.log('Body:', JSON.stringify(body, null, 2));

  try {
    const res = await axios.post(invokeUrl, body, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 120000,
    });
    console.log('\n=== Response ===');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.log('\n=== Error ===');
    console.log('Status:', e.response?.status);
    console.log('Data:', JSON.stringify(e.response?.data, null, 2));
    
    // If container_upload fails, try with just string content (no file)
    console.log('\n=== Fallback: invoke WITHOUT container_upload ===');
    const body2 = {
      messages: [{
        role: 'user',
        content: 'Run: import os; print("CWD:", os.getcwd()); print("Files:", os.listdir(".")); print("/tmp:", os.listdir("/tmp"))',
      }],
    };
    try {
      const res2 = await axios.post(invokeUrl, body2, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 120000,
      });
      console.log('Response:', JSON.stringify(res2.data, null, 2));
    } catch (e2) {
      console.log('Also failed:', e2.response?.status, JSON.stringify(e2.response?.data));
    }
  }
}

main().catch(e => console.error('Fatal:', e.message));
