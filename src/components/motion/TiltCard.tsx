import { useRef, type ReactNode, useState, useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform, animate } from "framer-motion";
import { cn } from "@/lib/utils";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  intensity?: number; // degrees, default 8
  glow?: boolean;
}

export function TiltCard({ children, className, intensity = 8, glow = false }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsTouchDevice(window.matchMedia("(hover: none)").matches);
    }
  }, []);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const springConfig = { stiffness: 300, damping: 30, mass: 0.5 };
  const rotateX = useSpring(useTransform(rawY, [-0.5, 0.5], [intensity, -intensity]), springConfig);
  const rotateY = useSpring(useTransform(rawX, [-0.5, 0.5], [-intensity, intensity]), springConfig);
  const glowX   = useSpring(useTransform(rawX, [-0.5, 0.5], [0, 100]), springConfig);
  const glowY   = useSpring(useTransform(rawY, [-0.5, 0.5], [0, 100]), springConfig);

  // Dynamic soft drop shadow that responds to tilt direction
  const shadowX = useSpring(useTransform(rawX, [-0.5, 0.5], [12, -12]), springConfig);
  const shadowY = useSpring(useTransform(rawY, [-0.5, 0.5], [16, -16]), springConfig);
  const boxShadow = useTransform(
    [shadowX, shadowY],
    ([sx, sy]) => `${sx}px ${sy}px 36px oklch(0.50 0.20 265 / 0.08), 0 8px 16px oklch(0 0 0 / 0.03)`
  );

  // Breathing animation on touch devices
  useEffect(() => {
    if (isTouchDevice) {
      const animX = animate(rawX, [-0.2, 0.2, -0.2], {
        duration: 5,
        repeat: Infinity,
        ease: "easeInOut",
      });
      const animY = animate(rawY, [-0.15, 0.15, -0.15], {
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut",
        delay: 0.5,
      });
      return () => {
        animX.stop();
        animY.stop();
      };
    }
  }, [isTouchDevice]);

  function handleMouse(e: React.MouseEvent<HTMLDivElement>) {
    if (isTouchDevice || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    rawX.set((e.clientX - rect.left) / rect.width  - 0.5);
    rawY.set((e.clientY - rect.top)  / rect.height - 0.5);
  }

  function handleLeave() {
    if (isTouchDevice) return;
    rawX.set(0);
    rawY.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      style={{
        rotateX,
        rotateY,
        boxShadow,
        transformStyle: "preserve-3d",
        perspective: 800,
      }}
      className={cn("relative", className)}
    >
      {/* Glow overlay */}
      {glow && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: useTransform(
              [glowX, glowY],
              ([x, y]) =>
                `radial-gradient(circle at ${x}% ${y}%, oklch(0.72 0.18 265 / 0.12), transparent 60%)`
            ),
          }}
        />
      )}
      <div style={{ transform: "translateZ(0px)" }}>{children}</div>
    </motion.div>
  );
}

