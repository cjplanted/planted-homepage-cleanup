import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card';

/**
 * Sync Page (Placeholder)
 *
 * Sync approved venues to the live website.
 */
export function SyncPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sync to Website</h1>
        <p className="text-muted-foreground mt-1">
          Publish approved venues to the live website
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sync Content</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Placeholder for sync features.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
