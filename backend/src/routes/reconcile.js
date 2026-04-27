const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { invokeAnalystAgent } = require('../services/agentClient');
const { parseAgentResponse, extractResearchNotes, extractToolCalls } = require('../services/reportParser');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Path to the registry file
const REGISTRY_PATH = path.resolve(__dirname, '..', '..', '..', 'register.xlsx');

router.post('/', upload.single('statement'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No statement file uploaded' });
    }

    if (req.file.mimetype !== 'application/pdf' && !req.file.originalname.endsWith('.pdf')) {
      return res.status(400).json({ error: `Statement must be a PDF file (got ${req.file.mimetype})` });
    }

    // Read the registry
    if (!fs.existsSync(REGISTRY_PATH)) {
      return res.status(500).json({ error: 'Invoice registry file not found on server' });
    }
    const registryBuffer = fs.readFileSync(REGISTRY_PATH);

    console.log(`Reconciling statement: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);

    // Invoke the agent
    const agentResponse = await invokeAnalystAgent(req.file.buffer, registryBuffer);

    // Log raw response structure for debugging
    console.log('Raw output types:', JSON.stringify((agentResponse?.output || []).map(i => ({ type: i.type, contentTypes: (i.content || []).map(c => c.type) }))));

    // Parse the response
    const toolCalls = extractToolCalls(agentResponse);
    const parsed = parseAgentResponse(agentResponse);
    const { report, research_notes } = extractResearchNotes(parsed);

    console.log(`Tool calls found: ${toolCalls.length}`);
    console.log('Raw output types:', JSON.stringify((agentResponse?.output || []).map(i => i.type)));

    res.json({
      filename: req.file.originalname,
      report,
      research_notes,
      tool_calls: toolCalls,
    });
  } catch (err) {
    console.error('Reconciliation error:', err.message);
    if (err.response) {
      console.error('API status:', err.response.status);
      console.error('API response:', JSON.stringify(err.response.data, null, 2));
    }
    const status = err.response?.status || 500;
    const detail = err.response?.data?.message || err.response?.data?.detail || err.message;
    res.status(status).json({ error: 'Reconciliation failed', detail });
  }
});

module.exports = router;
