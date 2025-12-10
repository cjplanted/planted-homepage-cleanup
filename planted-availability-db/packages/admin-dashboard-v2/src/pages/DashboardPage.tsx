import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card';

/**
 * Dashboard Page (Placeholder)
 *
 * Main dashboard with overview stats and quick actions.
 * This is a placeholder component for Agent 2 to implement.
 */
export function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome to the Admin Dashboard v2
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dashboard Content</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This page will be implemented by Agent 2. It will show:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
            <li>System status and health</li>
            <li>Recent scrape activity</li>
            <li>Review queue summary</li>
            <li>Sync status</li>
            <li>Quick action buttons</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
