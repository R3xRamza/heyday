import DashboardLayout from '../components/DashboardLayout';
import HubDocList from '../components/HubDocList';

export default function HubFeedback() {
  return (
    <DashboardLayout
      title="Feedback"
      subtitle="Shared list for ideas, bugs, and hub edits"
      className="p-8"
    >
      <HubDocList
        section="feedback"
        emptyHint="Nothing here yet. Add bullets for feedback, ideas, or hub edits."
      />
    </DashboardLayout>
  );
}
