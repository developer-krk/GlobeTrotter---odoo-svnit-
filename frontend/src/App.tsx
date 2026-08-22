import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Shell } from './components/Shell';
import { Spinner } from './components/ui';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreateTrip from './pages/CreateTrip';
import MyTrips from './pages/MyTrips';
import ItineraryBuilder from './pages/ItineraryBuilder';
import ItineraryView from './pages/ItineraryView';
import Budget from './pages/Budget';
import Explore from './pages/Explore';
import Calendar from './pages/Calendar';
import Community from './pages/Community';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import PublicTrip from './pages/PublicTrip';

/** Everything inside the app shell needs an account. */
function Private({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="grid min-h-dvh place-items-center"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Shell>{children}</Shell>;
}

/** The admin screens need the admin role on top of that. */
function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user && user.role !== 'admin') return <Navigate to="/" replace />;
  return <Private>{children}</Private>;
}

/** Signed-in people never need to see the sign-in screens. */
function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-dvh place-items-center"><Spinner /></div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />

      {/* A share link works with or without an account. */}
      <Route path="/s/:slug" element={<PublicTrip />} />

      <Route path="/" element={<Private><Dashboard /></Private>} />
      <Route path="/trips" element={<Private><MyTrips /></Private>} />
      <Route path="/trips/new" element={<Private><CreateTrip /></Private>} />
      <Route path="/trips/:id" element={<Private><ItineraryView /></Private>} />
      <Route path="/trips/:id/build" element={<Private><ItineraryBuilder /></Private>} />
      <Route path="/trips/:id/budget" element={<Private><Budget /></Private>} />
      <Route path="/explore" element={<Private><Explore /></Private>} />
      <Route path="/calendar" element={<Private><Calendar /></Private>} />
      <Route path="/community" element={<Private><Community /></Private>} />
      <Route path="/profile" element={<Private><Profile /></Private>} />
      {/* The menu item is called "Profile and settings", so accept both words. */}
      <Route path="/settings" element={<Navigate to="/profile" replace />} />
      <Route path="/admin" element={<AdminOnly><Admin /></AdminOnly>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
