# Sanity CMS Setup for Planted Website

This guide explains how to set up Sanity CMS for managing translations.

## Quick Start

### 1. Create a Sanity Project

1. Go to [sanity.io/manage](https://www.sanity.io/manage)
2. Sign in or create an account
3. Click "Create new project"
4. Name it "planted-website"
5. Select "Production" dataset
6. Note your **Project ID** (looks like `abc123xy`)

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and add your Project ID:

```
PUBLIC_SANITY_PROJECT_ID=your-project-id
PUBLIC_SANITY_DATASET=production
```

### 3. Create a Write Token (for migration)

1. In Sanity dashboard, go to your project
2. Click "API" tab
3. Under "Tokens", click "Add API token"
4. Name it "Migration Token"
5. Select "Editor" permissions
6. Copy the token
7. Add to `.env`:

```
SANITY_WRITE_TOKEN=your-token-here
```

### 4. Migrate Existing Translations

Run the migration script to populate Sanity with your current translations:

```bash
npm run migrate:translations
```

This will create translation documents for all 18 locales.

### 5. Start Sanity Studio

Run Sanity Studio locally:

```bash
npm run sanity:dev
```

Open [http://localhost:3333](http://localhost:3333) to access the translation editor.

## Using Sanity Studio

### Navigation

The Sanity Studio is organized by:

1. **Translations** - Main translation documents
   - Grouped by country (Switzerland, Germany, etc.)
   - Each locale has its own document

2. **Translation Groups** - Within each locale document:
   - Navigation
   - Home Page
   - Products
   - Recipes
   - Footer
   - Common
   - Sustainability
   - Gastronomy
   - News
   - Our Story
   - Store Locator
   - Cookie Consent
   - Newsletter
   - FAQ
   - Press
   - Legal

### Editing Translations

1. Navigate to **Translations** → Select a country → Select a language
2. Click on a group (e.g., "Home Page")
3. Edit the text fields
4. Click "Publish" to save changes

### Tips for Marketing Team

- **Preview changes**: Changes are visible immediately in Sanity Studio
- **Publish to go live**: Click "Publish" to make changes live on the website
- **Drafts**: Changes are saved as drafts until published
- **History**: You can see version history and revert changes

## Deploying Sanity Studio

### Option 1: Sanity Hosted (Free)

Deploy the studio to Sanity's hosting:

```bash
npm run sanity:deploy
```

This gives you a URL like: `https://planted-website.sanity.studio`

### Option 2: Custom Domain

1. Build the studio: `npm run sanity:build`
2. Deploy the `dist/` folder to your hosting

## How It Works

### Build Time

When you run `npm run build`:

1. Astro fetches translations from Sanity
2. Falls back to local TypeScript files if Sanity is unavailable
3. Generates static pages with the translations

### Fallback System

The integration uses a fallback system:

```
Sanity Translation (if exists)
       ↓
Local TypeScript Translation (fallback)
```

This means:
- You can gradually migrate translations to Sanity
- Local files act as defaults
- Sanity overrides local values when present

## Costs

| Plan | Monthly Cost | Users |
|------|--------------|-------|
| Free | $0 | 3 users |
| Growth | $15/user | Unlimited |

For a small marketing team, the **Free plan** should be sufficient.

## Troubleshooting

### "Project not found" error

- Check your `PUBLIC_SANITY_PROJECT_ID` is correct
- Ensure you're using the project ID, not the name

### Migration fails

- Verify `SANITY_WRITE_TOKEN` is set
- Check the token has "Editor" permissions

### Changes not showing on website

1. Make sure you clicked "Publish" in Sanity Studio
2. Rebuild the website: `npm run build`
3. Check the environment variables are set in your deployment

## Support

- Sanity Documentation: [sanity.io/docs](https://www.sanity.io/docs)
- Sanity Slack Community: [slack.sanity.io](https://slack.sanity.io)
