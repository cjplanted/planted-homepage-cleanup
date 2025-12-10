import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card';

/**
 * Venues Page (Placeholder)
 *
 * Browse and manage all venues in the database.
 */
export function VenuesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Venue Browser</h1>
        <p className="text-muted-foreground mt-1">
          Browse and manage all venues
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Venue Browser Content</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Placeholder for venue browser features.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
