import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface MainLayoutProps {
  children: ReactNode;
}

/**
 * Main Layout Component
 *
 * Primary application layout with sidebar navigation and top header.
 * Used for all authenticated pages.
 *
 * Layout structure:
 * - Fixed sidebar on the left (64 units wide)
 * - Header bar at the top (16 units tall)
 * - Main content area that scrolls
 */
export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="h-screen flex bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header />

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
