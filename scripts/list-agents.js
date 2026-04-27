const path = require('path');
const backendDir = path.resolve(__dirname, '..', 'backend');
const dotenv = require(path.join(backendDir, 'node_modules', 'dotenv'));
const axios = require(path.join(backendDir, 'node_modules', 'axios'));
dotenv.config({ path: path.join(backendDir, '.env') });

const BASE_URL = process.env.HYLAND_BASE_URL;
const IAM_URL = `https://auth.iam.${process.env.HYLAND_ENV}.experience.hyland.com/idp/connect/token`;

async function main() {
  const params = new URLSearchParams({
    client_id: process.env.HYLAND_CLIENT_ID,
    client_secret: process.env.HYLAND_CLIENT_SECRET,
    scope: 'hxp environment_authorization',
    grant_type: 'client_credentials',
  });

  const tokenRes = await axios.post(IAM_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const token = tokenRes.data.access_token;

  // Try lookup by name first
  try {
    const lookup = await axios.post(`${BASE_URL}/v1/agents/lookup`, 
      { name: 'GOSH Reconciliation Analyst' },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    console.log('Found by name:', JSON.stringify(lookup.data, null, 2));
    return;
  } catch (e) {
    console.log('Lookup by name failed, trying list...');
  }

  // List all agents
  const res = await axios.get(`${BASE_URL}/v1/agents?offset=0&limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Response keys:', Object.keys(res.data));
  console.log('Full response:', JSON.stringify(res.data, null, 2));
}

main().catch(e => {
  console.error('Error:', e.response?.status, e.response?.data || e.message);
});
