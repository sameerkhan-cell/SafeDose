import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useRouterState } from "@tanstack/react-router";
import { X, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboard } from "./DashboardContext";
import { ease } from "@/lib/motion";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  to?: string;
  label: string;
  icon: LucideIcon;
  group?: string;
  onClick?: () => void;
  isActive?: boolean;
}

export function MobileSidebar({ nav }: { nav: readonly NavItem[] }) {
  const { mobileOpen, setMobileOpen } = useDashboard();
  const path = useRouterState({ select: (s) => s.location.pathname });

  // Close on route change
  useEffect(() => { setMobileOpen(false); }, [path, setMobileOpen]);

  // Lock scroll when open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <AnimatePresence>
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer */}
          <motion.aside
            key="drawer"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.32, ease }}
            className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border/60 bg-card/95 backdrop-blur-xl lg:hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary shadow-elegant">
                  <ShieldCheck className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-[13px] font-black tracking-tight">MediVerify</p>
                  <p className="text-[9px] text-muted-foreground">Command Center</p>
                </div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-xl border border-border/60 text-muted-foreground transition-colors hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
              {nav.map((item, i) => {
                const isActive = item.onClick ? (item.isActive ?? false) : path === item.to;
                const showDivider = i > 0 && item.group && nav[i - 1].group !== item.group;
                const Icon = item.icon;

                const content = (
                  <>
                    {isActive && (
                      <>
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-primary" />
                        <motion.div
                          className="absolute inset-0 rounded-xl"
                          style={{ background: "oklch(0.50 0.20 265 / 0.08)", boxShadow: "inset 0 0 20px oklch(0.50 0.20 265 / 0.1)" }}
                          layoutId="mobile-active-bg"
                          transition={{ duration: 0.25, ease }}
                        />
                      </>
                    )}
                    <span className={cn(
                      "relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-all duration-200",
                      isActive ? "bg-primary/15 text-primary" : "bg-border/40 text-muted-foreground"
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="relative z-10">{item.label}</span>
                    {isActive && (
                      <motion.span
                        className="relative z-10 ml-auto h-1.5 w-1.5 rounded-full bg-primary"
                        animate={{ scale: [1, 1.5, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                  </>
                );

                const linkClass = cn(
                  "relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-medium transition-all duration-200 w-full text-left",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                );

                return (
                  <div key={item.to || item.label}>
                    {showDivider && <div className="my-2 border-t border-border/40" />}
                    {item.onClick ? (
                      <button onClick={item.onClick} className={linkClass}>
                        {content}
                      </button>
                    ) : (
                      <Link
                        to={item.to!}
                        className={linkClass}
                      >
                        {content}
                      </Link>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="border-t border-border/40 p-3">
              <div className="flex items-center gap-3 rounded-xl bg-secondary/40 px-3 py-2.5">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-primary text-[11px] font-black text-primary-foreground shadow-elegant">
                  MV
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold">MediVerify Pro</p>
                  <p className="text-[10px] text-muted-foreground">Enterprise · Verified</p>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
