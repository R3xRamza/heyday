import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';

export default function TeamExecutiveOps() {
  return (
    <DashboardLayout title="Team Operations" className="p-8">
      <div className="max-w-[1440px] mx-auto">
        <p className="text-on-surface-variant mb-4">
          Team-wide alerts and metrics will appear here.
        </p>
        <Link to="/tasks" className="text-sm text-secondary font-semibold hover:underline">
          Go to Task Hub →
        </Link>
      </div>
    </DashboardLayout>
  );
}
