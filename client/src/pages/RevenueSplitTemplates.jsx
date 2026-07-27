import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import SplitTemplatesPanel from '../components/revenue/SplitTemplatesPanel';

export default function RevenueSplitTemplates() {
  return (
    <DashboardLayout title="Revenue Split Templates" className="bg-surface">
      <div className="w-full px-5 md:px-8 py-6">
        <header className="mb-6">
          <Link
            to="/revenue"
            className="text-xs font-semibold text-secondary hover:underline uppercase tracking-widest mb-2 inline-block"
          >
            ← Back to Revenue
          </Link>
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest">
            Per-agent eXp fees &amp; team splits — used on Revenue and each deal&apos;s Commission tab
          </p>
        </header>

        <SplitTemplatesPanel />
      </div>
    </DashboardLayout>
  );
}
