import { useGmailSync } from '../context/GmailSyncContext';

export default function GmailSyncBanner() {
  const { syncing, syncError, lastSync } = useGmailSync();

  if (!syncing && !syncError && !lastSync) return null;

  return (
    <div
      className={`px-4 py-2 text-xs font-semibold text-center border-b ${
        syncError
          ? 'bg-error/10 text-error border-error/20'
          : syncing
            ? 'bg-secondary-container/20 text-secondary border-secondary/20'
            : 'bg-surface-container-low text-on-surface-variant border-outline-variant/10'
      }`}
    >
      {syncing && 'Syncing Gmail…'}
      {!syncing && syncError && `Email sync error: ${syncError}`}
      {!syncing && !syncError && lastSync && `Email synced ${lastSync.toLocaleTimeString()}`}
    </div>
  );
}
