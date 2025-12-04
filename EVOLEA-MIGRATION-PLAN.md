# EVOLEA Website Migration Plan

## Project Overview

Transform the planted-website Astro framework into the evolea.ch website while:
- Preserving the robust architecture (collections, i18n, animations, components)
- Applying evolea's brand identity and design language
- Simplifying the locale structure (Swiss German focus)
- Optimizing for performance and efficiency

---

## Phase 1: Brand Identity Transformation

### 1.1 Color System Replacement

**Current Planted Colors → New Evolea Colors:**

| Planted | Evolea Replacement | Usage |
|---------|-------------------|-------|
| `#61269E` (purple) | `#2A5F3D` (forest green) | Primary brand color |
| `#8BC53F` (green) | `#4A9B6F` (sage green) | Action/accent |
| `#FFF8F0` (cream) | `#FAFAF8` (warm white) | Background |
| `#FF69B4` (pink) | `#7BA098` (muted teal) | Secondary accent |
| `#FF8C42` (orange) | `#E8C17A` (warm gold) | Highlights |
| `#2D2D2D` (charcoal) | `#2D3B35` (dark forest) | Text dark |
| `#1A1A1A` (black) | `#1A2420` (deep green-black) | Darkest |

**Rationale:** Evolea works with children and nature-based pedagogy. A calming, nature-inspired palette with forest greens and warm earth tones conveys:
- Trust and safety (important for parents)
- Connection to nature (aligned with their programs)
- Professional yet warm (educational setting)

### 1.2 Typography Replacement

**Current Fonts → New Fonts:**

| Current | Replacement | Usage |
|---------|------------|-------|
| VC Henrietta (serif) | **Fraunces** (Google Font) | Display/Headlines - warm, approachable serif |
| Galano Grotesque (sans) | **DM Sans** (Google Font) | Body - clean, readable, modern |

**Why These Fonts:**
- **Fraunces**: A soft, "wonky" serif that feels friendly and approachable - perfect for a children's organization
- **DM Sans**: Clean, highly legible, excellent for body text and UI elements
- **Both are free Google Fonts** - no licensing concerns, easy CDN delivery

### 1.3 Logo & Visual Assets

**Tasks:**
- Download evolea logo from website
- Create favicon from logo
- Update all brand imagery references
- Create new OG image for social sharing

---

## Phase 2: Content Architecture Restructuring

### 2.1 Collections Transformation

**Delete/Archive:**
- `/src/content/products/` (20 product files)
- `/src/content/recipes/` (158 recipe files)
- `/src/content/retailers/` (13 retailer files)

**Keep & Modify:**
- `/src/content/team/` → Update with evolea team members
- `/src/content/news/` → Transform to blog posts
- `/src/content/settings/` → Update global settings

**Create New:**
- `/src/content/services/` → Mini Turnen, Mini Projekte, Mini Garten, etc.
- `/src/content/principles/` → 11 pedagogical principles
- `/src/content/blog/` → Rename from news for clarity

### 2.2 New Content Schemas

**Services Collection Schema:**
```typescript
{
  name: string,           // e.g., "Mini Turnen"
  slug: string,           // e.g., "mini-turnen"
  tagline: string,        // Short description
  description: string,    // Full description
  icon: string,           // Icon identifier
  color: string,          // Card background color
  image: string,          // Hero image
  features: string[],     // Key features/benefits
  ageGroup: string,       // Target age range
  schedule: string,       // When it runs
  location: string,       // Where
  order: number,          // Display order
  isActive: boolean       // Currently offered
}
```

**Principles Collection Schema:**
```typescript
{
  title: string,          // e.g., "Child-Centered Approach"
  description: string,    // Explanation
  icon: string,           // Visual identifier
  order: number           // Display order
}
```

**Blog Collection Schema:**
```typescript
{
  title: string,
  slug: string,
  excerpt: string,
  content: string,        // Markdown content
  image: string,
  date: string,           // ISO date
  author: string,         // Team member reference
  category: string,       // Topic category
  readingTime: number,    // Minutes
  featured: boolean
}
```

**Team Collection Schema (Updated):**
```typescript
{
  name: string,
  role: string,           // e.g., "Co-founder, Psychologist"
  qualifications: string, // e.g., "M.Sc, BCBA"
  bio: string,            // Personal description
  photo: string,
  order: number
}
```

### 2.3 Settings Update

**New Global Settings:**
```json
{
  "siteName": "EVOLEA",
  "tagline": "Wo Kinder sich im Spektrum entfalten können",
  "heroTitle": "EVOLEA",
  "heroSubtitle": "Wo Kinder sich im Spektrum entfalten können",
  "missionTitle": "Unsere Mission",
  "missionText": "Evidenzbasierte, individualisierte Unterstützung für Kinder im Autismus-Spektrum und mit ADHS",
  "email": "hello@evolea.ch",
  "instagram": "https://instagram.com/evolea.verein",
  "whatsapp": "https://chat.whatsapp.com/...",
  "copyright": "© 2025 EVOLEA Verein. Alle Rechte vorbehalten."
}
```

---

## Phase 3: Page & Component Adaptation

### 3.1 Page Structure Transformation

**Delete Pages:**
- `/src/pages/[locale]/products/` (all product pages)
- `/src/pages/[locale]/recipes/` (all recipe pages)
- `/src/pages/[locale]/gastronomy.astro`
- `/src/pages/[locale]/sustainability.astro`

**Keep & Modify:**
- `/src/pages/[locale]/index.astro` → Homepage
- `/src/pages/[locale]/our-story.astro` → Rename to `about.astro` or `ueber-uns.astro`
- `/src/pages/[locale]/news/` → Rename to `/blog/`

**Create New Pages:**
- `/src/pages/[locale]/services/index.astro` → Services overview
- `/src/pages/[locale]/services/[slug].astro` → Individual service pages
- `/src/pages/[locale]/team.astro` → Team page
- `/src/pages/[locale]/contact/[service].astro` → Contact forms per service
- `/src/pages/[locale]/konzept.astro` → Pedagogical concept
- `/src/pages/[locale]/impressum.astro` → Legal/Impressum

### 3.2 Component Modifications

**Navbar.astro:**
- Update logo to evolea
- Change navigation items: Services, Konzept, Team, Blog
- Update colors and styling
- Add prominent contact CTA

**Footer.astro:**
- Update brand info
- Change social links (Instagram, WhatsApp)
- Update legal links
- Simplify country selector (Swiss German focus)

**Layout.astro:**
- Update meta descriptions
- Change theme-color
- Update schema.org data for Organization
- Replace font declarations

**Delete Components:**
- `StoreLocator.astro` (not needed)
- `NewsletterSignup.astro` (optional, may repurpose)
- `CookieConsent.astro` (keep if GDPR needed)

**Create New Components:**
- `ServiceCard.astro` → Service offering cards
- `TeamMember.astro` → Team profile cards
- `PrincipleCard.astro` → Pedagogical principle display
- `BlogCard.astro` → Blog post cards (similar to recipe cards)
- `ContactForm.astro` → Service inquiry forms
- `VideoHero.astro` → Hero with video background

### 3.3 Homepage Sections

**New Homepage Structure:**
1. **Hero** - Video background + tagline + CTA
2. **Mission Statement** - Who we are, what we do
3. **Services Grid** - 4-5 service cards
4. **Approach Preview** - Pedagogical concept teaser
5. **Team Preview** - Founders highlight
6. **Blog Preview** - Latest posts
7. **Contact CTA** - Get in touch section

---

## Phase 4: i18n & Localization Updates

### 4.1 Simplified Locale Structure

**Current (17 locales) → New (2-4 locales):**

Since evolea.ch operates in Zurich canton with German-speaking families:

```typescript
const locales = {
  'de': {
    country: 'ch',
    language: 'de',
    name: 'Deutsch',
    flag: '🇨🇭'
  },
  'en': {
    country: 'ch',
    language: 'en',
    name: 'English',
    flag: '🇨🇭'
  },
};

const defaultLocale = 'de';
```

**Rationale:**
- Primary audience is German-speaking Swiss families
- English optional for international families
- No need for 17 European markets like Planted

### 4.2 Translation Files

**Update `/src/i18n/locales/de.ts`:**
```typescript
export default {
  nav: {
    home: 'Home',
    services: 'Angebote',
    concept: 'Konzept',
    team: 'Team',
    blog: 'Blog',
    contact: 'Kontakt',
  },
  home: {
    hero: {
      title: 'EVOLEA',
      subtitle: 'Wo Kinder sich im Spektrum entfalten können',
      cta: 'Angebote entdecken',
    },
    mission: {
      badge: 'Unsere Mission',
      title: 'Evidenzbasierte Förderung',
      subtitle: 'Individualisierte Unterstützung für Kinder im Autismus-Spektrum und mit ADHS',
    },
    services: {
      title: 'Unsere Angebote',
      subtitle: 'Spezialisierte Programme für jedes Kind',
    },
    team: {
      title: 'Unser Team',
      subtitle: 'Interdisziplinär und erfahren',
    },
    blog: {
      title: 'Blog',
      subtitle: 'Tipps, Einblicke und Neuigkeiten',
    },
  },
  services: {
    miniTurnen: {
      name: 'Mini Turnen',
      tagline: 'Bewegung und Spass',
    },
    miniProjekte: {
      name: 'Mini Projekte',
      tagline: 'Soziale Kompetenz entwickeln',
    },
    miniGarten: {
      name: 'Mini Garten',
      tagline: 'Vorbereitung auf den Kindergarten',
    },
    beratung: {
      name: 'B+U für Schulen',
      tagline: 'Beratung und Unterstützung',
    },
  },
  team: {
    pageTitle: 'Unser Team',
    description: 'Interdisziplinär, erfahren, empathisch',
  },
  contact: {
    title: 'Kontaktieren Sie uns',
    email: 'E-Mail',
    message: 'Nachricht',
    send: 'Senden',
  },
  footer: {
    tagline: 'EVOLEA - Wo Kinder sich entfalten',
    contact: 'Kontakt',
    legal: 'Rechtliches',
    impressum: 'Impressum',
    privacy: 'Datenschutz',
  },
};
```

### 4.3 Remove Planted-Specific i18n

- Delete product name translations
- Delete retailer configurations
- Remove countries not serving (DE, AT, IT, FR, NL, UK, ES)

---

## Phase 5: Performance Optimization

### 5.1 Asset Optimization

**Fonts:**
- Use Google Fonts CDN for Fraunces and DM Sans
- Preload critical font weights only
- Use `font-display: swap` for all fonts

**Images:**
- Convert all images to WebP format
- Implement responsive images with `srcset`
- Lazy load below-fold images
- Optimize hero video (compress to <2MB if possible)

**CSS:**
- Remove unused product card styles
- Remove unused color variants
- Minimize animation complexity for mobile

### 5.2 Build Optimization

**Simplify Static Generation:**
- Reduce from 17 locales to 2
- Fewer pages overall = faster builds
- Remove unused content collections

**Code Splitting:**
- Lazy load blog posts
- Defer non-critical JavaScript
- Use Astro's built-in CSS scoping

### 5.3 Lighthouse Targets

| Metric | Target |
|--------|--------|
| Performance | 95+ |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |

---

## Phase 6: Testing & Deployment

### 6.1 Pre-Launch Checklist

**Functionality:**
- [ ] All pages render correctly
- [ ] Navigation works on all screen sizes
- [ ] Forms submit successfully
- [ ] Blog posts display properly
- [ ] Team page shows all members
- [ ] Service pages have correct content

**Visual:**
- [ ] Colors match brand guidelines
- [ ] Fonts load correctly
- [ ] Animations work smoothly
- [ ] Responsive design verified (mobile, tablet, desktop)
- [ ] Dark mode considerations (if applicable)

**SEO:**
- [ ] All pages have unique titles and descriptions
- [ ] Schema.org data is correct for Organization
- [ ] Sitemap generates correctly
- [ ] Robots.txt is configured
- [ ] OG images work for social sharing

**Performance:**
- [ ] Lighthouse scores meet targets
- [ ] Images are optimized
- [ ] Fonts load efficiently
- [ ] No layout shift (CLS < 0.1)

### 6.2 Deployment Configuration

**Update `astro.config.mjs`:**
```javascript
export default defineConfig({
  site: 'https://evolea.ch',
  base: '/', // No subdirectory for production
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'de',
        locales: { 'de': 'de-CH', 'en': 'en-CH' }
      }
    })
  ]
});
```

---

## Implementation Order

### Step-by-Step Execution:

1. **Brand Foundation** (Phase 1)
   - Update CSS variables with new colors
   - Replace fonts
   - Update Layout.astro meta

2. **Content Cleanup** (Phase 2 - Part 1)
   - Delete planted content files
   - Create new collection schemas
   - Add evolea content

3. **Page Restructuring** (Phase 3 - Part 1)
   - Delete unnecessary pages
   - Create new page templates
   - Update routing

4. **Component Updates** (Phase 3 - Part 2)
   - Modify Navbar
   - Modify Footer
   - Create new components

5. **i18n Simplification** (Phase 4)
   - Update locale config
   - Update translations
   - Remove unused locales

6. **Homepage Build** (Phase 3 - Part 3)
   - Build new homepage sections
   - Add content
   - Test animations

7. **Sub-Pages Build** (Phase 3 - Part 4)
   - Services pages
   - Team page
   - Blog pages
   - Contact pages

8. **Optimization** (Phase 5)
   - Optimize assets
   - Clean up CSS
   - Performance testing

9. **Final Testing** (Phase 6)
   - Full QA pass
   - Cross-browser testing
   - Deployment prep

---

## Files to Create/Modify Summary

### Create New:
- `/src/content/services/*.json` (4-5 files)
- `/src/content/principles/*.json` (11 files)
- `/src/content/blog/*.json` (10 files from existing evolea)
- `/src/pages/[locale]/services/index.astro`
- `/src/pages/[locale]/services/[slug].astro`
- `/src/pages/[locale]/team.astro`
- `/src/pages/[locale]/konzept.astro`
- `/src/pages/[locale]/impressum.astro`
- `/src/pages/[locale]/contact/[service].astro`
- `/src/components/ServiceCard.astro`
- `/src/components/TeamMember.astro`
- `/src/components/PrincipleCard.astro`
- `/src/components/BlogCard.astro`
- `/src/components/ContactForm.astro`
- `/src/components/VideoHero.astro`
- `/public/fonts/` (new font files or CDN links)
- `/public/images/evolea/` (brand images)

### Modify:
- `/src/styles/global.css`
- `/src/layouts/Layout.astro`
- `/src/components/Navbar.astro`
- `/src/components/Footer.astro`
- `/src/i18n/config.ts`
- `/src/i18n/locales/de.ts`
- `/src/i18n/locales/en.ts`
- `/src/content/config.ts`
- `/src/content/settings/global.json`
- `/src/content/team/*.json`
- `/astro.config.mjs`

### Delete:
- `/src/content/products/` (entire directory)
- `/src/content/recipes/` (entire directory)
- `/src/content/retailers/` (entire directory)
- `/src/pages/[locale]/products/` (entire directory)
- `/src/pages/[locale]/recipes/` (entire directory)
- `/src/pages/[locale]/gastronomy.astro`
- `/src/pages/[locale]/sustainability.astro`
- `/src/components/StoreLocator.astro`
- `/public/fonts/VC*.woff*` (old fonts)
- `/public/fonts/Galano*.otf` (old fonts)
- Unused retailer logos

---

## Estimated Scope

- **New files to create:** ~40
- **Files to modify:** ~15
- **Files/directories to delete:** ~200+
- **Net reduction:** Significantly smaller, more focused codebase

This migration will result in a cleaner, faster, and more maintainable website specifically tailored to evolea's needs as a Swiss educational organization serving children with autism spectrum conditions and ADHD.
