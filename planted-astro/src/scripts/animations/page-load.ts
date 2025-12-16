/**
 * Page Load Orchestration
 * Coordinated entrance sequence for page elements
 */

import { gsap } from '../smooth-scroll';

/**
 * Initialize page load animation sequence
 * Creates a cohesive entrance experience
 */
export function initPageLoadSequence(): void {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  // Create master timeline
  const tl = gsap.timeline({ delay: 0.1 });

  // Logo fade in
  const logo = document.querySelector('.nav-logo, .site-logo');
  if (logo) {
    gsap.set(logo, { opacity: 0, scale: 0.9 });
    tl.to(logo, {
      opacity: 1,
      scale: 1,
      duration: 0.5,
      ease: 'back.out(1.4)',
    });
  }

  // Navigation items stagger
  const navItems = document.querySelectorAll('.nav-link, .nav-item');
  if (navItems.length > 0) {
    gsap.set(navItems, { opacity: 0, y: -10 });
    tl.to(navItems, {
      opacity: 1,
      y: 0,
      duration: 0.4,
      stagger: 0.05,
      ease: 'power2.out',
    }, '-=0.3');
  }

  // Main content ready indicator
  const mainContent = document.querySelector('.main-content');
  if (mainContent) {
    mainContent.classList.add('page-loaded');
  }
}

/**
 * Initialize lazy video loading
 * Only load videos when they're about to enter viewport
 */
export function initLazyVideos(): void {
  const lazyVideos = document.querySelectorAll('video[data-src]');

  if ('IntersectionObserver' in window) {
    const videoObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const video = entry.target as HTMLVideoElement;
            const source = video.dataset.src;

            if (source) {
              video.src = source;
              video.load();
            }

            videoObserver.unobserve(video);
          }
        });
      },
      { rootMargin: '200px' }
    );

    lazyVideos.forEach((video) => videoObserver.observe(video));
  }
}

/**
 * Add performance hints to animated elements
 * Applies will-change strategically
 */
export function initPerformanceHints(): void {
  // Add will-change to elements about to animate
  const animatedElements = document.querySelectorAll('[data-animate], [data-parallax]');

  if ('IntersectionObserver' in window) {
    const hintObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target as HTMLElement;

          if (entry.isIntersecting) {
            // Add performance hint
            el.style.willChange = 'transform, opacity';
          } else {
            // Remove after animation completes
            if (el.classList.contains('is-visible')) {
              el.style.willChange = 'auto';
              hintObserver.unobserve(el);
            }
          }
        });
      },
      { rootMargin: '100px' }
    );

    animatedElements.forEach((el) => hintObserver.observe(el));
  }
}
