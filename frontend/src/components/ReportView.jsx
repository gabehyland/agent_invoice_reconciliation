import SummaryCards from './SummaryCards';
import InvoiceTable from './InvoiceTable';
import ToolCallHistory from './ToolCallHistory';

export default function ReportView({ data, onReset }) {
  const { filename, report, research_notes, tool_calls } = data;

  // If the parser returned an error, show raw text
  if (report.error && report.raw_text) {
    return (
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Reconciliation Result</h2>
        <p className="text-sm text-amber-600 mb-2">Could not parse structured data. Raw agent response:</p>
        <pre className="bg-gray-100 rounded-lg p-4 text-sm whitespace-pre-wrap overflow-auto max-h-[60vh]">
          {report.raw_text}
        </pre>
        <button onClick={onReset} className="mt-6 px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors">
          New Reconciliation
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto text-left">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Reconciliation Report</h2>
          <p className="text-gray-500 text-sm mt-1">
            {report.vendor_name && <span className="font-medium text-gray-700">{report.vendor_name}</span>}
            {report.statement_date && <span> — {report.statement_date}</span>}
            {filename && <span> — {filename}</span>}
          </p>
        </div>
        <button onClick={onReset} className="px-4 py-2 bg-gray-200 text-sm rounded-lg hover:bg-gray-300 transition-colors">
          New Reconciliation
        </button>
      </div>

      <SummaryCards summary={report.summary} />

      <InvoiceTable
        title="Missing from Registry"
        invoices={report.missing_from_registry}
        type="missing"
      />

      <InvoiceTable
        title="Matched Invoices"
        invoices={report.matched_invoices}
        type="matched"
      />

      <InvoiceTable
        title="Missing from Statement"
        invoices={report.missing_from_statement}
        type="missing"
      />

      {research_notes && (
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-5">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Agent Research Note</h3>
          <p className="text-sm text-blue-800 whitespace-pre-wrap leading-relaxed">{research_notes}</p>
        </div>
      )}

      <ToolCallHistory calls={tool_calls} />
    </div>
  );
}
