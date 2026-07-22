import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Menu, X, ArrowRight, LogOut, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { authService } from "@/services/auth";
import { UserProfileMenu } from "@/components/dashboard/UserProfileMenu";

const NAV = [
  { to: "/", label: "Home", roles: ["customer", "pharmacy", "guest"] },
  { to: "/dashboard/manufacturer", label: "Dashboard", roles: ["manufacturer"] },
  { to: "/dashboard/patient", label: "Verify", roles: ["customer", "pharmacy", "guest"] },
  { to: "/dashboard/pharmacy", label: "Pharmacy", roles: ["pharmacy"] },
  { to: "/dashboard/monitoring", label: "Live", roles: ["manufacturer", "pharmacy"] },
  { to: "/report", label: "Report", roles: ["all"] },
  { to: "/about", label: "About", roles: ["all"] },
];

const ROLE_LABELS: Record<string, string> = {
  customer: "Patient",
  pharmacy: "Pharmacy",
  manufacturer: "Manufacturer",
};

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user, isAuthenticated, signOut } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await authService.logout("");
      signOut();
      setOpen(false);
      toast.success("Signed out", { description: "You have been logged out securely." });
      navigate({ to: "/" });
    } catch {
      toast.error("Sign out failed");
    }
  };

  const initials = user?.fullName
    ? user.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  const homePath =
    isAuthenticated && user?.role === "manufacturer"
      ? "/dashboard/manufacturer"
      : "/";

  const visibleNav = NAV.filter(
    (n) =>
      n.roles.includes("all") ||
      n.roles.includes("guest") ||
      (user?.role && n.roles.includes(user.role)) ||
      (!isAuthenticated && n.roles.includes("guest"))
  );

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "glass-strong border-b border-border/40" : "bg-transparent"
      )}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Back Arrow + Logo */}
          <div className="flex items-center gap-3">
            {path !== "/" && (
              <button
                onClick={() => window.history.back()}
                className="grid h-8 w-8 place-items-center rounded-xl border border-border/60 bg-card/60 text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-primary hover:border-primary/40 group lg:mr-1"
                title="Go Back"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              </button>
            )}
            <Link to={homePath} className="group flex items-center gap-2">
              <img src="/logo.png" alt="MediVerify" className="h-6 w-6 object-contain transition-transform duration-300 group-hover:scale-105" />
              <span className="flex items-center gap-2">
                <span className="text-[15px] font-bold tracking-tight">MediVerify</span>
                <span className="hidden rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:inline">
                  DRAP · WHO
                </span>
              </span>
            </Link>
          </div>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {visibleNav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "relative rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all duration-300 hover:text-foreground",
                  path === n.to ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {n.label}
                {path === n.to && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg bg-accent/70"
                    style={{ zIndex: -1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            ))}
          </nav>

          {/* CTA / User area */}
          <div className="hidden items-center gap-3 md:flex">
            {isAuthenticated && user ? (
              <UserProfileMenu
                name={user.fullName}
                email={user.email}
                role={user.role as any}
              />
            ) : (
              <>
                <Link
                  to="/auth/login"
                  className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Sign in
                </Link>
                <Button
                  asChild
                  size="sm"
                  className="rounded-full bg-gradient-primary px-5 shadow-elegant text-[13px] font-medium transition-all duration-300 hover:shadow-card-hover hover:scale-[1.02]"
                >
                  <Link to="/dashboard/patient">
                    Verify Medicine <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden relative grid h-10 w-10 place-items-center rounded-xl transition-colors hover:bg-accent"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
          >
            <AnimatePresence mode="wait" initial={false}>
              {open ? (
                <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <X className="h-5 w-5" />
                </motion.div>
              ) : (
                <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Menu className="h-5 w-5" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="md:hidden overflow-hidden border-t border-border/40"
            >
              <div className="glass-strong px-5 py-4 flex flex-col gap-1">
                {NAV.filter(n => n.roles.includes("all") || (user?.role && n.roles.includes(user.role))).map((n, i) => (
                  <motion.div
                    key={n.to}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Link
                      to={n.to}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center rounded-xl px-4 py-2.5 text-[14px] font-medium transition-all duration-200",
                        path === n.to
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      )}
                    >
                      {n.label}
                    </Link>
                  </motion.div>
                ))}

                <div className="mt-3 pt-3 border-t border-border/40 flex flex-col gap-2">
                  {isAuthenticated && user ? (
                    <>
                      <div className="flex items-center gap-3 rounded-xl bg-secondary/40 px-4 py-3">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-primary text-[12px] font-bold text-primary-foreground shadow-elegant">
                          {initials}
                        </span>
                        <div>
                          <p className="text-[13px] font-semibold">{user.fullName}</p>
                          <p className="text-[11px] text-muted-foreground">{ROLE_LABELS[user.role]}</p>
                        </div>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center justify-center gap-2 rounded-full border border-destructive/30 bg-destructive/8 py-2.5 text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/12"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </>
                  ) : (
                    <>
                      <Button asChild variant="outline" size="default" className="w-full rounded-full font-medium">
                        <Link to="/auth/login" onClick={() => setOpen(false)}>
                          Sign in
                        </Link>
                      </Button>
                      <Button asChild size="default" className="w-full rounded-full bg-gradient-primary shadow-elegant font-medium">
                        <Link to="/dashboard/patient" onClick={() => setOpen(false)}>
                          Verify Medicine <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
