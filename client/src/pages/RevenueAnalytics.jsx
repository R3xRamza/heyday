import DashboardLayout from '../components/DashboardLayout';

export default function RevenueAnalytics() {
  return (
    <DashboardLayout title="Revenue" className="p-8">
      <div className="max-w-[1440px] mx-auto">
        <p className="text-on-surface-variant">
          Revenue reporting will appear here.
        </p>
      </div>
    </DashboardLayout>
  );
}
