import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card';

/**
 * Scrape Control Page (Placeholder)
 *
 * Controls for managing scraping operations.
 */
export function ScrapeControlPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Scrape Control</h1>
        <p className="text-muted-foreground mt-1">
          Manage and monitor scraping operations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scrape Control Content</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Placeholder for scrape control features.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
