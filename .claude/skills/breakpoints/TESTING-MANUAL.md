# Breakpoint Testing Manual

## Overview

This manual provides comprehensive test cases for validating the responsive breakpoint implementation on the Planted homepage. All tests should be executed across the 5 primary viewports to ensure consistent, high-quality user experience.

### Target Viewports

| Viewport | Width | Device Category | Common Devices |
|----------|-------|-----------------|----------------|
| Mobile S | 375px | Mobile | iPhone SE, iPhone 12 Mini |
| Tablet | 768px | Tablet | iPad Mini, iPad |
| Desktop | 1440px | Desktop | Standard monitors |
| Desktop L | 1920px | Large Desktop | Full HD monitors |
| Desktop XL | 2560px | Ultra-wide | 4K monitors, ultra-wide |

### Testing Tools

- Chrome DevTools Device Mode
- Firefox Responsive Design Mode
- BrowserStack for real device testing
- Lighthouse for performance metrics

### Pass/Fail Criteria

- **Pass**: Component meets all expected results
- **Partial**: Component mostly works but has minor issues
- **Fail**: Component does not meet expected results

---

## Test Cases

---

### Mobile (375px)

#### UC-BP-001: Hero Text Mobile Readability
**Preconditions:** Viewport set to 375x812
**Steps:**
1. Navigate to homepage
2. Inspect hero h1 element
3. Verify computed font-size
4. Check for text overflow

**Expected:**
- Font size between 2.75rem and 3rem (44px-48px)
- No horizontal overflow
- Text wraps naturally without orphaned words
- Line height between 1.1 and 1.2

---

#### UC-BP-002: Hero CTA Button Mobile Touch Target
**Preconditions:** Viewport set to 375x812
**Steps:**
1. Navigate to homepage
2. Locate hero CTA button
3. Measure button height and padding

**Expected:**
- Minimum touch target height of 44px
- Minimum touch target width of 44px
- Adequate padding (min 12px horizontal)
- Button text legible without truncation

---

#### UC-BP-003: Product Carousel Mobile Card Size
**Preconditions:** Viewport set to 375x812
**Steps:**
1. Scroll to product carousel section
2. Inspect product card dimensions
3. Verify image aspect ratio

**Expected:**
- Card width approximately 280px (min 260px)
- Image aspect ratio maintained (3:4 or as designed)
- Card content (title, price) fully visible
- No horizontal overflow

---

#### UC-BP-004: Product Carousel Mobile Swipe
**Preconditions:** Viewport set to 375x812, touch simulation enabled
**Steps:**
1. Scroll to product carousel
2. Simulate swipe gesture left
3. Simulate swipe gesture right

**Expected:**
- Smooth swipe animation (60fps)
- Cards snap to position
- No janky scrolling
- Visible indicator of more content

---

#### UC-BP-005: Impact Numbers Mobile Stacking
**Preconditions:** Viewport set to 375x812
**Steps:**
1. Scroll to impact/statistics section
2. Verify layout arrangement
3. Check number readability

**Expected:**
- Statistics stack vertically (1 column)
- Each stat clearly separated
- Numbers legible (min 1.5rem)
- Labels visible and aligned

---

#### UC-BP-006: Trust Stats Mobile Visibility
**Preconditions:** Viewport set to 375x812
**Steps:**
1. Scroll to trust statistics section
2. Verify all stats are visible
3. Check icon/badge sizing

**Expected:**
- All trust indicators visible
- Icons minimum 32px
- Text legible without zooming
- Adequate spacing between items

---

#### UC-BP-007: Recipe Cards Mobile Layout
**Preconditions:** Viewport set to 375x812
**Steps:**
1. Scroll to recipes section
2. Count visible recipe cards
3. Check card dimensions

**Expected:**
- 1 card visible at a time (or carousel)
- Card fills container width (with padding)
- Recipe title readable
- Cook time/difficulty visible

---

#### UC-BP-008: Footer Mobile Navigation
**Preconditions:** Viewport set to 375x812
**Steps:**
1. Scroll to footer
2. Check link arrangement
3. Verify touch targets

**Expected:**
- Links stack vertically by category
- Minimum 44px touch target height
- Adequate spacing (8px minimum between links)
- Social icons visible and tappable

---

#### UC-BP-009: Mobile Container Padding
**Preconditions:** Viewport set to 375x812
**Steps:**
1. Navigate through all sections
2. Measure left/right padding on containers

**Expected:**
- Consistent padding of 16px-24px on sides
- Content does not touch viewport edges
- No horizontal scroll appears

---

#### UC-BP-010: Mobile Typography Line Length
**Preconditions:** Viewport set to 375x812
**Steps:**
1. Navigate to any text-heavy section
2. Count characters per line in body text

**Expected:**
- Maximum 45-50 characters per line on mobile
- Text remains readable
- No awkward line breaks

---

### Tablet (768px)

#### UC-BP-011: Hero Section Tablet Layout
**Preconditions:** Viewport set to 768x1024
**Steps:**
1. Navigate to homepage
2. Inspect hero section layout
3. Verify image and text arrangement

**Expected:**
- Hero text size 3.5rem-4rem (56px-64px)
- Balanced layout (text and image visible)
- CTA button prominent
- Background image properly scaled

---

#### UC-BP-012: Product Carousel Tablet Grid
**Preconditions:** Viewport set to 768x1024
**Steps:**
1. Scroll to product carousel
2. Count visible cards
3. Verify card sizing

**Expected:**
- 2-3 cards visible simultaneously
- Cards approximately 280-320px wide
- Consistent gap between cards (16-24px)
- Navigation arrows visible if applicable

---

#### UC-BP-013: Impact Numbers Tablet Grid
**Preconditions:** Viewport set to 768x1024
**Steps:**
1. Scroll to impact section
2. Check layout arrangement
3. Verify spacing

**Expected:**
- 2-column grid layout
- Numbers sized 2rem-2.5rem
- Equal spacing between stat blocks
- Visual hierarchy maintained

---

#### UC-BP-014: Trust Stats Tablet Arrangement
**Preconditions:** Viewport set to 768x1024
**Steps:**
1. Scroll to trust section
2. Verify horizontal arrangement
3. Check alignment

**Expected:**
- Stats arranged in 2-3 column grid
- Icons 40-48px
- Centered or left-aligned consistently
- No overflow issues

---

#### UC-BP-015: Recipe Cards Tablet Grid
**Preconditions:** Viewport set to 768x1024
**Steps:**
1. Scroll to recipes section
2. Count cards per row
3. Verify image quality

**Expected:**
- 2 cards per row
- Card width 300-360px
- Images sharp (no pixelation)
- Consistent card heights

---

#### UC-BP-016: Footer Tablet Columns
**Preconditions:** Viewport set to 768x1024
**Steps:**
1. Scroll to footer
2. Check column arrangement
3. Verify link grouping

**Expected:**
- 2-3 column layout
- Link categories clearly grouped
- Social icons inline
- Newsletter signup visible

---

#### UC-BP-017: Tablet Navigation Menu
**Preconditions:** Viewport set to 768x1024
**Steps:**
1. Inspect header/navigation
2. Check menu visibility
3. Test any dropdowns

**Expected:**
- Full navigation visible OR hamburger menu
- Touch targets minimum 44px
- Dropdowns work smoothly
- Logo properly sized

---

#### UC-BP-018: Tablet Container Max-Width
**Preconditions:** Viewport set to 768x1024
**Steps:**
1. Inspect main container element
2. Verify max-width applied
3. Check centering

**Expected:**
- Content container max-width 720px-768px
- Content centered horizontally
- Side padding 24-32px

---

#### UC-BP-019: Tablet Image Scaling
**Preconditions:** Viewport set to 768x1024
**Steps:**
1. Check hero image
2. Check product images
3. Check recipe images

**Expected:**
- All images properly scaled
- No stretching or distortion
- Appropriate resolution loaded
- Lazy loading functional

---

#### UC-BP-020: Tablet Animation Performance
**Preconditions:** Viewport set to 768x1024
**Steps:**
1. Scroll through page
2. Trigger any scroll animations
3. Monitor frame rate in DevTools

**Expected:**
- Animations run at 60fps
- No jank or stuttering
- Smooth scroll-triggered effects
- No layout shift during animations

---

### Desktop (1440px)

#### UC-BP-021: Hero Section Desktop Layout
**Preconditions:** Viewport set to 1440x900
**Steps:**
1. Navigate to homepage
2. Inspect hero section
3. Verify proportions

**Expected:**
- Hero h1 font size 4.5rem-5rem (72px-80px)
- Side-by-side layout (text + image)
- Generous whitespace
- Full-width background if designed

---

#### UC-BP-022: Product Carousel Desktop Display
**Preconditions:** Viewport set to 1440x900
**Steps:**
1. Scroll to product carousel
2. Count visible products
3. Check navigation controls

**Expected:**
- 4-5 products visible
- Card width 280-320px (20% larger than base)
- Arrow navigation visible
- Smooth carousel animation

---

#### UC-BP-023: Impact Numbers Desktop Grid
**Preconditions:** Viewport set to 1440x900
**Steps:**
1. Scroll to impact section
2. Verify horizontal layout
3. Check typography

**Expected:**
- 4-column horizontal layout
- Numbers 2.5rem-3rem
- Animated counters functional
- Proper spacing between columns

---

#### UC-BP-024: Trust Stats Desktop Row
**Preconditions:** Viewport set to 1440x900
**Steps:**
1. Scroll to trust section
2. Check alignment
3. Verify icon sizing

**Expected:**
- Single row layout
- Icons 48-56px
- Even distribution across container
- Hover states functional

---

#### UC-BP-025: Recipe Cards Desktop Grid
**Preconditions:** Viewport set to 1440x900
**Steps:**
1. Scroll to recipes section
2. Count cards per row
3. Check interactivity

**Expected:**
- 3-4 cards per row
- Cards 320-360px wide
- Hover effects visible
- CTA buttons accessible

---

#### UC-BP-026: Footer Desktop Layout
**Preconditions:** Viewport set to 1440x900
**Steps:**
1. Scroll to footer
2. Check column count
3. Verify all links present

**Expected:**
- 4-5 column layout
- All navigation categories visible
- Newsletter form inline
- Legal links in footer bar

---

#### UC-BP-027: Desktop Typography Hierarchy
**Preconditions:** Viewport set to 1440x900
**Steps:**
1. Inspect h1, h2, h3 elements across page
2. Verify size progression
3. Check line heights

**Expected:**
- Clear size hierarchy (h1 > h2 > h3)
- h1: 4.5-5rem, h2: 2.5-3rem, h3: 1.75-2rem
- Body text 1rem-1.125rem
- Line heights appropriate (1.5 for body)

---

#### UC-BP-028: Desktop Container Max-Width
**Preconditions:** Viewport set to 1440x900
**Steps:**
1. Inspect main container
2. Measure max-width
3. Check side margins

**Expected:**
- Container max-width 1200px-1440px
- Centered with auto margins
- Content does not stretch full width

---

#### UC-BP-029: Desktop Line Length
**Preconditions:** Viewport set to 1440x900
**Steps:**
1. Navigate to text sections
2. Count characters per line

**Expected:**
- Maximum 75 characters per line
- Comfortable reading width
- Proper text container constraints

---

#### UC-BP-030: Desktop Hover Interactions
**Preconditions:** Viewport set to 1440x900
**Steps:**
1. Hover over buttons
2. Hover over cards
3. Hover over links

**Expected:**
- Visible hover state changes
- Smooth transitions (200-300ms)
- Cursor changes appropriately
- No flickering or jumps

---

### Large Desktop (1920px)

#### UC-BP-031: Hero Section Large Desktop
**Preconditions:** Viewport set to 1920x1080
**Steps:**
1. Navigate to homepage
2. Inspect hero scaling
3. Check image quality

**Expected:**
- Hero text 5rem-5.5rem (80px-88px)
- Image fills designated area
- No excessive whitespace
- Background properly positioned

---

#### UC-BP-032: Product Carousel Large Desktop
**Preconditions:** Viewport set to 1920x1080
**Steps:**
1. Scroll to product carousel
2. Count visible cards
3. Verify spacing

**Expected:**
- 5-6 products visible
- Cards scale proportionally
- Increased gap spacing (24-32px)
- No cramped appearance

---

#### UC-BP-033: Impact Numbers Large Desktop Scale
**Preconditions:** Viewport set to 1920x1080
**Steps:**
1. Scroll to impact section
2. Check number sizing
3. Verify animation

**Expected:**
- Numbers 3rem-3.5rem
- Animation triggers on scroll
- Visual impact maintained
- Spacing scales with viewport

---

#### UC-BP-034: Trust Stats Large Desktop
**Preconditions:** Viewport set to 1920x1080
**Steps:**
1. Scroll to trust section
2. Verify sizing
3. Check distribution

**Expected:**
- Icons 56-64px
- Even horizontal distribution
- Text scales appropriately
- Section height comfortable

---

#### UC-BP-035: Recipe Section Large Desktop
**Preconditions:** Viewport set to 1920x1080
**Steps:**
1. Scroll to recipes
2. Count cards per row
3. Check card quality

**Expected:**
- 4 cards per row
- Cards 360-400px wide
- High-res images loaded
- Grid gap 24-32px

---

#### UC-BP-036: Footer Large Desktop
**Preconditions:** Viewport set to 1920x1080
**Steps:**
1. Scroll to footer
2. Check layout
3. Verify readability

**Expected:**
- 5+ column layout
- Content spreads comfortably
- No excessive stretching
- Proper content grouping

---

#### UC-BP-037: Large Desktop Content Width
**Preconditions:** Viewport set to 1920x1080
**Steps:**
1. Measure main content container
2. Check edge spacing
3. Verify max-width

**Expected:**
- Max-width 1600px-1800px
- Centered with visible margins
- Content does not stretch uncomfortably
- Reading experience optimized

---

#### UC-BP-038: Large Desktop White Space
**Preconditions:** Viewport set to 1920x1080
**Steps:**
1. Scan all sections
2. Check vertical spacing
3. Verify section padding

**Expected:**
- Generous section padding (80-120px vertical)
- Balanced whitespace
- No cramped sections
- Visual breathing room

---

#### UC-BP-039: Large Desktop Navigation
**Preconditions:** Viewport set to 1920x1080
**Steps:**
1. Inspect header navigation
2. Check logo positioning
3. Verify nav link spacing

**Expected:**
- Navigation fills header appropriately
- Logo sized 140-180px wide
- Nav links spaced 24-32px apart
- Search/cart icons visible

---

#### UC-BP-040: Large Desktop Performance
**Preconditions:** Viewport set to 1920x1080
**Steps:**
1. Run Lighthouse performance audit
2. Check LCP timing
3. Verify CLS score

**Expected:**
- LCP under 2.5 seconds
- CLS under 0.1
- FID/INP under 100ms
- Smooth scrolling throughout

---

### Ultra-wide Desktop (2560px)

#### UC-BP-041: Hero Section Ultra-wide
**Preconditions:** Viewport set to 2560x1440
**Steps:**
1. Navigate to homepage
2. Check hero proportions
3. Verify background handling

**Expected:**
- Hero text 5.5rem-6rem (88px-96px)
- Content remains centered
- Background fills or gracefully extends
- No awkward empty spaces

---

#### UC-BP-042: Product Carousel Ultra-wide
**Preconditions:** Viewport set to 2560x1440
**Steps:**
1. Scroll to product carousel
2. Count visible products
3. Check card behavior

**Expected:**
- 6-7 products visible
- Cards maintain max-width (400px)
- Extra space distributed as gaps
- Navigation still functional

---

#### UC-BP-043: Impact Numbers Ultra-wide
**Preconditions:** Viewport set to 2560x1440
**Steps:**
1. Scroll to impact section
2. Check layout
3. Verify readability

**Expected:**
- Numbers 3.5rem-4rem max
- Section does not stretch awkwardly
- Content container respected
- Visual hierarchy maintained

---

#### UC-BP-044: Trust Stats Ultra-wide
**Preconditions:** Viewport set to 2560x1440
**Steps:**
1. Scroll to trust section
2. Check spacing
3. Verify sizing

**Expected:**
- Stats remain readable
- Spacing scales but caps
- Icons max 72px
- Section height reasonable

---

#### UC-BP-045: Recipe Cards Ultra-wide
**Preconditions:** Viewport set to 2560x1440
**Steps:**
1. Scroll to recipes
2. Count cards per row
3. Verify quality

**Expected:**
- 4-5 cards per row (or capped grid)
- Cards max-width 420px
- Grid gap 32-40px
- No stretched images

---

#### UC-BP-046: Footer Ultra-wide
**Preconditions:** Viewport set to 2560x1440
**Steps:**
1. Scroll to footer
2. Check column distribution
3. Verify content centering

**Expected:**
- Columns spread with max-width container
- Content does not span full viewport
- Footer max-width matches main content
- Balanced appearance

---

#### UC-BP-047: Ultra-wide Container Behavior
**Preconditions:** Viewport set to 2560x1440
**Steps:**
1. Inspect main container at all sections
2. Verify max-width cap
3. Check centering

**Expected:**
- Container max-width 1920px-2200px
- Content centered horizontally
- Visible side margins
- Consistent across sections

---

#### UC-BP-048: Ultra-wide Typography Cap
**Preconditions:** Viewport set to 2560x1440
**Steps:**
1. Check all heading sizes
2. Verify they don't exceed maximums
3. Check body text

**Expected:**
- h1 caps at 6rem (96px)
- Body text caps at 1.25rem (20px)
- Line lengths capped at 75 characters
- Reading comfort maintained

---

#### UC-BP-049: Ultra-wide Animation Smoothness
**Preconditions:** Viewport set to 2560x1440
**Steps:**
1. Scroll through entire page
2. Trigger all animations
3. Monitor performance

**Expected:**
- All animations maintain 60fps
- No lag on large viewport
- Scroll-triggered effects work
- No performance degradation

---

#### UC-BP-050: Ultra-wide Cross-section Consistency
**Preconditions:** Viewport set to 2560x1440
**Steps:**
1. Scroll through all sections
2. Compare container widths
3. Check alignment

**Expected:**
- All sections use same max-width
- Content aligns vertically
- No section breaks visual flow
- Consistent visual language

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Clear browser cache
- [ ] Disable browser extensions
- [ ] Set device pixel ratio to 1 (or test multiple)
- [ ] Enable DevTools Performance monitor

### Per-Viewport Checklist
- [ ] Complete all assigned test cases
- [ ] Document any failures with screenshots
- [ ] Note actual measurements vs expected
- [ ] Record browser/OS version

### Post-Test Actions
- [ ] Compile results into summary report
- [ ] Prioritize failures (Critical/High/Medium/Low)
- [ ] Create tickets for issues found
- [ ] Schedule regression testing after fixes

---

## Appendix A: CSS Breakpoint Reference

```css
/* Mobile First Breakpoints */
:root {
  /* Base: 375px */
  --container-padding: 16px;
  --h1-size: 2.75rem;
  --card-width: 280px;
}

/* Tablet: 768px */
@media (min-width: 768px) {
  --container-padding: 24px;
  --h1-size: 3.5rem;
  --card-width: 300px;
}

/* Desktop: 1440px */
@media (min-width: 1440px) {
  --container-padding: 32px;
  --h1-size: 4.5rem;
  --card-width: 320px;
}

/* Large Desktop: 1920px */
@media (min-width: 1920px) {
  --container-padding: 48px;
  --h1-size: 5rem;
  --card-width: 360px;
}

/* Ultra-wide: 2560px */
@media (min-width: 2560px) {
  --container-padding: 64px;
  --h1-size: 5.5rem;
  --card-width: 400px;
}
```

---

## Appendix B: Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Text overflow on mobile | Fixed width containers | Use max-width and relative units |
| Touch targets too small | Insufficient padding | Ensure min 44px clickable area |
| Images pixelated | Wrong srcset | Provide 2x/3x resolution images |
| Layout shift | Missing dimensions | Set explicit width/height on images |
| Line length too long | No max-width on text | Cap text containers at 75ch |
| Animations janky | Layout thrashing | Use transform/opacity only |

---

## Appendix C: Accessibility Requirements per Viewport

### All Viewports
- Color contrast minimum 4.5:1 for text
- Focus indicators visible
- Skip navigation link available
- Screen reader compatible

### Mobile Specific
- Touch targets 44x44px minimum
- No horizontal scroll
- Tap to dismiss modals
- Adequate spacing for fat-finger prevention

### Desktop Specific
- Keyboard navigation complete
- Hover states visible
- Focus trap in modals
- Mouse and keyboard equivalent actions

---

*Last Updated: December 2024*
*Version: 1.0*
*Maintainer: Frontend Team*
