import { useState } from 'react'
import UploadPanel from './components/UploadPanel'
import ReportView from './components/ReportView'

function App() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">GOSH Vendor Statement Reconciliation</h1>
            <p className="text-sm text-gray-500">Powered by Hyland Agent Builder</p>
          </div>
        </div>
      </header>

      <main className="px-6 py-10">
        {result ? (
          <ReportView data={result} onReset={() => { setResult(null); setError(null); }} />
        ) : (
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Upload Vendor Statement</h2>
            <p className="text-gray-500 mb-8">
              Upload a vendor statement PDF to reconcile against the invoice registry.
            </p>

            {loading && (
              <div className="mb-6 flex items-center justify-center gap-3 text-blue-600">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="font-medium">Analyzing statement with AI agent…</span>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <UploadPanel
              onResult={setResult}
              onError={setError}
              onLoading={setLoading}
            />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
