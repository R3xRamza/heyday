import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SidebarProvider } from './context/SidebarContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import CRMHub from './pages/CRMHub';
import ContactDetail from './pages/ContactDetail';
import TeamTaskOverview from './pages/TeamTaskOverview';
import UserTaskDashboard from './pages/UserTaskDashboard';
import UserProjectDashboard from './pages/UserProjectDashboard';
import MarketingCalendar from './pages/MarketingCalendar';
import RevenueAnalytics from './pages/RevenueAnalytics';
import TransactionManager from './pages/TransactionManager';
import TransactionsList from './pages/TransactionsList';
import ChecklistEditor from './pages/ChecklistEditor';
import TeamExecutiveOps from './pages/TeamExecutiveOps';
import { FullScreenSkeleton } from './components/shared/Skeleton';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenSkeleton />;
  return <Navigate to={user ? '/team-ops' : '/login'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <SidebarProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRedirect />} />
          <Route path="/crm">
            <Route index element={<ProtectedRoute><CRMHub /></ProtectedRoute>} />
            <Route path=":id" element={<ProtectedRoute><ContactDetail /></ProtectedRoute>} />
          </Route>
          <Route path="/tasks">
            <Route index element={<ProtectedRoute><TeamTaskOverview /></ProtectedRoute>} />
            <Route path=":userId/projects" element={<ProtectedRoute><UserProjectDashboard /></ProtectedRoute>} />
            <Route path=":userId/admin" element={<ProtectedRoute><UserTaskDashboard category="admin" /></ProtectedRoute>} />
            <Route path=":userId" element={<ProtectedRoute><UserTaskDashboard category="transaction" /></ProtectedRoute>} />
          </Route>
          <Route path="/marketing" element={<ProtectedRoute><MarketingCalendar /></ProtectedRoute>} />
          <Route path="/revenue" element={<ProtectedRoute><RevenueAnalytics /></ProtectedRoute>} />
          <Route path="/transactions">
            <Route index element={<ProtectedRoute><TransactionsList /></ProtectedRoute>} />
            <Route path=":id" element={<ProtectedRoute><TransactionManager /></ProtectedRoute>} />
          </Route>
          <Route path="/checklists" element={<ProtectedRoute><ChecklistEditor /></ProtectedRoute>} />
          <Route path="/team-ops" element={<ProtectedRoute><TeamExecutiveOps /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </SidebarProvider>
    </AuthProvider>
  );
}
