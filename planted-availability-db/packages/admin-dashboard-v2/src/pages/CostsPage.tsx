import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card';

/**
 * Costs Page (Placeholder)
 *
 * Monitor API costs and usage.
 */
export function CostsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cost Monitor</h1>
        <p className="text-muted-foreground mt-1">
          Monitor API costs and usage statistics
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cost Monitor Content</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Placeholder for cost monitoring features.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
