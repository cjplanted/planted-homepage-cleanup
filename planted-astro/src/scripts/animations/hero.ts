/**
 * Hero Section Animations
 * Enhanced scroll-driven effects with brand-compliant motion
 */

import { gsap, ScrollTrigger } from '../smooth-scroll';

/**
 * Initialize hero section animations
 * - Parallax on TV visual
 * - Scroll-fade on hero content
 * - Staggered text entrance
 * - Scroll indicator hide on scroll
 */
export function initHeroAnimations(): void {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const heroContent = hero.querySelector('.hero-text');
  const heroVisual = hero.querySelector('.hero-visual');
  const scrollIndicator = hero.querySelector('[data-hero-scroll-cue]');

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  // Hero text - ALWAYS VISIBLE (no scroll-fade)
  // The scroll-fade animation was removed because ScrollTrigger's scrub
  // applies partial animation even at scroll=0, causing text to disappear.
  if (heroContent) {
    gsap.set(heroContent, { opacity: 1 });
  }

  // Parallax is handled by Layout.astro's generic parallax system
  // But we can add extra depth to child elements
  const tvFrame = hero.querySelector('.tv-frame');
  if (tvFrame) {
    gsap.to(tvFrame, {
      yPercent: -10,
      scale: 0.98,
      ease: 'none',
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: 1.5,
      },
    });
  }

  // Hide scroll indicator on scroll
  if (scrollIndicator) {
    gsap.to(scrollIndicator, {
      opacity: 0,
      yPercent: 50,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: hero,
        start: '5% top',
        end: '15% top',
        scrub: true,
      },
    });
  }

  // Floating annotation card subtle movement
  const annotationCard = hero.querySelector('.tv-annotation');
  if (annotationCard) {
    gsap.to(annotationCard, {
      y: -30,
      rotation: -2,
      ease: 'none',
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: 2,
      },
    });
  }

  // Approved badge playful bounce on scroll
  const approvedBadge = hero.querySelector('.approved-badge');
  if (approvedBadge) {
    gsap.to(approvedBadge, {
      y: -20,
      rotation: 5,
      ease: 'none',
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: 1.5,
      },
    });
  }
}

/**
 * Enhanced entrance animations for hero elements
 * Called on page load for initial reveal
 */
export function initHeroEntrance(): void {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  // Create entrance timeline
  const tl = gsap.timeline({ delay: 0.2 });

  // Badge entrance
  const badge = hero.querySelector('.hero-badge');
  if (badge) {
    gsap.set(badge, { opacity: 0, y: 20 });
    tl.to(badge, {
      opacity: 1,
      y: 0,
      duration: 0.6,
      ease: 'power3.out',
    });
  }

  // Headline entrance
  const headline = hero.querySelector('.hero-headline');
  if (headline) {
    gsap.set(headline, { opacity: 0, y: 30 });
    tl.to(headline, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: 'power3.out',
    }, '-=0.4');
  }

  // Whisper box entrance
  const whisper = hero.querySelector('.hero-whisper');
  if (whisper) {
    gsap.set(whisper, { opacity: 0, y: 20 });
    tl.to(whisper, {
      opacity: 1,
      y: 0,
      duration: 0.5,
      ease: 'power3.out',
    }, '-=0.3');
  }

  // Actions entrance
  const actions = hero.querySelector('.hero-actions');
  if (actions) {
    gsap.set(actions, { opacity: 0, y: 20 });
    tl.to(actions, {
      opacity: 1,
      y: 0,
      duration: 0.5,
      ease: 'power3.out',
    }, '-=0.2');
  }

  // Proof stats entrance
  const proof = hero.querySelector('.hero-proof');
  if (proof) {
    gsap.set(proof, { opacity: 0, y: 20 });
    tl.to(proof, {
      opacity: 1,
      y: 0,
      duration: 0.5,
      ease: 'power3.out',
    }, '-=0.2');
  }

  // Visual entrance (TV set)
  const visual = hero.querySelector('.hero-visual');
  if (visual) {
    gsap.set(visual, { opacity: 0, scale: 0.95 });
    tl.to(visual, {
      opacity: 1,
      scale: 1,
      duration: 0.8,
      ease: 'power3.out',
    }, '-=0.6');
  }

  // Annotation card pop
  const annotation = hero.querySelector('.tv-annotation');
  if (annotation) {
    gsap.set(annotation, { opacity: 0, y: 20, rotation: -5 });
    tl.to(annotation, {
      opacity: 1,
      y: 0,
      rotation: 0,
      duration: 0.5,
      ease: 'back.out(1.7)',
    }, '-=0.3');
  }

  // Approved badge pop
  const approved = hero.querySelector('.approved-badge');
  if (approved) {
    gsap.set(approved, { opacity: 0, scale: 0 });
    tl.to(approved, {
      opacity: 1,
      scale: 1,
      duration: 0.4,
      ease: 'back.out(2)',
    }, '-=0.2');
  }

  // Scroll indicator fade in last
  const scrollCue = hero.querySelector('[data-hero-scroll-cue]');
  if (scrollCue) {
    gsap.set(scrollCue, { opacity: 0, y: -10 });
    tl.to(scrollCue, {
      opacity: 1,
      y: 0,
      duration: 0.5,
      ease: 'power2.out',
    }, '-=0.1');
  }
}
