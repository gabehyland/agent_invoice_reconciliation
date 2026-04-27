import { useCallback, useState } from 'react';

export default function UploadPanel({ onResult, onError, onLoading }) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === 'application/pdf') setFile(dropped);
  }, []);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) setFile(selected);
  };

  const handleSubmit = async () => {
    if (!file) return;
    onLoading(true);
    onError(null);
    try {
      const { submitReconciliation } = await import('../services/api');
      const result = await submitReconciliation(file);
      onResult(result);
    } catch (err) {
      onError(err.message);
    } finally {
      onLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <div
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input').click()}
      >
        <input
          id="file-input"
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="text-5xl mb-4">📄</div>
        <p className="text-lg font-medium text-gray-700">
          {file ? file.name : 'Drop vendor statement PDF here'}
        </p>
        <p className="text-sm text-gray-500 mt-2">
          {file
            ? `${(file.size / 1024).toFixed(1)} KB — ready to reconcile`
            : 'or click to browse'}
        </p>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!file}
        className="mt-6 w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        Reconcile Statement
      </button>
    </div>
  );
}
