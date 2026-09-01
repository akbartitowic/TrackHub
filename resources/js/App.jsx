import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import ProjectList from './pages/ProjectList';
import ProjectBoard from './pages/ProjectBoard';
import ProjectBoardDashboard from './pages/ProjectBoardDashboard';
import ProjectBoardGantt from './pages/ProjectBoardGantt';
import ProjectBoardBacklog from './pages/ProjectBoardBacklog';
import ProjectBoardNotes from './pages/ProjectBoardNotes';
import TeamUsers from './pages/TeamUsers';
import ProjectRoles from './pages/ProjectRoles';
import SystemRoles from './pages/SystemRoles';
import SystemSettings from './pages/SystemSettings';
import Profile from './pages/Profile';
import NotificationCenter from './pages/NotificationCenter';
import Announcements from './pages/Announcements';

import Presales from './pages/Presales';
import SystemLogs from './pages/SystemLogs';
import GenerateReport from './pages/GenerateReport';
import TeamLoad from './pages/TeamLoad';
import Review from './pages/Review';
import ReviewConfig from './pages/ReviewConfig';
import PublicReview from './pages/PublicReview';

import Login from './pages/Auth/Login';
import Signup from './pages/Auth/Signup';
import ForceChangePassword from './pages/Auth/ForceChangePassword';
import LoginNotificationsModal from './components/LoginNotificationsModal';
import { useAuth } from './context/AuthContext';
import { getDefaultLandingPath, getRequiredPermissionForPath, hasPermission } from './utils/permissions';

function AuthLoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#000040]">
      <div className="size-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin"></div>
    </div>
  );
}

// Gate for /force-change-password itself: only reachable while logged in AND
// user.password_expired is true, otherwise it's not a valid destination.
function ForceChangePasswordRoute() {
  const { user, loading } = useAuth();

  if (loading) return <AuthLoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.password_expired) return <Navigate to={getDefaultLandingPath(user)} replace />;
  return <ForceChangePassword />;
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoadingSpinner />;

  if (!user) return <Navigate to="/login" replace />;
  // Mandatory 6-month password rotation (User::isPasswordExpired()) overrides everything
  // else in the app — no route under Layout is reachable until the password is changed.
  if (user.password_expired) return <Navigate to="/force-change-password" replace />;
  const requiredPermission = getRequiredPermissionForPath(location.pathname);
  if (requiredPermission && !hasPermission(user, requiredPermission)) {
    const fallbackPath = getDefaultLandingPath(user);
    const fallbackPermission = getRequiredPermissionForPath(fallbackPath);
    const canUseFallback = !fallbackPermission || hasPermission(user, fallbackPermission);
    if (location.pathname === fallbackPath || !canUseFallback) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6 text-center">
          <div>
            <h2 className="text-2xl font-bold mb-2">Access Restricted</h2>
            <p className="text-slate-300">You do not have permission to access this menu.</p>
          </div>
        </div>
      );
    }
    return <Navigate to={fallbackPath} replace />;
  }
  return children;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/force-change-password" element={<ForceChangePasswordRoute />} />
        <Route path="/r/:token" element={<PublicReview />} />

        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="presales/:view?" element={<Presales />} />
          <Route path="create-project" element={<ProjectList />} />
          <Route path="board/:projectId/dashboard" element={<ProjectBoardDashboard />} />
          <Route path="board/:projectId/gantt" element={<ProjectBoardGantt />} />
          <Route path="board/:projectId/backlog" element={<ProjectBoardBacklog />} />
          <Route path="board/:projectId/notes" element={<ProjectBoardNotes />} />
          <Route path="board/:projectId/task/:taskRouteId" element={<ProjectBoard />} />
          <Route path="board/:projectId?" element={<ProjectBoard />} />
          <Route path="team-load" element={<TeamLoad />} />
          <Route path="review" element={<Review />} />
          <Route path="review/config" element={<ReviewConfig />} />
          <Route path="users" element={<TeamUsers />} />
          <Route path="roles" element={<SystemRoles />} />
          <Route path="project-roles" element={<ProjectRoles />} />
          <Route path="settings" element={<SystemSettings />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="profile" element={<Profile />} />
          <Route path="notification-center" element={<NotificationCenter />} />

          <Route path="generate-report" element={<GenerateReport />} />
          <Route path="system-logs" element={<SystemLogs />} />
        </Route>
      </Routes>
      <LoginNotificationsModal />
    </Router>
  );
}

export default App;
