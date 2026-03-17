import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Pages publiques
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import CreateColis from './pages/CreateColis';
import TrackingPage from './pages/TrackingPage';

// Dashboards
import DashboardClient from './dashboard/client/DashboardClient';
import DashboardTransporteur from './dashboard/transporteur/DashboardTransporteur';
import DashboardRelais from './dashboard/relais/DashboardRelais';
import DashboardAdmin from './dashboard/admin/DashboardAdmin';

// Composant de protection des routes
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = React.useContext(AuthContext);
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          <Routes>
            {/* Routes publiques */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/create-colis" element={<CreateColis />} />
            <Route path="/tracking/:colisId" element={<TrackingPage />} />
            
            {/* Dashboard Client */}
            <Route 
              path="/dashboard/client/*" 
              element={
                <ProtectedRoute allowedRoles={['client']}>
                  <DashboardClient />
                </ProtectedRoute>
              } 
            />
            
            {/* Dashboard Transporteur */}
            <Route 
              path="/dashboard/transporteur/*" 
              element={
                <ProtectedRoute allowedRoles={['transporteur']}>
                  <DashboardTransporteur />
                </ProtectedRoute>
              } 
            />
            
            {/* Dashboard Relais */}
            <Route 
              path="/dashboard/relais/*" 
              element={
                <ProtectedRoute allowedRoles={['relais']}>
                  <DashboardRelais />
                </ProtectedRoute>
              } 
            />
            
            {/* Dashboard Admin */}
            <Route 
              path="/dashboard/admin/*" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <DashboardAdmin />
                </ProtectedRoute>
              } 
            />
            
            {/* Route par défaut */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ToastContainer position="top-right" autoClose={3000} />
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
