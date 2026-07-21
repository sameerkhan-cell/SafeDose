/**
 * DashShell — Enterprise Dashboard Layout Shell
 *
 * Features:
 *  - Standalone layout (no public site nav/footer)
 *  - Collapsible sidebar with active glow + persistent state
 *  - Sticky top navbar with notifications + profile menu
 *  - Mobile drawer sidebar
 *  - Animated page transitions
 *  - Responsive: desktop, tablet, mobile
 */

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Menu, ChevronLeft, ChevronRight as ChevronRightIcon,
  Bell, ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ease } from "@/lib/motion";
import type { LucideIcon } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DashboardProvider, useDashboard } from "./DashboardContext";
import { NotificationDropdown } from "./NotificationDropdown";
import { UserProfileMenu } from "./UserProfileMenu";
import { MobileSidebar } from "./MobileSidebar";
import { useAuth } from "@/lib/auth-context";

gsap.registerPlugin(ScrollTrigger);

// ── Types ────────────────────────────────────────────────────────────────────

export interface NavItem {
  to?: string;
  label: string;
  icon: LucideIcon;
  group?: string;
  roles?: readonly string[];
  onClick?: () => void;
  isActive?: boolean;
}

interface DashShellProps {
  title: string;
  subtitle?: string;
  badge?: string;
  nav?: readonly NavItem[];
  children: ReactNode;
  actions?: ReactNode;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SIDEBAR_W_EXPANDED = 256;
const SIDEBAR_W_COLLAPSED = 68;

// ── Sub-components ────────────────────────────────────────────────────────────

function DesktopSidebar({ nav = [] }: { nav?: readonly NavItem[] }) {
  const { collapsed, toggleCollapsed } = useDashboard();
  const { user } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const w = collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W_EXPANDED;

  const filteredNav = nav.filter(item => !item.roles || (user?.role && item.roles.includes(user.role)));

  return (
    <motion.aside
      animate={{ width: w }}
      transition={{ duration: 0.3, ease }}
      className="hidden lg:flex flex-col border-r border-border/40 bg-card/60 backdrop-blur-xl shrink-0 overflow-hidden relative"
      style={{ width: w, minHeight: "100vh" }}
    >
      {/* Glow orb */}
      <div className="pointer-events-none absolute -top-20 -left-10 h-40 w-40 rounded-full bg-primary/8 blur-[60px]" />

      {/* Logo */}
      <div className={cn("flex items-center border-b border-border/40 py-5", collapsed ? "justify-center px-0" : "gap-3 px-5")}>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-primary shadow-elegant">
          <ShieldCheck className="h-4.5 w-4.5 text-primary-foreground h-5 w-5" />
        </div>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8, width: 0 }}
              animate={{ opacity: 1, x: 0, width: "auto" }}
              exit={{ opacity: 0, x: -8, width: 0 }}
              transition={{ duration: 0.2, ease }}
              className="overflow-hidden"
            >
              <p className="whitespace-nowrap text-[13px] font-black tracking-tight">MediVerify</p>
              <p className="whitespace-nowrap text-[9px] text-muted-foreground">Command Center</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5">
        {filteredNav.map((item, i) => {
          const isActive = item.onClick ? (item.isActive ?? false) : path === item.to;
          const showDivider = i > 0 && item.group && filteredNav[i - 1].group !== item.group;
          const Icon = item.icon;

          const content = (
            <>
              {/* Active background glow */}
              {isActive && (
                <>
                  <motion.div
                    layoutId="sidebar-active-bg"
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: "oklch(0.50 0.20 265 / 0.10)",
                      boxShadow: "inset 0 0 24px oklch(0.50 0.20 265 / 0.12)",
                    }}
                    transition={{ duration: 0.25, ease }}
                  />
                  {!collapsed && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-primary shadow-[0_0_8px_2px_oklch(0.50_0.20_265_/_0.5)]" />
                  )}
                </>
              )}

              {/* Icon */}
              <span className={cn(
                "relative z-10 grid shrink-0 place-items-center rounded-lg transition-all duration-200",
                collapsed ? "h-8 w-8" : "h-7 w-7",
                isActive
                  ? "bg-primary/15 text-primary shadow-[0_0_12px_oklch(0.50_0.20_265_/_0.3)]"
                  : "bg-border/40 text-muted-foreground"
              )}>
                <Icon className="h-3.5 w-3.5" />
              </span>

              {/* Label */}
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2, ease }}
                    className="relative z-10 whitespace-nowrap overflow-hidden text-[13px] font-medium"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Active pulse dot */}
              {isActive && !collapsed && (
                <motion.span
                  className="relative z-10 ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                  animate={{ opacity: [1, 0.3, 1], scale: [1, 1.4, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </>
          );

          const linkClass = cn(
            "relative flex items-center rounded-xl transition-all duration-200 overflow-hidden w-full text-left cursor-pointer",
            collapsed ? "justify-center p-2.5 mx-1" : "gap-3 px-3.5 py-2.5",
            isActive
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          );

          return (
            <div key={item.to || item.label}>
              {showDivider && !collapsed && <div className="my-2 mx-1 border-t border-border/40" />}
              {showDivider && collapsed && <div className="my-2" />}

              {item.onClick ? (
                <button
                  onClick={item.onClick}
                  title={collapsed ? item.label : undefined}
                  className={linkClass}
                >
                  {content}
                </button>
              ) : (
                <Link
                  to={item.to!}
                  title={collapsed ? item.label : undefined}
                  className={linkClass}
                >
                  {content}
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      {/* User card (only when expanded) */}
      <AnimatePresence initial={false}>
        {!collapsed && user && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border/40 p-3"
          >
            <div className="flex items-center gap-3 rounded-xl bg-secondary/40 px-3 py-2.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-primary text-[11px] font-black text-primary-foreground shadow-elegant">
                {user.fullName.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold">{user.fullName}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{user.role} · Verified</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapse toggle button */}
      <button
        onClick={toggleCollapsed}
        className="absolute -right-3 top-20 z-10 grid h-6 w-6 place-items-center rounded-full border border-border/60 bg-card shadow-sm text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground hover:shadow-elegant"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRightIcon className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </motion.aside>
  );
}

function TopNavbar({
  title, subtitle, badge, actions,
}: Pick<DashShellProps, "title" | "subtitle" | "badge" | "actions">) {
  const { setMobileOpen } = useDashboard();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/40 bg-card/80 px-4 backdrop-blur-xl sm:px-6">
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-border/60 bg-card/80 text-muted-foreground transition-colors hover:bg-accent lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Global Smooth Back Arrow */}
      <button
        onClick={() => window.history.back()}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-border/60 bg-card/80 text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-primary hover:border-primary/40 group"
        title="Go Back"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
      </button>

      {/* Title + badge */}
      <div className="flex flex-1 items-center gap-3 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="truncate text-[15px] font-bold tracking-tight">{title}</h1>
            {badge && (
              <span className="inline-flex items-center gap-1 rounded-full border border-success/25 bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success shrink-0">
                <motion.span
                  className="h-1.5 w-1.5 rounded-full bg-success"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="truncate text-[11px] text-muted-foreground hidden sm:block">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Right: actions + notifications + profile */}
      <div className="flex items-center gap-2 shrink-0">
        {actions && <div className="hidden sm:flex items-center gap-2">{actions}</div>}
        <NotificationDropdown />
        <UserProfileMenu name={user?.fullName || "Guest"} email={user?.email || ""} role={user?.role || "customer"} />
      </div>
    </header>
  );
}

function DashShellInner({ title, subtitle, badge, nav = [], children, actions }: DashShellProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const cards = el.querySelectorAll("[data-dash-card]");
      if (cards.length) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 28, scale: 0.97 },
          {
            opacity: 1, y: 0, scale: 1,
            duration: 0.7, stagger: 0.09, ease: "expo.out",
            scrollTrigger: { trigger: cards[0], start: "top 88%", once: true },
          }
        );
      }
    }, el);
    return () => ctx.revert();
  }, [path]);

  return (
    <div className="flex min-h-screen bg-background">
      <DesktopSidebar nav={nav} />
      <MobileSidebar nav={(nav || []).filter(item => !item.roles || (user?.role && item.roles.includes(user.role)))} />

      <div className="flex flex-1 flex-col min-w-0">
        <TopNavbar title={title} subtitle={subtitle} badge={badge} actions={actions} />

        <main ref={contentRef} className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={path}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease }}
              className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export function DashShell(props: DashShellProps) {
  return (
    <DashboardProvider>
      <DashShellInner {...props} />
    </DashboardProvider>
  );
}
