# Impact Section — Implementation Guide

## Overview

Full-width immersive section with mountain landscape background and large animated stats.

**Design Goal:** Create an emotional, cinematic moment that makes visitors feel the scale of Planted's impact.

---

## Visual Preview

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│              🏔️ MOUNTAIN LANDSCAPE BACKGROUND 🏔️            │
│                  (with purple gradient overlay)             │
│                                                             │
│              "Every bite makes a difference"                │
│                                                             │
│         97%          95%           0                        │
│       LESS CO₂    LESS WATER    ANIMALS                     │
│                                                             │
│            "Same experience. Better meat."                  │
│                                                             │
│     Compared to conventional beef. Verified by LCA.         │
│                                                             │
│              [ Explore our impact → ]                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Background Image

**Current image:** Swiss Alps with morning mist

```
https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1800&q=80
```

**Why this image works:**
- Mountains = Switzerland (where Planted is made)
- Morning light = new beginning, fresh start
- Natural landscape = what we're protecting
- Dramatic but not distracting

**Alternative images in the HTML comments:**
- Swiss Alps with lake
- Golden pea field (more product-connected)
- Forest with light rays
- Aerial farmland

**For production:** Replace with actual Planted brand photography if available.

---

## Typography

### Numbers
```css
font-family: 'VC Henrietta', serif;
font-size: clamp(5rem, 18vw, 12rem);
color: white;
letter-spacing: -0.03em;
text-shadow: 
    0 4px 0 rgba(0,0,0,0.05),
    0 8px 30px rgba(0,0,0,0.2);
```

### Percent signs (green)
```css
color: #6BBF59;
text-shadow: 
    0 0 40px rgba(107, 191, 89, 0.4),
    0 4px 0 rgba(0,0,0,0.05);
```

### Labels
```css
font-size: clamp(0.65rem, 1.5vw, 0.85rem);
text-transform: uppercase;
letter-spacing: 0.2em;
color: rgba(255,255,255,0.5);
```

### Tagline
```css
font-family: 'VC Henrietta', serif;
font-size: clamp(1.75rem, 5vw, 3.5rem);
color: white;
```

---

## Colors

| Element | Color |
|---------|-------|
| Background overlay (top) | `rgba(97, 38, 158, 0.65)` |
| Background overlay (bottom) | `rgba(61, 24, 102, 0.9)` |
| Numbers | `white` |
| Percent signs | `#6BBF59` (green) |
| Labels | `rgba(255,255,255,0.5)` |
| Source text | `rgba(255,255,255,0.4)` |
| CTA button | `#6BBF59` background, `#1A1A1A` text |

---

## Animations

### 1. Background slow zoom
```css
@keyframes slowZoom {
    0% { transform: scale(1); }
    100% { transform: scale(1.08); }
}

.impact-bg img {
    animation: slowZoom 30s ease-in-out infinite alternate;
}
```

### 2. Fade-slide-up entrance
```css
@keyframes fadeSlideUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
```

### 3. Staggered stat animation
```css
.impact-stat:nth-child(1) { animation-delay: 0.4s; }
.impact-stat:nth-child(2) { animation-delay: 0.55s; }
.impact-stat:nth-child(3) { animation-delay: 0.7s; }
```

### 4. CTA hover
```css
.impact-cta a:hover {
    transform: translateY(-4px) scale(1.02);
    box-shadow: 0 16px 40px rgba(107, 191, 89, 0.4);
}

.impact-cta a:hover svg {
    transform: translateX(4px);
}
```

---

## Responsive Breakpoints

### Desktop (default)
- Stats in row with large gap
- Numbers at maximum size
- Full padding

### Tablet (< 600px)
```css
.impact-stats {
    gap: 2rem;
}

.impact-stat-value {
    font-size: clamp(4rem, 22vw, 6rem);
}

.impact-content {
    padding: 4rem 1.5rem;
}
```

### Mobile (< 400px)
```css
.impact-stats {
    flex-direction: column;
    gap: 2.5rem;
}
```

---

## Copy

| Element | Text |
|---------|------|
| Headline | "Every bite makes a difference" |
| Stat 1 | 97% / Less CO₂ |
| Stat 2 | 95% / Less Water |
| Stat 3 | 0 / Animals |
| Tagline | "Same experience. Better meat." |
| Source | "Compared to conventional beef. Verified by independent LCA." |
| CTA | "Explore our impact →" |

---

## Integration

### HTML structure
```html
<section class="impact">
    <div class="impact-bg">
        <img src="[IMAGE_URL]" alt="Mountain landscape">
    </div>
    
    <div class="impact-content">
        <h2 class="impact-headline">Every bite makes a difference</h2>
        
        <div class="impact-stats">
            <div class="impact-stat">
                <div class="impact-stat-value">97<span>%</span></div>
                <div class="impact-stat-label">Less CO₂</div>
            </div>
            <!-- ... more stats -->
        </div>
        
        <p class="impact-tagline">Same experience. Better meat.</p>
        <p class="impact-source">Compared to conventional beef...</p>
        
        <div class="impact-cta">
            <a href="/pages/sustainability">Explore our impact →</a>
        </div>
    </div>
</section>
```

### CTA link
Point to: `/pages/sustainability` or wherever your sustainability report lives.

---

## Checklist

- [ ] Add section to homepage (after products carousel or hero)
- [ ] Replace Unsplash image with brand photography
- [ ] Update CTA link to sustainability page
- [ ] Test on mobile devices
- [ ] Verify fonts load (VC Henrietta, Galano Grotesque)
- [ ] Check animation performance (should be 60fps)
- [ ] Ensure image is optimized (WebP, max 400KB)

---

## Files

```
impact-section/
├── impact-section.html    ← Complete working reference
└── GUIDE.md               ← This file
```

Open `impact-section.html` in browser to preview.
