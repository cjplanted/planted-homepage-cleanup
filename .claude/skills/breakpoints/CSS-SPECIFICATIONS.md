# CSS Specifications for Large Screen Breakpoints

**Document Version:** 1.0
**Created:** 2025-12-19
**Status:** Ready to Implement

This document provides exact CSS code blocks for implementing large screen breakpoints (1920px and 2560px) on the Planted homepage. All specifications follow the design-brand and breakpoints skills.

---

## Table of Contents

1. [CSS Variables for global.css](#1-css-variables-for-globalcss)
2. [1920px Breakpoint Styles](#2-1920px-breakpoint-styles)
3. [2560px Breakpoint Styles](#3-2560px-breakpoint-styles)
4. [Animation Enhancements](#4-animation-enhancements)
5. [Accessibility Considerations](#5-accessibility-considerations)
6. [Implementation Order](#6-implementation-order)

---

## 1. CSS Variables for global.css

Add these variables to the `:root` block in `planted-astro/src/styles/global.css`:

```css
:root {
    /* ============================================
       EXISTING VARIABLES (keep as-is)
       ============================================ */
    /* ... existing brand colors, spacing scale, animation easing ... */

    /* ============================================
       NEW: Breakpoint Reference Variables
       ============================================ */
    --bp-sm: 640px;    /* Mobile landscape / Small tablets */
    --bp-md: 768px;    /* Tablets portrait */
    --bp-lg: 1024px;   /* Tablets landscape / Small laptops */
    --bp-xl: 1280px;   /* Standard laptops */
    --bp-2xl: 1440px;  /* Large laptops / Standard desktops */
    --bp-3xl: 1920px;  /* Full HD / 27" displays */
    --bp-4xl: 2560px;  /* 2K / QHD displays */
    --bp-5xl: 3840px;  /* 4K UHD displays */

    /* ============================================
       NEW: Fluid Typography Variables
       ============================================ */
    /* Hero / Display Typography */
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

    /* ============================================
       NEW: Fluid Spacing Variables
       ============================================ */
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

    /* ============================================
       NEW: Container Width Variables
       ============================================ */
    --container-sm: 640px;
    --container-md: 768px;
    --container-lg: 1024px;
    --container-xl: 1280px;
    --container-2xl: 1440px;
    --container-3xl: 1800px;  /* For 1920px+ screens */
    --container-4xl: 2100px;  /* For 2560px+ screens */
    --container-5xl: 2400px;  /* For 3840px+ screens */
    --container-fluid: min(90vw, 2200px);  /* Fluid max with constraint */
}
```

---

## 2. 1920px Breakpoint Styles

Add these media query blocks to the relevant component style sections.

### 2.1 Hero Section (1920px)

Add to `planted-astro/src/pages/[locale]/index.astro` style block:

```css
/* ============================================
   LARGE SCREEN: 1920px+ (27" displays)
   ============================================ */
@media (min-width: 1920px) {
    /* Hero Container Expansion */
    .hero-container {
        max-width: 1800px;
    }

    /* Hero Headline Scaling */
    .hero-headline h1 {
        font-size: clamp(4rem, 6vw, 140px);
    }

    /* Hero Subheadline Scaling */
    .hero-subheadline {
        font-size: clamp(1.1rem, 1.2vw, 1.5rem);
        max-width: 600px;
    }

    /* Hero Grid Gap */
    .hero-grid {
        gap: clamp(3rem, 5vw, 8rem);
    }

    /* TV Frame Scale */
    .tv-frame {
        transform: rotate(-2deg) scale(1.1);
    }

    /* Badge Enhancement */
    .beweisstueck-badge {
        font-size: clamp(0.7rem, 0.8vw, 0.9rem);
        padding: 0.5rem 1.25rem;
    }

    /* Button Scaling */
    .hero .btn {
        padding: clamp(1rem, 1.2vw, 1.5rem) clamp(1.75rem, 2.5vw, 2.5rem);
        font-size: clamp(1rem, 0.9vw, 1.15rem);
    }
}
```

### 2.2 Products Carousel (1920px)

```css
@media (min-width: 1920px) {
    /* Products Container */
    .products-container {
        max-width: 1800px;
    }

    /* Product Card Width */
    .product-card {
        width: clamp(280px, 16vw, 380px);
    }

    /* Product Image Height */
    .product-card-inner {
        height: clamp(264px, 18vw, 360px);
    }

    /* Product Card Spacing */
    .products-scroll {
        gap: clamp(24px, 2.5vw, 48px);
    }

    /* Product Name Scaling */
    .product-name {
        font-size: clamp(1.3rem, 1.3vw, 1.6rem);
    }

    /* Product Variant Scaling */
    .product-variant {
        font-size: clamp(1rem, 1vw, 1.2rem);
    }

    /* NEW Badge Scaling */
    .product-badge-new {
        font-size: clamp(0.65rem, 0.6vw, 0.8rem);
        padding: 0.4rem 0.85rem;
    }
}
```

### 2.3 Impact Section (1920px)

```css
@media (min-width: 1920px) {
    /* Impact Container */
    .impact-container {
        max-width: 1800px;
    }

    /* Impact Stat Value - Dramatic Scaling */
    .impact-stat-value,
    .stat-value {
        font-size: clamp(5rem, 10vw, 10rem);
    }

    /* Impact Stat Label */
    .impact-stat-label,
    .stat-label {
        font-size: clamp(1rem, 1.1vw, 1.4rem);
    }

    /* Impact Tagline */
    .impact-tagline {
        font-size: clamp(2rem, 4vw, 4.5rem);
    }

    /* Impact Stats Gap */
    .impact-stats {
        gap: clamp(24px, 4vw, 80px);
    }

    /* Floating Elements Scale */
    .impact-float {
        transform: scale(1.3);
    }

    /* Floating Cow Scale */
    .floating-cow {
        width: clamp(120px, 10vw, 180px);
    }

    /* Floating Plant Scale */
    .floating-plant {
        width: clamp(80px, 7vw, 120px);
    }
}
```

### 2.4 Trust Stats Section (1920px)

```css
@media (min-width: 1920px) {
    /* Trust Stats Container */
    .trust-stats-inner {
        max-width: 1000px;
        gap: 6rem;
    }

    /* Trust Stat Value */
    .trust-stat-value {
        font-size: clamp(2.5rem, 5vw, 4rem);
    }

    /* Trust Stat Label */
    .trust-stat-label {
        font-size: clamp(1rem, 1vw, 1.25rem);
    }
}
```

### 2.5 Statement Section (1920px)

```css
@media (min-width: 1920px) {
    /* Statement Container */
    .statement-inner {
        max-width: 1000px;
    }

    /* Statement Heading */
    .statement h2 {
        font-size: clamp(2.5rem, 5vw, 4.5rem);
    }

    /* Statement Body */
    .statement p {
        font-size: clamp(1.1rem, 1.2vw, 1.4rem);
    }
}
```

### 2.6 Recipes Section (1920px)

```css
@media (min-width: 1920px) {
    /* Recipes Container */
    .recipes-container {
        max-width: 1800px;
    }

    /* Recipes Grid Gap */
    .recipes-grid {
        gap: clamp(1.5rem, 2vw, 3rem);
    }

    /* Recipe Title */
    .recipe-title {
        font-size: clamp(1.2rem, 1.2vw, 1.5rem);
    }

    /* Recipe Meta */
    .recipe-meta {
        font-size: clamp(0.85rem, 0.9vw, 1rem);
    }

    /* Recipe Tag */
    .recipe-tag {
        font-size: clamp(0.75rem, 0.7vw, 0.9rem);
    }
}
```

### 2.7 Business Section (1920px)

```css
@media (min-width: 1920px) {
    /* Business Card Container */
    .business-card {
        max-width: 1500px;
    }

    /* Business Heading */
    .business h2 {
        font-size: clamp(2rem, 3.5vw, 3.5rem);
    }

    /* Business Description */
    .business p {
        font-size: clamp(1.1rem, 1.2vw, 1.4rem);
    }

    /* Business Stat Value */
    .business-stat-value {
        font-size: clamp(2.5rem, 4vw, 4rem);
    }
}
```

### 2.8 Footer (1920px)

```css
@media (min-width: 1920px) {
    /* Footer Container */
    .footer-container {
        max-width: 1200px;
    }

    /* Footer Link Size */
    .footer-link {
        font-size: clamp(0.9rem, 0.9vw, 1.1rem);
    }

    /* Footer Heading */
    .footer-heading {
        font-size: clamp(1rem, 1vw, 1.25rem);
    }
}
```

---

## 3. 2560px Breakpoint Styles

### 3.1 Hero Section (2560px)

```css
/* ============================================
   EXTRA LARGE SCREEN: 2560px+ (2K/QHD displays)
   ============================================ */
@media (min-width: 2560px) {
    /* Hero Container Expansion */
    .hero-container {
        max-width: 2100px;
    }

    /* Hero Headline - Maximum Impact */
    .hero-headline h1 {
        font-size: clamp(5rem, 5vw, 180px);
    }

    /* Hero Subheadline */
    .hero-subheadline {
        font-size: clamp(1.3rem, 1vw, 1.75rem);
        max-width: 700px;
    }

    /* Hero Grid Gap */
    .hero-grid {
        gap: clamp(4rem, 6vw, 10rem);
    }

    /* TV Frame Scale */
    .tv-frame {
        transform: rotate(-2deg) scale(1.2);
    }

    /* Button Scaling */
    .hero .btn {
        padding: clamp(1.25rem, 1.5vw, 1.75rem) clamp(2rem, 3vw, 3rem);
        font-size: clamp(1.1rem, 1vw, 1.3rem);
    }
}
```

### 3.2 Products Carousel (2560px)

```css
@media (min-width: 2560px) {
    /* Products Container */
    .products-container {
        max-width: 2200px;
    }

    /* Product Card Width */
    .product-card {
        width: clamp(320px, 14vw, 420px);
    }

    /* Product Image Height */
    .product-card-inner {
        height: clamp(300px, 16vw, 420px);
    }

    /* Product Card Spacing */
    .products-scroll {
        gap: clamp(32px, 2vw, 56px);
    }

    /* Product Name Scaling */
    .product-name {
        font-size: clamp(1.5rem, 1.2vw, 1.8rem);
    }
}
```

### 3.3 Impact Section (2560px)

```css
@media (min-width: 2560px) {
    /* Impact Container */
    .impact-container {
        max-width: 2200px;
    }

    /* Impact Stat Value - Ultra Dramatic */
    .impact-stat-value,
    .stat-value {
        font-size: clamp(7rem, 8vw, 14rem);
    }

    /* Impact Stat Label */
    .impact-stat-label,
    .stat-label {
        font-size: clamp(1.2rem, 1vw, 1.6rem);
    }

    /* Impact Tagline */
    .impact-tagline {
        font-size: clamp(3rem, 4vw, 6rem);
    }

    /* Impact Stats Gap */
    .impact-stats {
        gap: clamp(48px, 5vw, 120px);
    }

    /* Floating Elements Scale */
    .impact-float {
        transform: scale(1.6);
    }

    /* Floating Cow Scale */
    .floating-cow {
        width: clamp(160px, 8vw, 240px);
    }

    /* Floating Plant Scale */
    .floating-plant {
        width: clamp(100px, 6vw, 160px);
    }
}
```

### 3.4 Trust Stats Section (2560px)

```css
@media (min-width: 2560px) {
    /* Trust Stats Container */
    .trust-stats-inner {
        max-width: 1200px;
        gap: 8rem;
    }

    /* Trust Stat Value */
    .trust-stat-value {
        font-size: clamp(3rem, 4vw, 5rem);
    }

    /* Trust Stat Label */
    .trust-stat-label {
        font-size: clamp(1.1rem, 0.9vw, 1.4rem);
    }
}
```

### 3.5 Statement Section (2560px)

```css
@media (min-width: 2560px) {
    /* Statement Container */
    .statement-inner {
        max-width: 1200px;
    }

    /* Statement Heading */
    .statement h2 {
        font-size: clamp(3rem, 4vw, 5.5rem);
    }

    /* Statement Body */
    .statement p {
        font-size: clamp(1.25rem, 1vw, 1.6rem);
    }
}
```

### 3.6 Recipes Section (2560px)

```css
@media (min-width: 2560px) {
    /* Recipes Container */
    .recipes-container {
        max-width: 2200px;
    }

    /* Recipes Grid - 5 Columns */
    .recipes-grid {
        grid-template-columns: repeat(5, 1fr);
        gap: clamp(2rem, 2vw, 3.5rem);
    }

    /* Recipe Card Info Padding */
    .recipe-info {
        padding: clamp(1.25rem, 1.5vw, 1.75rem);
    }

    /* Recipe Title */
    .recipe-title {
        font-size: clamp(1.35rem, 1.1vw, 1.75rem);
    }

    /* Recipe Meta */
    .recipe-meta {
        font-size: clamp(0.9rem, 0.8vw, 1.1rem);
    }
}
```

### 3.7 Business Section (2560px)

```css
@media (min-width: 2560px) {
    /* Business Card Container */
    .business-card {
        max-width: 1800px;
    }

    /* Business Heading */
    .business h2 {
        font-size: clamp(2.5rem, 3vw, 4.5rem);
    }

    /* Business Stat Value */
    .business-stat-value {
        font-size: clamp(3rem, 3.5vw, 5rem);
    }

    /* Business Stat Grid Gap */
    .business-stats {
        gap: clamp(3rem, 4vw, 6rem);
    }
}
```

### 3.8 Footer (2560px)

```css
@media (min-width: 2560px) {
    /* Footer Container */
    .footer-container {
        max-width: 1400px;
    }

    /* Footer Grid Gap */
    .footer-grid {
        gap: clamp(3rem, 4vw, 5rem);
    }

    /* Footer Link Size */
    .footer-link {
        font-size: clamp(1rem, 0.85vw, 1.2rem);
    }
}
```

---

## 4. Animation Enhancements

Add to `planted-astro/src/styles/global.css` or `planted-astro/src/styles/animations.css`:

### 4.1 Enhanced Reveal Animations (1920px+)

```css
/* ============================================
   LARGE SCREEN ANIMATION ENHANCEMENTS
   ============================================ */
@media (min-width: 1920px) {
    /* Larger travel distance for reveals */
    .reveal {
        transform: translateY(40px);
        transition-duration: 0.9s;
    }

    .reveal-left {
        transform: translateX(-40px);
        transition-duration: 0.9s;
    }

    .reveal-right {
        transform: translateX(40px);
        transition-duration: 0.9s;
    }

    .reveal-scale {
        transform: scale(0.92);
        transition-duration: 0.9s;
    }

    /* Stagger items with larger travel */
    .stagger-item {
        transform: translateY(30px);
        transition-duration: 0.7s;
    }

    /* Product card hover effect */
    .product-card:hover {
        transform: translateY(-6px);
    }

    /* Recipe card hover effect */
    .recipe-card:hover {
        transform: translateY(-8px);
    }
}
```

### 4.2 Ticker Animation Adjustment (2560px+)

```css
@media (min-width: 2560px) {
    /* Slower ticker for very large screens (more content visible) */
    .ticker-track {
        animation-duration: 50s;
    }

    /* Alternative: If ticker should be faster */
    /* .ticker-track {
        animation-duration: 35s;
    } */

    /* Larger reveal travel distance */
    .reveal {
        transform: translateY(50px);
        transition-duration: 1s;
    }

    .reveal-left {
        transform: translateX(-50px);
        transition-duration: 1s;
    }

    .reveal-right {
        transform: translateX(50px);
        transition-duration: 1s;
    }
}
```

### 4.3 Floating Element Animations (Large Screens)

```css
@media (min-width: 1920px) {
    /* Larger floating motion for decorative elements */
    @keyframes float-large {
        0%, 100% {
            transform: translateY(0) scale(1.3);
        }
        50% {
            transform: translateY(-20px) scale(1.3);
        }
    }

    .impact-float {
        animation: float-large 4s ease-in-out infinite;
    }
}

@media (min-width: 2560px) {
    @keyframes float-xlarge {
        0%, 100% {
            transform: translateY(0) scale(1.6);
        }
        50% {
            transform: translateY(-25px) scale(1.6);
        }
    }

    .impact-float {
        animation: float-xlarge 4.5s ease-in-out infinite;
    }
}
```

---

## 5. Accessibility Considerations

Add to `planted-astro/src/styles/global.css`:

```css
/* ============================================
   ACCESSIBILITY: LARGE SCREEN CONSIDERATIONS
   ============================================ */

/* Reduced Motion - Override large screen animations */
@media (prefers-reduced-motion: reduce) {
    .reveal,
    .reveal-left,
    .reveal-right,
    .reveal-scale,
    .stagger-item {
        transform: none !important;
        transition: opacity 0.01ms !important;
    }

    .impact-float {
        animation: none !important;
        transform: none !important;
    }

    .ticker-track {
        animation: none !important;
    }

    .product-card:hover,
    .recipe-card:hover {
        transform: none !important;
    }
}

/* Touch Target Scaling for Precision Pointers */
@media (min-width: 1920px) and (pointer: fine) {
    .btn {
        padding: clamp(1rem, 1.5vw, 1.5rem) clamp(1.75rem, 2.5vw, 2.5rem);
    }

    /* Ensure minimum touch targets are still met */
    .btn,
    .filter-tab,
    .recipe-card,
    .product-card {
        min-height: var(--touch-target);
    }
}

/* High Contrast Mode */
@media (prefers-contrast: high) {
    .product-card-inner,
    .recipe-card {
        border: 2px solid currentColor;
    }

    .btn {
        border: 2px solid currentColor;
    }

    .reveal,
    .reveal-left,
    .reveal-right {
        opacity: 1 !important;
    }
}
```

---

## 6. Implementation Order

### Phase 1: Foundation (global.css)
1. Add all CSS variables to `:root` block
2. No visual changes yet - just foundation

### Phase 2: Hero Section
1. Add 1920px hero styles
2. Add 2560px hero styles
3. Test at both breakpoints

### Phase 3: Products Carousel
1. Add 1920px product card styles
2. Add 2560px product card styles
3. Verify scroll behavior

### Phase 4: Impact Section
1. Add 1920px impact styles
2. Add 2560px impact styles
3. Verify floating animations

### Phase 5: Supporting Sections
1. Trust Stats (1920px, 2560px)
2. Statement (1920px, 2560px)
3. Recipes (1920px, 2560px)
4. Business (1920px, 2560px)
5. Footer (1920px, 2560px)

### Phase 6: Animation Enhancements
1. Add enhanced reveal animations
2. Add ticker adjustments
3. Add floating element animations

### Phase 7: Accessibility
1. Add reduced motion overrides
2. Add high contrast support
3. Verify touch targets

---

## Quick Reference

### Container Widths
| Breakpoint | Max-Width | Usage |
|------------|-----------|-------|
| Default | 1400px | Base container |
| 1920px+ | 1800px | Hero, Products, Recipes |
| 2560px+ | 2100-2200px | Hero, Products, Recipes |

### Typography Scale (Hero H1)
| Breakpoint | Font Size |
|------------|-----------|
| Default | 88px (fixed) |
| 1920px+ | clamp(4rem, 6vw, 140px) |
| 2560px+ | clamp(5rem, 5vw, 180px) |

### Impact Stat Value
| Breakpoint | Font Size |
|------------|-----------|
| Default | ~4rem |
| 1920px+ | clamp(5rem, 10vw, 10rem) |
| 2560px+ | clamp(7rem, 8vw, 14rem) |

### Recipe Grid Columns
| Breakpoint | Columns |
|------------|---------|
| Default | 4 |
| 1920px+ | 4 (larger cards) |
| 2560px+ | 5 |

---

## Files to Modify

1. **`planted-astro/src/styles/global.css`**
   - Add CSS variables to `:root`
   - Add accessibility styles
   - Add animation enhancements

2. **`planted-astro/src/pages/[locale]/index.astro`**
   - Add all component-specific 1920px and 2560px styles
   - Within existing `<style>` block

---

*Document prepared for the Planted website breakpoint improvement initiative.*
