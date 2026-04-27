/**
 * Extracts the structured reconciliation JSON from the agent's response.
 */
function parseAgentResponse(agentResponse) {
  // The agent response follows: { output: [{ content: [{ type: "output_text", text: "..." }] }] }
  const output = agentResponse?.output;
  if (!output || !Array.isArray(output)) {
    return { raw: agentResponse, error: 'Unexpected response structure' };
  }

  // Collect all text fragments from the response
  let fullText = '';
  for (const item of output) {
    if (item.content && Array.isArray(item.content)) {
      for (const block of item.content) {
        if (block.type === 'output_text' && block.text) {
          fullText += block.text;
        }
      }
    }
  }

  if (!fullText) {
    return { raw: agentResponse, error: 'No text content in agent response' };
  }

  // Try to extract JSON from the response text
  try {
    // First try direct parse
    return JSON.parse(fullText.trim());
  } catch {
    // Try to find JSON block in the text (agent may wrap it in markdown)
    const jsonMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        // fall through
      }
    }

    // Try to find a JSON object in the text
    const braceMatch = fullText.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch {
        // fall through
      }
    }

    // Return raw text so the frontend can still display something
    return { raw_text: fullText, error: 'Could not parse JSON from agent response' };
  }
}

function extractResearchNotes(parsed) {
  if (parsed.research_notes) {
    const notes = parsed.research_notes;
    delete parsed.research_notes;
    return { report: parsed, research_notes: notes };
  }
  return { report: parsed, research_notes: null };
}

/**
 * Extracts tool call history from the raw agent response output array.
 * Each item in the output array that isn't the final assistant message is a tool call step.
 */
function extractToolCalls(agentResponse) {
  const output = agentResponse?.output;
  if (!output || !Array.isArray(output)) return [];

  const calls = [];
  for (const item of output) {
    // Capture any item type that represents tool activity
    if (item.type && item.type !== 'message') {
      calls.push({
        type: item.type,
        name: item.name || item.tool || item.type,
        call_id: item.call_id || item.id || null,
        status: item.status || null,
        // For function calls, capture arguments
        arguments: item.arguments || null,
        // For tool outputs, capture the result
        output: item.output || item.text || null,
      });
    } else if (item.type === 'message' && item.content) {
      // Some messages contain tool_use / tool_result blocks in content
      for (const block of item.content) {
        if (block.type && block.type !== 'output_text') {
          calls.push({
            type: block.type,
            name: block.name || block.type,
            call_id: block.id || null,
            status: null,
            arguments: block.input || block.arguments || null,
            output: block.text || block.content || null,
          });
        }
      }
    }
  }
  return calls;
}

module.exports = { parseAgentResponse, extractResearchNotes, extractToolCalls };
