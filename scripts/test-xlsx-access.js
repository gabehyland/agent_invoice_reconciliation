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
  console.log('Token OK');

  // Upload the actual registry XLSX
  const xlsxPath = path.resolve(__dirname, '..', 'register.xlsx');
  const buf = fs.readFileSync(xlsxPath);
  console.log(`\nRegistry file size: ${(buf.length / 1024).toFixed(1)} KB`);

  console.log('\n=== Uploading XLSX ===');
  const uploadRes = await axios.post(`${BASE_URL}/v1/files`, {
    fileName: 'invoice-registry.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sizeBytes: buf.length,
    isShared: false,
  }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });

  const fileId = uploadRes.data.id;
  const putRes = await axios.put(uploadRes.data.uploadUrl, buf, {
    headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    maxBodyLength: Infinity,
  });
  console.log('File ID:', fileId, '| PUT status:', putRes.status);

  // Invoke with simple file-read prompt
  console.log('\n=== Invoking agent ===');
  const body = {
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'I uploaded an Excel file called "invoice-registry.xlsx". Please run this Python code and show the complete output:\n\nimport os\nprint("CWD:", os.getcwd())\nprint("Files:", os.listdir("."))\n\nimport pandas as pd\ndf = pd.read_excel("invoice-registry.xlsx", header=None)\nprint("Shape:", df.shape)\nprint("First 3 rows:")\nprint(df.head(3))',
        },
        {
          type: 'container_upload',
          fileId: fileId,
          fileName: 'invoice-registry.xlsx',
          mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    }],
  };

  const res = await axios.post(
    `${BASE_URL}/v1/agents/${AGENT_ID}/versions/${AGENT_VERSION}/invoke`,
    body,
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 180000,
    }
  );
  console.log('\n=== Response ===');
  console.log(JSON.stringify(res.data, null, 2));
}

main().catch(e => {
  console.error('Error:', e.message);
  if (e.response) {
    console.error('Status:', e.response.status);
    console.error('Data:', JSON.stringify(e.response?.data, null, 2));
  }
});
