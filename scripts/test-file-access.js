/**
 * Diagnostic: upload a tiny test file, invoke agent, ask it to list all files it can access.
 */
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
  console.log('Token obtained.\n');

  // Step 1: Upload a tiny CSV test file
  const testContent = 'id,name,amount\n1,Invoice A,100\n2,Invoice B,200\n';
  const testBuffer = Buffer.from(testContent, 'utf-8');

  console.log('--- Uploading test CSV ---');
  const uploadRes = await axios.post(`${BASE_URL}/v1/files`, {
    fileName: 'test-data.csv',
    contentType: 'text/csv',
    sizeBytes: testBuffer.length,
    isShared: false,
  }, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const { id: fileId, uploadUrl } = uploadRes.data;
  console.log('File ID:', fileId);
  console.log('Upload URL received:', !!uploadUrl);

  const putRes = await axios.put(uploadUrl, testBuffer, {
    headers: { 'Content-Type': 'text/csv' },
  });
  console.log('PUT status:', putRes.status);
  console.log('File uploaded successfully.\n');

  // Step 2: Invoke agent — ask it to discover the file
  console.log('--- Invoking agent ---');
  const body = {
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `I have uploaded a CSV file called "test-data.csv". 

Please run this Python code and return the COMPLETE output:

import os
import subprocess

print("=== Current directory ===")
print(os.getcwd())
print()

print("=== os.listdir('.') ===")
print(os.listdir('.'))
print()

print("=== os.listdir('/tmp') ===")
try:
    print(os.listdir('/tmp'))
except:
    print("Cannot access /tmp")
print()

print("=== os.listdir('/home') ===")
try:
    for root, dirs, files in os.walk('/home'):
        for f in files:
            print(os.path.join(root, f))
except:
    print("Cannot access /home")
print()

print("=== Find all files ===")
result = subprocess.run(['find', '/', '-name', '*.csv', '-o', '-name', '*.xlsx'], 
                       capture_output=True, text=True, timeout=10)
print("STDOUT:", result.stdout[:2000])
print("STDERR:", result.stderr[:500])
print()

print("=== Find all files in working dir tree ===")
for root, dirs, files in os.walk('.'):
    for f in files:
        print(os.path.join(root, f))
print()

print("=== Try reading test-data.csv ===")
for try_path in ['test-data.csv', './test-data.csv', '/tmp/test-data.csv', '/home/user/test-data.csv', '/uploads/test-data.csv']:
    if os.path.exists(try_path):
        print(f"FOUND at: {try_path}")
        with open(try_path) as f:
            print(f.read())
        break
else:
    print("File not found at any expected path")

Return the raw output, do not summarize.`,
          },
          {
            type: 'container_upload',
            fileId: fileId,
            fileName: 'test-data.csv',
            mediaType: 'text/csv',
          },
        ],
      },
    ],
  };

  console.log('Request body content types:', body.messages[0].content.map(c => c.type));
  console.log('container_upload:', JSON.stringify(body.messages[0].content[1]));
  console.log();

  const res = await axios.post(
    `${BASE_URL}/v1/agents/${AGENT_ID}/versions/${AGENT_VERSION}/invoke`,
    body,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    }
  );

  console.log('--- Full raw response ---');
  console.log(JSON.stringify(res.data, null, 2));
}

main().catch(err => {
  console.error('Error:', err.message);
  if (err.response) {
    console.error('Status:', err.response.status);
    console.error('Data:', JSON.stringify(err.response.data, null, 2));
  }
});
