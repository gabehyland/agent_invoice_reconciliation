import { useState } from 'react';

function CallItem({ call, index }) {
  const [open, setOpen] = useState(false);

  const label = call.name || call.type;
  const hasDetail = call.arguments || call.output;

  return (
    <li className="border-l-2 border-gray-300 pl-4 py-1">
      <button
        onClick={() => hasDetail && setOpen(!open)}
        className={`flex items-center gap-2 text-sm w-full text-left ${hasDetail ? 'cursor-pointer hover:text-gray-900' : 'cursor-default'}`}
      >
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-[10px] font-bold text-gray-600 shrink-0">
          {index + 1}
        </span>
        <span className="font-medium text-gray-700">{label}</span>
        {call.status && (
          <span className={`text-xs px-1.5 py-0.5 rounded ${call.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {call.status}
          </span>
        )}
        {hasDetail && (
          <span className="ml-auto text-gray-400 text-xs">{open ? '▼' : '▶'}</span>
        )}
      </button>
      {open && hasDetail && (
        <div className="mt-1 ml-7 space-y-1">
          {call.arguments && (
            <pre className="bg-gray-50 rounded p-2 text-xs text-gray-600 overflow-auto max-h-40 whitespace-pre-wrap">
              {typeof call.arguments === 'string' ? call.arguments : JSON.stringify(call.arguments, null, 2)}
            </pre>
          )}
          {call.output && (
            <pre className="bg-gray-50 rounded p-2 text-xs text-gray-600 overflow-auto max-h-40 whitespace-pre-wrap border-l-2 border-green-300">
              {typeof call.output === 'string' ? call.output : JSON.stringify(call.output, null, 2)}
            </pre>
          )}
        </div>
      )}
    </li>
  );
}

export default function ToolCallHistory({ calls }) {
  const [expanded, setExpanded] = useState(false);

  if (!calls || calls.length === 0) return null;

  return (
    <div className="mt-8 border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{expanded ? '▼' : '▶'}</span>
          <h3 className="text-sm font-semibold text-gray-700">Agent Tool Call History</h3>
          <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
            {calls.length} {calls.length === 1 ? 'call' : 'calls'}
          </span>
        </div>
      </button>
      {expanded && (
        <ul className="px-5 py-3 space-y-2">
          {calls.map((call, i) => (
            <CallItem key={call.call_id || i} call={call} index={i} />
          ))}
        </ul>
      )}
    </div>
  );
}
