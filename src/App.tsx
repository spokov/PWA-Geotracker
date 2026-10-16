import { useAuth } from '@/contexts/AuthContext';
import AuthPage from '@/pages/AuthPage';
import Dashboard from '@/pages/Dashboard';
import { Loader2 } from 'lucide-react';
import { MapPin } from 'lucide-react';

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/20 border border-teal-400/30">
          <MapPin className="w-7 h-7 text-teal-400" />
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
      </div>
    );
  }

  return session ? <Dashboard /> : <AuthPage />;
}
