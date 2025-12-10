# Quick Start Guide for Agents

This is a rapid reference guide for agents building on top of the infrastructure.

## Setup (First Time Only)

```bash
# 1. Navigate to package
cd packages/admin-dashboard-v2

# 2. Install dependencies
pnpm install

# 3. Create environment file
cp .env.example .env

# 4. Edit .env with Firebase credentials (ask user if needed)

# 5. Start dev server
pnpm dev
```

Access at: http://localhost:5175

## File Locations Quick Reference

```
Your page file:     src/pages/[PageName]Page.tsx
Your components:    src/pages/[feature]/components/
API client:         src/lib/api/client.ts (import { get, post } from '@/lib/api/client')
API endpoints:      src/lib/api/endpoints.ts (import { API_ENDPOINTS } from '@/lib/api/endpoints')
UI components:      src/shared/ui/
Utils:              src/lib/utils.ts (cn, formatDate, etc.)
Types:              src/types/index.ts
```

## Common Patterns

### 1. Create a Page Component

```typescript
// src/pages/MyPage.tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/Card';

export function MyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Page</h1>
        <p className="text-muted-foreground mt-1">Description</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Content</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Your content */}
        </CardContent>
      </Card>
    </div>
  );
}
```

### 2. Fetch Data with React Query

```typescript
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';
import { LoadingState } from '@/shared/components/LoadingState';
import { ErrorState } from '@/shared/components/ErrorState';

export function MyPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['myData'],
    queryFn: () => get<MyType>(API_ENDPOINTS.MY_ENDPOINT),
  });

  if (isLoading) return <LoadingState message="Loading data..." />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return <div>{/* Render data */}</div>;
}
```

### 3. Mutate Data (POST/PUT/DELETE)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { post } from '@/lib/api/client';
import { Button } from '@/shared/ui/Button';

export function MyComponent() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data) => post(API_ENDPOINTS.MY_ENDPOINT, data),
    onSuccess: () => {
      // Invalidate and refetch queries
      queryClient.invalidateQueries({ queryKey: ['myData'] });
    },
  });

  return (
    <Button
      onClick={() => mutation.mutate({ foo: 'bar' })}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? 'Saving...' : 'Save'}
    </Button>
  );
}
```

### 4. Create a Form

```typescript
import { useState } from 'react';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';

export function MyForm() {
  const [data, setData] = useState({ name: '', email: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Use mutation here
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Name</label>
        <Input
          value={data.name}
          onChange={(e) => setData({ ...data, name: e.target.value })}
        />
      </div>
      <Button type="submit">Submit</Button>
    </form>
  );
}
```

### 5. Show Loading/Empty/Error States

```typescript
import { LoadingState } from '@/shared/components/LoadingState';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { Database } from 'lucide-react';

// Loading
if (isLoading) return <LoadingState message="Loading venues..." />;

// Error
if (error) return <ErrorState error={error} onRetry={refetch} />;

// Empty
if (!data || data.length === 0) {
  return (
    <EmptyState
      icon={Database}
      title="No venues found"
      description="Start by adding your first venue"
      action={{ label: "Add Venue", onClick: handleAdd }}
    />
  );
}
```

### 6. Create a Table

```typescript
import { Card, CardContent } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';

export function MyTable({ data }: { data: Item[] }) {
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-4 font-medium">Name</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="p-4">{item.name}</td>
                <td className="p-4">
                  <Badge variant={item.status === 'active' ? 'success' : 'secondary'}>
                    {item.status}
                  </Badge>
                </td>
                <td className="p-4 text-right">
                  <Button variant="ghost" size="sm">View</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
```

### 7. Use Dialog/Modal

```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/ui/Dialog';
import { Button } from '@/shared/ui/Button';
import { useState } from 'react';

export function MyComponent() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Dialog</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogHeader>
          <div>{/* Dialog content */}</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => { /* action */ }}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

## Available UI Components

```typescript
// Buttons
<Button variant="default | destructive | outline | secondary | ghost | link" size="default | sm | lg | icon">

// Cards
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>

// Badges
<Badge variant="default | secondary | destructive | success | warning | outline">

// Inputs
<Input type="text | email | password | number" placeholder="..." />

// Dialog (see example above)
```

## Available Icons (Lucide React)

```typescript
import {
  Database, Search, Settings, User, AlertCircle,
  Check, X, Loader2, ChevronRight, Plus, Edit,
  Trash, Eye, Download, Upload, RefreshCw
} from 'lucide-react';

<Database className="h-4 w-4" />
```

## Common Utilities

```typescript
import { cn } from '@/lib/utils';

// Merge Tailwind classes
<div className={cn('px-4', isActive && 'bg-blue-500', className)} />

// Format date
import { formatDate, formatRelativeTime } from '@/lib/utils';
formatDate(new Date()) // "Dec 9, 2025, 12:00 PM"
formatRelativeTime(new Date()) // "2 hours ago"
```

## Styling with Tailwind

Use theme variables from `src/index.css`:

```typescript
// Colors
bg-background text-foreground
bg-card text-card-foreground
bg-primary text-primary-foreground
bg-secondary text-secondary-foreground
bg-muted text-muted-foreground
bg-destructive text-destructive-foreground

// Spacing (follows Tailwind)
p-4 m-4 gap-4
space-y-4 space-x-4

// Layout
flex items-center justify-between
grid grid-cols-3 gap-4
```

## Debugging Tips

1. **TypeScript errors**: Run `pnpm typecheck`
2. **API errors**: Check browser console Network tab
3. **Auth issues**: Check Firebase console
4. **Component not rendering**: Check for missing imports
5. **Styling not working**: Make sure Tailwind classes are correct

## Testing Your Page

1. Add route to `src/app/routes/router.tsx` (if not already there)
2. Test in browser
3. Check loading states
4. Check error states
5. Check empty states
6. Test on mobile (responsive design)

## Need Help?

1. Check `INFRASTRUCTURE.md` for detailed technical reference
2. Check existing pages for examples
3. All functions have JSDoc comments
4. TypeScript will guide you

## Commit Your Work

When done:
```bash
git add .
git commit -m "feat: implement [feature name]"
```

---

**Quick Reference Card**:
- API calls: `get()`, `post()`, `put()`, `delete()` from `@/lib/api/client`
- Endpoints: `API_ENDPOINTS.*` from `@/lib/api/endpoints`
- Query: `useQuery({ queryKey, queryFn })`
- Mutation: `useMutation({ mutationFn })`
- Loading: `<LoadingState />`
- Empty: `<EmptyState />`
- Error: `<ErrorState />`
