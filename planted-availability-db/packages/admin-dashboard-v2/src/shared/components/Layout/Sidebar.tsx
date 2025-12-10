import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Search,
  ClipboardCheck,
  RefreshCw,
  Database,
  Globe,
  DollarSign,
  ChevronRight,
} from 'lucide-react';

/**
 * Navigation Item Type
 */
interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Navigation Section Type
 */
interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Navigation Configuration
 */
const navigationSections: NavSection[] = [
  {
    title: 'Workflow',
    items: [
      {
        title: 'Dashboard',
        href: '/',
        icon: LayoutDashboard,
      },
      {
        title: 'Scrape Control',
        href: '/scrape-control',
        icon: Search,
      },
      {
        title: 'Review Queue',
        href: '/review-queue',
        icon: ClipboardCheck,
      },
      {
        title: 'Sync to Website',
        href: '/sync',
        icon: RefreshCw,
      },
    ],
  },
  {
    title: 'Browser',
    items: [
      {
        title: 'Venue Browser',
        href: '/venues',
        icon: Database,
      },
      {
        title: 'Live on Website',
        href: '/live-venues',
        icon: Globe,
      },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        title: 'Cost Monitor',
        href: '/costs',
        icon: DollarSign,
      },
    ],
  },
];

/**
 * Sidebar Component
 *
 * Main navigation sidebar with workflow, browser, and operations sections.
 */
export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col h-full">
      {/* Logo/Brand */}
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold text-foreground">
          Admin Dashboard
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          v2.0
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {navigationSections.map((section) => (
          <div key={section.title}>
            {/* Section Title */}
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
              {section.title}
            </h2>

            {/* Section Items */}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        'hover:bg-accent hover:text-accent-foreground',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{item.title}</span>
                      {isActive && (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          Planted Availability DB
        </p>
      </div>
    </aside>
  );
}
