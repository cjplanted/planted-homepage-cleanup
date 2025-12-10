import { useAuthContext } from '@/app/providers/AuthProvider';
import { Button } from '@/shared/ui/Button';
import { LogOut, User as UserIcon } from 'lucide-react';

/**
 * Header Component
 *
 * Top navigation bar with user information and sign out button.
 */
export function Header() {
  const { user, signOut } = useAuthContext();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
      {/* Left side - could add breadcrumbs or page title here */}
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-foreground">
          {/* Page title will be set by individual pages */}
        </h2>
      </div>

      {/* Right side - User info and actions */}
      <div className="flex items-center gap-4">
        {/* User Info */}
        {user && (
          <div className="flex items-center gap-3 px-4 py-2 bg-muted rounded-lg">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <UserIcon className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {user.displayName || user.email?.split('@')[0] || 'Admin'}
              </span>
              <span className="text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
          </div>
        )}

        {/* Sign Out Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </header>
  );
}
