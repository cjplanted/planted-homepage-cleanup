import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
// New primary pages
import CommandCenterPage from './pages/CommandCenterPage';
import ReviewQueuePage from './pages/ReviewQueuePage';
import DataBrowserPage from './pages/DataBrowserPage';
import OperationsPage from './pages/OperationsPage';
// Legacy pages (kept for backward compatibility)
import VenuesPage from './pages/VenuesPage';
import DishesPage from './pages/DishesPage';
import ScrapersPage from './pages/ScrapersPage';
import PromotionsPage from './pages/PromotionsPage';
import ModerationPage from './pages/ModerationPage';
import PartnersPage from './pages/PartnersPage';
import DiscoveryReviewPage from './pages/DiscoveryReviewPage';
import BudgetMonitoringPage from './pages/BudgetMonitoringPage';
import AnalyticsDashboardPage from './pages/AnalyticsDashboardPage';
import BatchImportPage from './pages/BatchImportPage';

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
        {/* New primary routes */}
        <Route index element={<CommandCenterPage />} />
        <Route path="review" element={<ReviewQueuePage />} />
        <Route path="browser" element={<DataBrowserPage />} />
        <Route path="operations" element={<OperationsPage />} />
        {/* Legacy routes (kept for backward compatibility) */}
        <Route path="venues" element={<VenuesPage />} />
        <Route path="dishes" element={<DishesPage />} />
        <Route path="scrapers" element={<ScrapersPage />} />
        <Route path="promotions" element={<PromotionsPage />} />
        <Route path="moderation" element={<ModerationPage />} />
        <Route path="partners" element={<PartnersPage />} />
        <Route path="discovery-review" element={<DiscoveryReviewPage />} />
        <Route path="budget" element={<BudgetMonitoringPage />} />
        <Route path="analytics" element={<AnalyticsDashboardPage />} />
        <Route path="import" element={<BatchImportPage />} />
      </Route>
    </Routes>
  );
}

export default App;
