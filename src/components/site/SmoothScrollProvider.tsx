import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Respect prefers-reduced-motion
    if (typeof window === "undefined") return;
    
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    // Initialize Lenis
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Clean easeOutExpo
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.5,
    });

    // Update ScrollTrigger on scroll
    lenis.on("scroll", () => {
      ScrollTrigger.update();
    });

    // Integrate with GSAP ticker
    const tick = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tick);

    // Clean up
    return () => {
      lenis.destroy();
      gsap.ticker.remove(tick);
    };
  }, []);

  return <>{children}</>;
}
