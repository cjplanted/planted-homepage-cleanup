/**
 * Stats Section Animations
 * Enhanced counter animations with GSAP
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Ensure ScrollTrigger is registered before any animations
gsap.registerPlugin(ScrollTrigger);

/**
 * Animate a number counter from 0 to target value
 * Uses GSAP for smoother, more controllable animation
 */
function animateCounter(element: HTMLElement, targetValue: number, duration = 2): void {
  const counter = { value: 0 };

  gsap.to(counter, {
    value: targetValue,
    duration,
    ease: 'power2.out',
    onUpdate: () => {
      // Handle integer vs decimal display
      const displayValue = targetValue % 1 === 0
        ? Math.round(counter.value)
        : counter.value.toFixed(1);

      // Find existing percent/unit span and preserve it
      const percentSpan = element.querySelector('.percent');
      if (percentSpan) {
        element.innerHTML = `${displayValue}${percentSpan.outerHTML}`;
      } else {
        element.textContent = String(displayValue);
      }
    },
  });
}

/**
 * Initialize impact stats counter animations
 * Triggered on scroll into view
 */
export function initStatsCounters(): void {
  const impactSection = document.querySelector('.impact');
  if (!impactSection) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Find all stat values with data-count attribute
  const statValues = impactSection.querySelectorAll('.impact-stat-value[data-count]');

  statValues.forEach((element) => {
    const el = element as HTMLElement;
    const targetValue = parseFloat(el.dataset.count || '0');

    if (prefersReducedMotion) {
      // Immediately show final value for reduced motion
      const percentSpan = el.querySelector('.percent');
      if (percentSpan) {
        el.innerHTML = `${targetValue}${percentSpan.outerHTML}`;
      } else {
        el.textContent = String(targetValue);
      }
      return;
    }

    // Create ScrollTrigger to animate when in view
    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        // Add active class for CSS styling
        el.closest('.impact-stat')?.classList.add('active');

        // Animate the counter
        animateCounter(el, targetValue, 2.5);
      },
    });
  });
}

/**
 * Initialize business stats counters (if present)
 */
export function initBusinessStats(): void {
  const businessSection = document.querySelector('.business');
  if (!businessSection) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  // Animate business stats on scroll
  const statValues = businessSection.querySelectorAll('.business-stat-value');

  statValues.forEach((element, index) => {
    gsap.fromTo(
      element,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: element,
          start: 'top 90%',
          once: true,
        },
        delay: index * 0.15,
      }
    );
  });
}

/**
 * Initialize all stats animations
 */
export function initStatsAnimations(): void {
  initStatsCounters();
  initBusinessStats();
}
