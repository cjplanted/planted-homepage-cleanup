import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/app/providers/AuthProvider';
import { cn } from '@/lib/utils';
import { LogOut, CheckCircle, Globe, BarChart3, MapPin } from 'lucide-react';
import { Button } from '@/shared/ui/Button';

interface MainLayoutProps {
  children: ReactNode;
}

const tabs = [
  { path: '/', label: 'Approve Queue', icon: CheckCircle },
  { path: '/live-venues', label: 'Live Venues', icon: MapPin },
  { path: '/live', label: 'Sync', icon: Globe },
  { path: '/stats', label: 'Stats', icon: BarChart3 },
];

/**
 * Minimal Layout Component
 *
 * Streamlined layout with 3-tab navigation for the minimal admin dashboard.
 * No sidebar - just a header with tabs and logout.
 */
export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const { signOut } = useAuthContext();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Minimal Header with Tabs */}
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-4 h-14">
          {/* Logo/Brand */}
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-foreground">
              Planted Admin
            </span>
          </div>

          {/* Tab Navigation */}
          <nav className="flex items-center gap-1">
            {tabs.map((tab) => {
              const isActive = location.pathname === tab.path;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          {/* Logout Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
