import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GmailSyncProvider } from '../context/GmailSyncContext';
import { FullScreenSkeleton } from './shared/Skeleton';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <FullScreenSkeleton />;
  if (!user) return <Navigate to="/login" replace />;
  return <GmailSyncProvider>{children}</GmailSyncProvider>;
}
