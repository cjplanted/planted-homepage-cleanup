---
name: breakpoints
description: Use this skill when implementing responsive design, optimizing layouts for different screen sizes, or working on large screen optimizations. Provides the Planted breakpoint system, fluid typography scales, and responsive CSS patterns following 2025 best practices.
---

# Planted Responsive Breakpoint System

This skill provides the comprehensive breakpoint system and responsive design patterns for the Planted website. Use it when creating new components, optimizing existing layouts, or ensuring consistent responsive behavior across all screen sizes.

## Core Principles (2025 Best Practices)

### 1. Mobile-First Approach
Always start with mobile styles as the base, then progressively enhance for larger screens using `min-width` media queries.

### 2. Content-Driven Breakpoints
Choose breakpoints where the design naturally needs adjustment, not arbitrary device sizes. The content should guide the breakpoint selection.

### 3. Fluid over Fixed
Prefer `clamp()`, `min()`, and viewport units over fixed pixel values. This creates smoother scaling and reduces the number of breakpoints needed.

### 4. Test Real Devices
The breakpoints are guidelines. Always test on actual devices and adjust based on real-world behavior.

---

## Official Breakpoint Values

```css
:root {
  /* Standard Breakpoints */
  --bp-sm: 640px;    /* Mobile landscape / Small tablets */
  --bp-md: 768px;    /* Tablets portrait */
  --bp-lg: 1024px;   /* Tablets landscape / Small laptops */
  --bp-xl: 1280px;   /* Standard laptops */
  --bp-2xl: 1440px;  /* Large laptops / Standard desktops */

  /* Large Screen Breakpoints */
  --bp-3xl: 1920px;  /* Full HD / 27" displays */
  --bp-4xl: 2560px;  /* 2K / QHD displays */
  --bp-5xl: 3840px;  /* 4K UHD displays */
}
```

### Media Query Usage

```css
/* Mobile first - base styles for smallest screens */
.component { /* mobile styles */ }

/* Small devices (landscape phones, small tablets) */
@media (min-width: 640px) { }

/* Medium devices (tablets) */
@media (min-width: 768px) { }

/* Large devices (laptops, small desktops) */
@media (min-width: 1024px) { }

/* Extra large (standard desktops) */
@media (min-width: 1280px) { }

/* 2X large (large desktops) */
@media (min-width: 1440px) { }

/* 3X large (27" monitors, Full HD) */
@media (min-width: 1920px) { }

/* 4X large (2K/QHD monitors) */
@media (min-width: 2560px) { }
```

---

## Fluid Typography Scale

Use `clamp()` for typography that scales smoothly between breakpoints.

```css
:root {
  /* Display / Hero Typography */
  --font-hero: clamp(3rem, 5vw + 1.5rem, 8rem);
  /* Min: 48px, Preferred: 5vw + 24px, Max: 128px */

  /* Heading 1 */
  --font-h1: clamp(2.5rem, 4vw + 1rem, 6rem);
  /* Min: 40px, Preferred: 4vw + 16px, Max: 96px */

  /* Heading 2 */
  --font-h2: clamp(1.75rem, 3vw + 0.75rem, 4rem);
  /* Min: 28px, Preferred: 3vw + 12px, Max: 64px */

  /* Heading 3 */
  --font-h3: clamp(1.25rem, 2vw + 0.5rem, 2.5rem);
  /* Min: 20px, Preferred: 2vw + 8px, Max: 40px */

  /* Body Text */
  --font-body: clamp(1rem, 0.5vw + 0.875rem, 1.25rem);
  /* Min: 16px, Preferred: 0.5vw + 14px, Max: 20px */

  /* Small Text */
  --font-small: clamp(0.875rem, 0.3vw + 0.75rem, 1rem);
  /* Min: 14px, Preferred: 0.3vw + 12px, Max: 16px */

  /* Micro Text (labels, badges) */
  --font-micro: clamp(0.75rem, 0.2vw + 0.65rem, 0.875rem);
  /* Min: 12px, Preferred: 0.2vw + 10px, Max: 14px */
}
```

### Usage Example

```css
.hero h1 {
  font-size: var(--font-hero);
  line-height: 0.95;
}

.section-title {
  font-size: var(--font-h2);
}

body {
  font-size: var(--font-body);
}
```

---

## Fluid Spacing Scale

```css
:root {
  /* Section Spacing (between major page sections) */
  --space-section: clamp(4rem, 6vw, 10rem);
  /* Min: 64px, Preferred: 6vw, Max: 160px */

  /* Component Spacing (within sections) */
  --space-component: clamp(2rem, 3vw, 5rem);
  /* Min: 32px, Preferred: 3vw, Max: 80px */

  /* Card Gap (grid/flex gaps) */
  --space-card-gap: clamp(1rem, 2vw, 2rem);
  /* Min: 16px, Preferred: 2vw, Max: 32px */

  /* Content Padding (horizontal page padding) */
  --space-content-padding: clamp(1.5rem, 5vw, 5rem);
  /* Min: 24px, Preferred: 5vw, Max: 80px */
}
```

---

## Container System

```css
:root {
  /* Fixed Containers (for specific layouts) */
  --container-sm: 640px;
  --container-md: 768px;
  --container-lg: 1024px;
  --container-xl: 1280px;
  --container-2xl: 1440px;
  --container-3xl: 1800px;

  /* Fluid Container (recommended for most cases) */
  --container-fluid: min(90vw, 2200px);
}
```

### Container Usage Patterns

```css
/* Standard contained section */
.section-content {
  max-width: var(--container-2xl);
  margin: 0 auto;
  padding: 0 var(--space-content-padding);
}

/* Large screen optimized container */
@media (min-width: 1920px) {
  .section-content {
    max-width: var(--container-3xl);
  }
}

/* Fluid container with constraints */
.full-width-section {
  max-width: var(--container-fluid);
  margin: 0 auto;
}
```

---

## Component Patterns

### Responsive Grid

```css
.card-grid {
  display: grid;
  gap: var(--space-card-gap);
  grid-template-columns: 1fr;
}

@media (min-width: 640px) {
  .card-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .card-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1440px) {
  .card-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (min-width: 1920px) {
  .card-grid {
    grid-template-columns: repeat(5, 1fr);
    gap: clamp(1.5rem, 2.5vw, 3rem);
  }
}
```

### Fluid Card Width

```css
.product-card {
  width: clamp(200px, 22vw, 320px);
}

@media (min-width: 1920px) {
  .product-card {
    width: clamp(280px, 18vw, 400px);
  }
}

@media (min-width: 2560px) {
  .product-card {
    width: clamp(320px, 15vw, 450px);
  }
}
```

### Two-Column Layout

```css
.two-col {
  display: grid;
  gap: var(--space-component);
  grid-template-columns: 1fr;
}

@media (min-width: 1024px) {
  .two-col {
    grid-template-columns: 1fr 1.2fr;
    align-items: center;
  }
}

@media (min-width: 1920px) {
  .two-col {
    gap: clamp(3rem, 5vw, 8rem);
  }
}
```

---

## Large Screen Optimizations

### 27" Display (1920px+)

Key adjustments for 27" and larger displays:

```css
@media (min-width: 1920px) {
  /* Expand containers */
  .main-container {
    max-width: 1800px;
  }

  /* Scale typography */
  h1 {
    font-size: clamp(4rem, 6vw, 7rem);
  }

  /* Increase whitespace */
  section {
    padding: clamp(5rem, 8vw, 10rem) var(--space-content-padding);
  }

  /* Scale interactive elements */
  .btn {
    padding: clamp(1rem, 1.5vw, 1.5rem) clamp(2rem, 3vw, 3rem);
    font-size: clamp(1rem, 0.8vw, 1.25rem);
  }
}
```

### 4K Display (2560px+)

```css
@media (min-width: 2560px) {
  /* Further container expansion */
  .main-container {
    max-width: 2200px;
  }

  /* Hero scaling */
  .hero h1 {
    font-size: clamp(5rem, 5vw, 10rem);
  }

  /* Impact numbers */
  .stat-value {
    font-size: clamp(6rem, 8vw, 12rem);
  }

  /* Grid columns */
  .card-grid {
    grid-template-columns: repeat(6, 1fr);
  }
}
```

---

## Accessibility Requirements

### Touch Targets

```css
/* Minimum touch target: 44px */
.btn, .link, .interactive {
  min-height: 44px;
  min-width: 44px;
}

/* Scale for precision pointer devices on large screens */
@media (min-width: 1920px) and (pointer: fine) {
  .btn {
    padding: clamp(1rem, 1.5vw, 1.5rem) clamp(2rem, 3vw, 3rem);
  }
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### High Contrast

```css
@media (prefers-contrast: high) {
  .card {
    border: 2px solid currentColor;
  }

  .btn {
    border: 2px solid currentColor;
  }
}
```

---

## Testing Checklist

When implementing responsive designs, test at these key viewports:

| Size | Width | Use Case |
|------|-------|----------|
| Mobile | 375px | iPhone SE/13 Mini |
| Mobile L | 428px | iPhone 14 Pro Max |
| Tablet | 768px | iPad Mini |
| Tablet L | 1024px | iPad Pro 11" |
| Laptop | 1440px | MacBook Pro 14" |
| Desktop | 1920px | Full HD Monitor |
| 2K | 2560px | QHD / 27" Retina |
| 4K | 3840px | 4K UHD Monitor |

### Testing Commands

```bash
# Chrome DevTools responsive mode shortcuts:
# Ctrl+Shift+M (Windows) / Cmd+Shift+M (Mac)

# Specific viewport sizes to test:
# 375 x 812 (Mobile)
# 768 x 1024 (Tablet)
# 1440 x 900 (Laptop)
# 1920 x 1080 (Desktop)
# 2560 x 1440 (2K)
```

---

## Common Patterns

### Hero Section

```css
.hero {
  min-height: 100vh;
  min-height: 100dvh; /* Dynamic viewport height */
  padding: clamp(4rem, 8vh, 10rem) var(--space-content-padding);
}

.hero-content {
  max-width: var(--container-2xl);
  margin: 0 auto;
}

@media (min-width: 1920px) {
  .hero-content {
    max-width: var(--container-3xl);
  }
}
```

### Section Padding

```css
.section {
  padding: var(--space-section) var(--space-content-padding);
}
```

### Image Scaling

```css
.responsive-image {
  width: 100%;
  height: auto;
  max-width: 100%;
}

.hero-image {
  max-width: clamp(400px, 50vw, 900px);
}

@media (min-width: 1920px) {
  .hero-image {
    max-width: clamp(500px, 45vw, 1100px);
  }
}
```

---

## Reference Files

- `planted-astro/src/styles/global.css` - CSS variables and global styles
- `planted-astro/src/pages/[locale]/index.astro` - Homepage with responsive patterns
- `todos/breakpoint-improvement-plan.md` - Detailed implementation plan

---

## Quick Reference Card

```
BREAKPOINTS:
sm   640px   Tablets
md   768px   Tablets landscape
lg   1024px  Small laptops
xl   1280px  Laptops
2xl  1440px  Desktops
3xl  1920px  27" monitors
4xl  2560px  2K/QHD

CONTAINERS:
Standard: 1440px
Large:    1800px
Fluid:    min(90vw, 2200px)

TYPOGRAPHY (clamp):
Hero: 3rem → 5vw+1.5rem → 8rem
H1:   2.5rem → 4vw+1rem → 6rem
H2:   1.75rem → 3vw+0.75rem → 4rem
Body: 1rem → 0.5vw+0.875rem → 1.25rem

SPACING (clamp):
Section:   4rem → 6vw → 10rem
Component: 2rem → 3vw → 5rem
Card Gap:  1rem → 2vw → 2rem
```
