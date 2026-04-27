export default function SummaryCards({ summary }) {
  if (!summary) return null;

  const cards = [
    { label: 'On Statement', value: summary.total_on_statement, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: 'Matched', value: summary.matched, color: 'bg-green-50 text-green-700 border-green-200' },
    { label: 'Missing from Registry', value: summary.missing_from_registry, color: 'bg-red-50 text-red-700 border-red-200' },
    { label: 'Missing from Statement', value: summary.missing_from_statement, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  ];

  const fmt = (v) => typeof v === 'number' ? v.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' }) : '—';

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-lg border p-4 ${c.color}`}>
            <p className="text-sm font-medium">{c.label}</p>
            <p className="text-2xl font-bold mt-1">{c.value ?? '—'}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="rounded-lg border p-4 bg-gray-50">
          <p className="text-sm text-gray-600">Statement Total</p>
          <p className="text-lg font-semibold">{fmt(summary.statement_total)}</p>
        </div>
        <div className="rounded-lg border p-4 bg-gray-50">
          <p className="text-sm text-gray-600">Registry Total</p>
          <p className="text-lg font-semibold">{fmt(summary.registry_total)}</p>
        </div>
        <div className={`rounded-lg border p-4 ${summary.discrepancy !== 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <p className="text-sm text-gray-600">Discrepancy</p>
          <p className="text-lg font-semibold">{fmt(summary.discrepancy)}</p>
        </div>
      </div>
    </div>
  );
}
