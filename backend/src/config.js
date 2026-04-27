require('dotenv').config();

const config = {
  port: process.env.PORT || 3001,
  hyland: {
    clientId: process.env.HYLAND_CLIENT_ID,
    clientSecret: process.env.HYLAND_CLIENT_SECRET,
    env: process.env.HYLAND_ENV || 'staging',
    baseUrl: process.env.HYLAND_BASE_URL,
    agentId: process.env.ANALYST_AGENT_ID,
    agentVersion: process.env.ANALYST_AGENT_VERSION || 'latest',
  },
  get iamUrl() {
    return `https://auth.iam.${this.hyland.env}.experience.hyland.com/idp/connect/token`;
  },
};

module.exports = config;
