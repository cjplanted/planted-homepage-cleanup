/**
 * Transformation Section Animations
 * Scroll-driven reveals and effects for products and impact sections
 */

import { gsap, ScrollTrigger } from '../smooth-scroll';

/**
 * Initialize products section scroll effects
 * - Staggered product card reveals
 * - Scroll progress tracking
 * - Carousel fade edges
 */
export function initProductsAnimations(): void {
  const productsSection = document.querySelector('.products');
  if (!productsSection) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  // Product cards staggered entrance
  const productCards = productsSection.querySelectorAll('.product-card');
  productCards.forEach((card, index) => {
    gsap.fromTo(
      card,
      {
        opacity: 0,
        y: 40,
        scale: 0.95,
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.6,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: card,
          start: 'top 90%',
          once: true,
        },
        delay: index * 0.08, // Stagger effect
      }
    );
  });

  // Products header animation
  const header = productsSection.querySelector('.products-header');
  if (header) {
    gsap.fromTo(
      header,
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: header,
          start: 'top 85%',
          once: true,
        },
      }
    );
  }
}

/**
 * Initialize impact section scroll effects
 * - Stats counter animation on scroll
 * - Gradient background parallax
 * - Floating elements movement
 */
export function initImpactAnimations(): void {
  const impactSection = document.querySelector('.impact');
  if (!impactSection) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  // Floating elements parallax
  const floatingElements = impactSection.querySelectorAll('.impact-float');
  floatingElements.forEach((el, index) => {
    const speed = 0.2 + index * 0.1;
    gsap.to(el, {
      yPercent: -30 * speed,
      ease: 'none',
      scrollTrigger: {
        trigger: impactSection,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 2,
      },
    });
  });

  // Impact stats entrance with stagger
  const stats = impactSection.querySelectorAll('.impact-stat');
  stats.forEach((stat, index) => {
    gsap.fromTo(
      stat,
      {
        opacity: 0,
        y: 50,
        scale: 0.9,
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.7,
        ease: 'back.out(1.2)',
        scrollTrigger: {
          trigger: stat,
          start: 'top 85%',
          once: true,
        },
        delay: index * 0.15,
      }
    );
  });

  // Tagline entrance
  const tagline = impactSection.querySelector('.impact-tagline');
  if (tagline) {
    gsap.fromTo(
      tagline,
      { opacity: 0, y: 30, scale: 0.95 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: tagline,
          start: 'top 85%',
          once: true,
        },
      }
    );
  }

  // CTA button entrance
  const cta = impactSection.querySelector('.impact-cta');
  if (cta) {
    gsap.fromTo(
      cta,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: cta,
          start: 'top 90%',
          once: true,
        },
      }
    );
  }

  // Gradient background subtle shift
  const gradient = impactSection.querySelector('.impact-gradient');
  if (gradient) {
    gsap.to(gradient, {
      backgroundPosition: '100% 50%',
      ease: 'none',
      scrollTrigger: {
        trigger: impactSection,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 3,
      },
    });
  }
}

/**
 * Initialize intro section animations
 * - Swiss-made badge pop
 * - Badges staggered reveal
 */
export function initIntroAnimations(): void {
  const introSection = document.querySelector('.intro');
  if (!introSection) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  // Intro badges staggered entrance
  const badges = introSection.querySelectorAll('.intro-badge');
  badges.forEach((badge, index) => {
    gsap.fromTo(
      badge,
      {
        opacity: 0,
        y: 20,
        scale: 0.9,
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.5,
        ease: 'back.out(1.5)',
        scrollTrigger: {
          trigger: badge,
          start: 'top 90%',
          once: true,
        },
        delay: index * 0.1,
      }
    );
  });
}

/**
 * Initialize statement section parallax
 */
export function initStatementAnimations(): void {
  const statement = document.querySelector('.statement');
  if (!statement) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  // Statement text reveal with slight scale
  const heading = statement.querySelector('h2');
  if (heading) {
    gsap.fromTo(
      heading,
      { opacity: 0, y: 40, scale: 0.98 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: heading,
          start: 'top 80%',
          once: true,
        },
      }
    );
  }

  const paragraph = statement.querySelector('p');
  if (paragraph) {
    gsap.fromTo(
      paragraph,
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: paragraph,
          start: 'top 85%',
          once: true,
        },
        delay: 0.2,
      }
    );
  }
}

/**
 * Initialize all transformation section animations
 */
export function initTransformationAnimations(): void {
  initStatementAnimations();
  initIntroAnimations();
  initProductsAnimations();
  initImpactAnimations();
}
