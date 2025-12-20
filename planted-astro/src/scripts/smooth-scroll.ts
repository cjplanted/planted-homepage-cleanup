/**
 * Smooth Scroll Foundation
 * GSAP + Lenis integration for scroll-driven animations
 */

import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// CRITICAL: Register GSAP plugins immediately at module load
// This must happen BEFORE any ScrollTrigger instances are created
gsap.registerPlugin(ScrollTrigger);

// Verify plugin registration - check for ScrollTrigger specifically
if (!ScrollTrigger || typeof ScrollTrigger.create !== 'function') {
  console.error('GSAP ScrollTrigger plugin failed to register');
} else {
  console.log('ScrollTrigger plugin registered successfully');
}

// Lenis instance (exported for use in other modules)
let lenis: Lenis | null = null;

/**
 * Initialize smooth scrolling with Lenis
 * Connected to GSAP ScrollTrigger for scroll-driven animations
 */
export function initSmoothScroll(): Lenis {
  // CRITICAL: Re-register ScrollTrigger plugin to ensure it's available
  // This guards against module loading race conditions
  gsap.registerPlugin(ScrollTrigger);

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Create Lenis instance
  lenis = new Lenis({
    duration: prefersReducedMotion ? 0.01 : 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Expo easing
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    smoothWheel: !prefersReducedMotion,
    touchMultiplier: 2,
  });

  // Connect Lenis scroll to GSAP ScrollTrigger
  lenis.on('scroll', ScrollTrigger.update);

  // Use GSAP's ticker for Lenis animation frame
  gsap.ticker.add((time) => {
    lenis?.raf(time * 1000);
  });

  // Disable GSAP's lag smoothing for smoother animations
  gsap.ticker.lagSmoothing(0);

  // Listen for reduced motion changes
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    if (lenis) {
      lenis.options.smoothWheel = !e.matches;
      lenis.options.duration = e.matches ? 0.01 : 1.2;
    }
  });

  return lenis;
}

/**
 * Get the current Lenis instance
 */
export function getLenis(): Lenis | null {
  return lenis;
}

/**
 * Destroy Lenis instance (for cleanup)
 */
export function destroySmoothScroll(): void {
  if (lenis) {
    lenis.destroy();
    lenis = null;
  }
}

/**
 * Scroll to element with smooth animation
 */
export function scrollTo(target: string | HTMLElement, options?: { offset?: number; duration?: number }): void {
  if (lenis) {
    lenis.scrollTo(target, {
      offset: options?.offset ?? 0,
      duration: options?.duration ?? 1.2,
    });
  }
}

// Re-export GSAP utilities for convenience
export { gsap, ScrollTrigger };
