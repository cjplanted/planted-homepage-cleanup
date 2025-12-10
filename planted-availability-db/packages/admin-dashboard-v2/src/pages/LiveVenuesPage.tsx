import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card';

/**
 * Live Venues Page (Placeholder)
 *
 * View venues currently live on the website.
 */
export function LiveVenuesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Live on Website</h1>
        <p className="text-muted-foreground mt-1">
          View venues currently published on the website
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live Venues Content</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Placeholder for live venues features.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
