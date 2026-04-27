/**
 * Test: ask agent what upload tools are available, then try upload_file.
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

  const url = `${BASE_URL}/v1/agents/${AGENT_ID}/versions/${AGENT_VERSION}/invoke`;

  // Ask the agent to list all its tools fully, including upload_file parameters
  const res = await axios.post(url, {
    messages: [{
      role: 'user',
      content: 'List ALL your available tools with their full parameter schemas. Include upload_file, execute_python, and any others. Show the exact JSON function definition for each tool.',
    }],
  }, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 60000,
  });

  // Extract text
  for (const item of res.data.output) {
    if (item.content) {
      for (const block of item.content) {
        if (block.text) console.log(block.text);
      }
    }
  }
}

main().catch(console.error);
