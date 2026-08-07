import { useState } from 'react';
import { Download } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import HubDocList from '../components/HubDocList';

export default function HubFeedback() {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  async function downloadAllData() {
    setExportError('');
    setExporting(true);
    try {
      const res = await fetch('/api/export/zip', { credentials: 'include' });
      if (!res.ok) {
        let message = 'Export failed';
        try {
          const json = await res.json();
          if (json?.error) message = json.error;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `heyday-export-${new Date().toISOString().slice(0, 10)}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
    <DashboardLayout
      title="Feedback"
      subtitle="Shared list for ideas, bugs, and hub edits"
      className="p-8"
      headerRight={(
        <button
          type="button"
          onClick={downloadAllData}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider bg-primary-container text-white rounded-lg hover:brightness-110 disabled:opacity-60"
          title="Download CRM, vendors, transactions, tasks, checklists, revenue, and more as CSVs in a ZIP"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'Preparing…' : 'Download all data'}
        </button>
      )}
    >
      {exportError && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {exportError}
        </p>
      )}
      <HubDocList
        section="feedback"
        emptyHint="Nothing here yet. Add bullets for feedback, ideas, or hub edits."
      />
    </DashboardLayout>
  );
}
