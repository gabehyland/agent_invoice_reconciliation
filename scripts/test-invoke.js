/**
 * Test script to figure out the correct invocation format for the Data Analyst agent.
 * Tries progressively more complex payloads.
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

async function invoke(token, body, label) {
  const url = `${BASE_URL}/v1/agents/${AGENT_ID}/versions/${AGENT_VERSION}/invoke`;
  console.log(`\n--- Test: ${label} ---`);
  console.log(`URL: ${url}`);
  try {
    const res = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });
    console.log('SUCCESS:', JSON.stringify(res.data, null, 2).slice(0, 500));
    return true;
  } catch (err) {
    console.log('FAILED:', err.response?.status, JSON.stringify(err.response?.data));
    return false;
  }
}

async function main() {
  const token = await getToken();
  console.log('Token obtained.');

  // Test 1: Simple string content
  const ok1 = await invoke(token, {
    messages: [{ role: 'user', content: 'Hello, what can you do?' }],
  }, 'Simple string content');

  if (!ok1) {
    console.log('\nBasic invocation failed. Stopping.');
    return;
  }

  // Test 2: Array content with just text
  await invoke(token, {
    messages: [{
      role: 'user',
      content: [{ type: 'text', text: 'Hello, what tools do you have?' }],
    }],
  }, 'Array content - text only');

  // Test 3: Code execution with small inline data
  await invoke(token, {
    messages: [{
      role: 'user',
      content: 'Use code execution to calculate 2+2 and return the result.',
    }],
  }, 'Code execution - simple math');

  // Test 4: Array content with image_url (small test)
  await invoke(token, {
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'What type of content did I send you?' },
        { type: 'image_url', image_url: { url: 'data:text/plain;base64,SGVsbG8gV29ybGQ=' } },
      ],
    }],
  }, 'Array content - image_url with small base64');

  // Test 5: Small file via code execution
  const smallB64 = Buffer.from('invoice,amount\nINV001,100\nINV002,200').toString('base64');
  await invoke(token, {
    messages: [{
      role: 'user',
      content: `Use code execution to decode this base64 CSV data and show the contents:\n${smallB64}`,
    }],
  }, 'Code execution - decode small base64 CSV');
}

main().catch(console.error);
