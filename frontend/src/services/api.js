const API_BASE = '/api';

export async function submitReconciliation(file) {
  const formData = new FormData();
  formData.append('statement', file);

  const res = await fetch(`${API_BASE}/reconcile`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.detail || err.error || 'Reconciliation failed');
  }

  return res.json();
}
