import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import ClientDashboard from '@/pages/dashboard/ClientDashboard';
import TransporteurDashboard from '@/pages/dashboard/TransporteurDashboard';
import RelaisDashboard from '@/pages/dashboard/RelaisDashboard';
import AdminDashboard from '@/pages/dashboard/AdminDashboard';

// Composant de protection des routes
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: UserRole[] }) {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

// Composant pour rediriger vers le bon dashboard
function DashboardRedirect() {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  switch (user?.role) {
    case UserRole.CLIENT:
      return <Navigate to="/dashboard/client" replace />;
    case UserRole.TRANSPORTEUR:
      return <Navigate to="/dashboard/transporteur" replace />;
    case UserRole.RELAIS:
      return <Navigate to="/dashboard/relais" replace />;
    case UserRole.ADMIN:
      return <Navigate to="/dashboard/admin" replace />;
    default:
      return <Navigate to="/" replace />;
  }
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <Routes>
          {/* Routes publiques */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Redirection /dashboard vers le bon dashboard selon le rôle */}
          <Route path="/dashboard" element={<DashboardRedirect />} />
          
          {/* Routes protégées - Dashboard Client */}
          <Route 
            path="/dashboard/client/*" 
            element={
              <ProtectedRoute allowedRoles={[UserRole.CLIENT]}>
                <ClientDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Routes protégées - Dashboard Transporteur */}
          <Route 
            path="/dashboard/transporteur/*" 
            element={
              <ProtectedRoute allowedRoles={[UserRole.TRANSPORTEUR]}>
                <TransporteurDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Routes protégées - Dashboard Point Relais */}
          <Route 
            path="/dashboard/relais/*" 
            element={
              <ProtectedRoute allowedRoles={[UserRole.RELAIS]}>
                <RelaisDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Routes protégées - Dashboard Admin */}
          <Route 
            path="/dashboard/admin/*" 
            element={
              <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Route 404 - Redirection vers l'accueil */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
