const express = require('express');
const cors = require('cors');
const config = require('./config');
const reconcileRouter = require('./routes/reconcile');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', agentId: config.hyland.agentId || 'not configured' });
});

app.use('/api/reconcile', reconcileRouter);

app.listen(config.port, () => {
  console.log(`GOSH Reconciliation API running on http://localhost:${config.port}`);
  if (!config.hyland.agentId) {
    console.warn('WARNING: ANALYST_AGENT_ID is not set in .env');
  }
});
