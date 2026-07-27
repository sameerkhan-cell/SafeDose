/**
 * GSAP Animation System for SafeDose
 * Provides ScrollTrigger-based cinematic effects, text reveals,
 * parallax, stagger reveals, and section transitions.
 *
 * Usage:
 *   import { useScrollReveal, useParallax, useSplitReveal, useCounterOnScroll } from "@/lib/gsap";
 */

import { useEffect, useRef } from "react";
import type React from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register plugin only in browser — SSR (Vercel Node.js) has no DOM
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// ── Shared easing ─────────────────────────────────────────────────────────────
export const EASE_PREMIUM  = "power3.out";
export const EASE_ELASTIC  = "elastic.out(1, 0.5)";
export const EASE_BACK     = "back.out(1.7)";
export const EASE_CINEMATIC = "expo.out";

// ── useScrollReveal — fade + slide up on scroll ───────────────────────────────
export function useScrollReveal(
  options: {
    y?: number;
    duration?: number;
    delay?: number;
    stagger?: number;
    ease?: string;
    once?: boolean;
    start?: string;
  } = {}
) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const {
      y = 40,
      duration = 0.9,
      delay = 0,
      stagger = 0.1,
      ease = EASE_CINEMATIC,
      start = "top 88%",
    } = options;

    const targets = el.querySelectorAll("[data-reveal]");
    const animate = targets.length > 0 ? targets : [el];

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(animate, { opacity: 1, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        animate,
        { opacity: 0, y, willChange: "transform, opacity" },
        {
          opacity: 1,
          y: 0,
          duration,
          delay,
          stagger,
          ease,
          clearProps: "willChange",
          scrollTrigger: {
            trigger: el,
            start,
            once: true,
          },
        }
      );
    }, el);

    return () => ctx.revert();
  }, []);

  return ref;
}

// ── useSplitReveal — word-by-word cinematic text reveal ───────────────────────
export function useSplitReveal(options: { delay?: number; stagger?: number; ease?: string } = {}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const { delay = 0.1, stagger = 0.07, ease = EASE_CINEMATIC } = options;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    // Split into word spans
    const original = el.innerHTML;
    const words = el.innerText.split(" ");
    el.innerHTML = words
      .map((w) => `<span class="gsap-word" style="display:inline-block;overflow:hidden;"><span class="gsap-word-inner" style="display:inline-block;">${w}</span></span>`)
      .join(" ");

    const inners = el.querySelectorAll(".gsap-word-inner");

    const ctx = gsap.context(() => {
      gsap.fromTo(
        inners,
        { y: "105%", opacity: 0, willChange: "transform, opacity" },
        {
          y: "0%",
          opacity: 1,
          duration: 1,
          delay,
          stagger,
          ease,
          clearProps: "willChange",
          scrollTrigger: {
            trigger: el,
            start: "top 90%",
            once: true,
          },
        }
      );
    }, el);

    return () => {
      ctx.revert();
      el.innerHTML = original;
    };
  }, []);

  return ref as React.RefObject<any>;
}

// ── useParallax — smooth parallax scroll depth ────────────────────────────────
export function useParallax(speed: number = 0.3) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const ctx = gsap.context(() => {
      gsap.to(el, {
        yPercent: speed * -100,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
    }, el);

    return () => ctx.revert();
  }, [speed]);

  return ref;
}

// ── useStaggerReveal — stagger children on scroll ─────────────────────────────
export function useStaggerReveal(
  selector: string = "[data-stagger]",
  options: { y?: number; duration?: number; stagger?: number; start?: string } = {}
) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const { y = 32, duration = 0.8, stagger = 0.12, start = "top 85%" } = options;
    const items = el.querySelectorAll(selector);
    if (!items.length) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(items, { opacity: 1, y: 0, scale: 1 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        items,
        { opacity: 0, y, scale: 0.96, willChange: "transform, opacity" },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration,
          stagger,
          ease: EASE_CINEMATIC,
          clearProps: "willChange",
          scrollTrigger: {
            trigger: el,
            start,
            once: true,
          },
        }
      );
    }, el);

    return () => ctx.revert();
  }, [selector]);

  return ref;
}

// ── useCounterOnScroll — animate number from 0 to value ──────────────────────
export function useCounterOnScroll(target: number, duration: number = 2) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = target.toLocaleString();
      return;
    }

    const obj = { val: 0 };
    const ctx = gsap.context(() => {
      gsap.to(obj, {
        val: target,
        duration,
        ease: EASE_PREMIUM,
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          once: true,
        },
        onUpdate: () => {
          el.textContent = Math.round(obj.val).toLocaleString();
        },
      });
    }, el);

    return () => ctx.revert();
  }, [target, duration]);

  return ref;
}

// ── useHeroTimeline — cinematic GSAP hero entrance ───────────────────────────
export function useHeroTimeline(containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set("[data-hero-badge], [data-hero-h1], [data-hero-sub], [data-hero-badges], [data-hero-cta], [data-hero-mock]", {
        opacity: 1,
        y: 0,
        scale: 1,
      });
      return;
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: EASE_CINEMATIC } });

      tl.fromTo("[data-hero-badge]",  { opacity: 0, y: 20, scale: 0.9, willChange: "transform, opacity" }, { opacity: 1, y: 0, scale: 1, duration: 0.7, clearProps: "willChange" })
        .fromTo("[data-hero-h1]",     { opacity: 0, y: 40, rotateX: 8, transformPerspective: 600, willChange: "transform, opacity" },             { opacity: 1, y: 0, rotateX: 0, duration: 0.9, clearProps: "transform,willChange" }, "-=0.4")
        .fromTo("[data-hero-sub]",    { opacity: 0, y: 24, willChange: "transform, opacity" },             { opacity: 1, y: 0, duration: 0.8, clearProps: "willChange" }, "-=0.6")
        .fromTo("[data-hero-badges]", { opacity: 0, y: 16, willChange: "transform, opacity" },             { opacity: 1, y: 0, duration: 0.6, clearProps: "willChange" }, "-=0.5")
        .fromTo("[data-hero-cta]",    { opacity: 0, y: 16, scale: 0.95, willChange: "transform, opacity" }, { opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.08, clearProps: "willChange" }, "-=0.4")
        .fromTo("[data-hero-mock]",   { opacity: 0, y: 64, scale: 0.96, willChange: "transform, opacity" }, { opacity: 1, y: 0, scale: 1, duration: 1.1, ease: "expo.out", clearProps: "willChange" }, "-=0.3");

      // Parallax on orbs
      gsap.to("[data-orb-1]", { y: -80, ease: "none", scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: 1.5 } });
      gsap.to("[data-orb-2]", { y: -50, ease: "none", scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: 1 } });
      gsap.to("[data-hero-mock]", { y: 40, ease: "none", scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: 1.2 } });
    }, el);

    return () => ctx.revert();
  }, []);
}

// ── useSectionPinReveal — pin + wipe reveal for feature sections ──────────────
export function useHorizontalStagger(options: { stagger?: number; start?: string } = {}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const { stagger = 0.15, start = "top 80%" } = options;
    const cards = el.children;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(cards, { opacity: 1, x: 0, rotateY: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        cards,
        { opacity: 0, x: -30, rotateY: 8, willChange: "transform, opacity" },
        {
          opacity: 1,
          x: 0,
          rotateY: 0,
          duration: 0.85,
          stagger,
          ease: EASE_CINEMATIC,
          clearProps: "all",
          scrollTrigger: {
            trigger: el,
            start,
            once: true,
          },
        }
      );
    }, el);

    return () => ctx.revert();
  }, []);

  return ref;
}

// ── useGlowOnScroll — intensity glow as section scrolls into view ─────────────
export function useGlowOnScroll() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { boxShadow: "0 0 0px 0px oklch(0.50 0.20 265 / 0)" },
        {
          boxShadow: "0 0 60px 20px oklch(0.50 0.20 265 / 0.15)",
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top 75%",
            end: "bottom 25%",
            scrub: true,
          },
        }
      );
    }, el);

    return () => ctx.revert();
  }, []);

  return ref;
}

// ── useStatCounters — animate all stat counters on scroll ─────────────────────
export function useStatCounters() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const counters = el.querySelectorAll<HTMLElement>("[data-count]");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      counters.forEach((counter) => {
        const target = Number(counter.dataset.count ?? 0);
        counter.textContent = target.toLocaleString() + (counter.dataset.suffix ?? "");
      });
      return;
    }

    const ctx = gsap.context(() => {
      counters.forEach((counter) => {
        const target = Number(counter.dataset.count ?? 0);
        const obj = { val: 0 };
        gsap.to(obj, {
          val: target,
          duration: 2.2,
          ease: EASE_PREMIUM,
          scrollTrigger: {
            trigger: counter,
            start: "top 88%",
            once: true,
          },
          onUpdate: () => {
            counter.textContent = Math.round(obj.val).toLocaleString() + (counter.dataset.suffix ?? "");
          },
        });
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return ref;
}
