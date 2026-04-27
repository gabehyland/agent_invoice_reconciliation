const axios = require('axios');
const config = require('../config');

let cachedToken = null;
let tokenExpiresAt = 0;

async function getToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const params = new URLSearchParams({
    client_id: config.hyland.clientId,
    client_secret: config.hyland.clientSecret,
    scope: 'hxp environment_authorization',
    grant_type: 'client_credentials',
  });

  const res = await axios.post(config.iamUrl, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  cachedToken = res.data.access_token;
  tokenExpiresAt = now + res.data.expires_in * 1000;
  console.log('Obtained new Hyland IAM token');
  return cachedToken;
}

module.exports = { getToken };
