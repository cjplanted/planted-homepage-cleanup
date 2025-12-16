/**
 * Scroll Velocity Feedback
 * Creates CSS variable for velocity-responsive elements
 */

import { getLenis } from '../smooth-scroll';

/**
 * Initialize scroll velocity tracking
 * Exposes --scroll-velocity CSS variable for velocity-responsive effects
 */
export function initScrollVelocity(): void {
  const root = document.documentElement;
  const lenis = getLenis();

  if (!lenis) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    root.style.setProperty('--scroll-velocity', '0');
    return;
  }

  // Track velocity and update CSS variable
  lenis.on('scroll', ({ velocity }: { velocity: number }) => {
    // Normalize velocity to 0-1 range (cap at 5 for normal scrolling)
    const normalizedVelocity = Math.min(Math.abs(velocity) / 5, 1);

    // Update CSS variable
    root.style.setProperty('--scroll-velocity', normalizedVelocity.toFixed(3));

    // Add velocity class for CSS-based effects
    if (normalizedVelocity > 0.3) {
      root.classList.add('is-scrolling-fast');
    } else {
      root.classList.remove('is-scrolling-fast');
    }
  });
}

/**
 * Initialize scroll direction tracking
 * Adds classes for scroll-direction-aware effects
 */
export function initScrollDirection(): void {
  const root = document.documentElement;
  let lastScrollY = window.scrollY;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  window.addEventListener(
    'scroll',
    () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY) {
        root.classList.add('is-scrolling-down');
        root.classList.remove('is-scrolling-up');
      } else {
        root.classList.add('is-scrolling-up');
        root.classList.remove('is-scrolling-down');
      }

      lastScrollY = currentScrollY;
    },
    { passive: true }
  );
}

/**
 * Initialize all scroll feedback effects
 */
export function initScrollFeedback(): void {
  initScrollVelocity();
  initScrollDirection();
}
