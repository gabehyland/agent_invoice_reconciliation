import StatusBadge from './StatusBadge';

export default function InvoiceTable({ title, invoices, type }) {
  if (!invoices || invoices.length === 0) {
    return (
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-gray-500 text-sm italic">No invoices in this category.</p>
      </div>
    );
  }

  const fmt = (v) => typeof v === 'number' ? v.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' }) : v ?? '—';

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Invoice #</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
              {type === 'matched' ? (
                <>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Statement Amt</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Registry Amt</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                </>
              ) : (
                <th className="px-4 py-3 text-right font-medium text-gray-600">Amount</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.map((inv, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono">{inv.invoice_number}</td>
                <td className="px-4 py-3">{inv.date || '—'}</td>
                {type === 'matched' ? (
                  <>
                    <td className="px-4 py-3 text-right">{fmt(inv.statement_amount)}</td>
                    <td className="px-4 py-3 text-right">{fmt(inv.registry_amount)}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge match={inv.amount_match} />
                    </td>
                  </>
                ) : (
                  <td className="px-4 py-3 text-right">{fmt(inv.amount)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
