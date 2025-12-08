import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import VenuesPage from './pages/VenuesPage';
import DishesPage from './pages/DishesPage';
import ScrapersPage from './pages/ScrapersPage';
import PromotionsPage from './pages/PromotionsPage';
import ModerationPage from './pages/ModerationPage';
import PartnersPage from './pages/PartnersPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="venues" element={<VenuesPage />} />
        <Route path="dishes" element={<DishesPage />} />
        <Route path="scrapers" element={<ScrapersPage />} />
        <Route path="promotions" element={<PromotionsPage />} />
        <Route path="moderation" element={<ModerationPage />} />
        <Route path="partners" element={<PartnersPage />} />
      </Route>
    </Routes>
  );
}

export default App;
