import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  User, Settings, LogOut, ChevronDown, ShieldCheck,
  Building2, Stethoscope, Cpu, Shield,
} from "lucide-react";
import { ease } from "@/lib/motion";
import type { UserRole } from "@/types/auth";
import { useAuth } from "@/lib/auth-context";
import { authService } from "@/services/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UserProfileMenuProps {
  name?: string;
  email?: string;
  role?: UserRole;
  logoUrl?: string;
  companyLogo?: string;
  avatar?: string;
}

const ROLE_CFG: Record<UserRole, { label: string; icon: typeof User; color: string; bg: string }> = {
  customer: { label: "Patient", icon: User, color: "#1a56db", bg: "#1a56db15" },
  pharmacy: { label: "Pharmacy", icon: Stethoscope, color: "#16a34a", bg: "#16a34a15" },
  manufacturer: { label: "Manufacturer", icon: Building2, color: "#8b5cf6", bg: "#8b5cf615" },
  admin: { label: "Admin", icon: Shield, color: "#dc2626", bg: "#dc262615" },
  super_admin: { label: "Super Admin", icon: Shield, color: "#dc2626", bg: "#dc262615" },
  drap_admin: { label: "Admin", icon: Shield, color: "#dc2626", bg: "#dc262615" },
};

const MENU_ITEMS = [
  { icon: User, label: "My Profile", to: "/dashboard/profile" },
  { icon: ShieldCheck, label: "Security", to: "/dashboard/settings" },
  { icon: Cpu, label: "API Access", to: "/dashboard/settings" },
  { icon: Settings, label: "Settings", to: "/dashboard/settings" },
];

export function UserProfileMenu({
  name = "MediVerify User",
  email = "user@mediverify.com",
  role = "customer",
  logoUrl: propLogoUrl,
  companyLogo: propCompanyLogo,
  avatar: propAvatar,
}: UserProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { signOut, session, user } = useAuth();

  const activeLogoUrl = propLogoUrl || propCompanyLogo || propAvatar || user?.logoUrl || user?.companyLogo || user?.avatar;
  const hasLogo = Boolean(activeLogoUrl && !imgError);

  const cfg = ROLE_CFG[role] || ROLE_CFG.customer;
  const RoleIcon = cfg.icon;
  const initials = name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase() || "U";

  useEffect(() => {
    setImgError(false);
  }, [activeLogoUrl]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    const loadingToast = toast.loading("Signing out securely...");
    try {
      if (session?.token) {
        await authService.logout(session.token);
      }
      signOut();
      toast.dismiss(loadingToast);
      toast.success("Signed out", { description: "You have been logged out successfully." });
      navigate({ to: "/auth/login" });
    } catch (err) {
      toast.dismiss(loadingToast);
      signOut();
      navigate({ to: "/auth/login" });
    }
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/80 px-2.5 py-1.5 backdrop-blur transition-all duration-200 hover:bg-accent hover:border-primary/30"
      >
        {/* Avatar */}
        <div
          className={cn(
            "relative grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-lg",
            hasLogo ? "border border-border/40 bg-secondary/10" : "text-[11px] font-black text-white"
          )}
          style={
            hasLogo
              ? undefined
              : { background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}99)`, boxShadow: `0 0 12px ${cfg.color}55` }
          }
        >
          {hasLogo ? (
            <img
              src={activeLogoUrl!}
              alt={name}
              className="h-full w-full object-cover rounded-lg"
              onError={() => setImgError(true)}
            />
          ) : (
            initials
          )}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-[12px] font-semibold leading-none">{name}</p>
          <p className="mt-0.5 text-[9px] text-muted-foreground leading-none capitalize">{cfg.label}</p>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </motion.div>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.2, ease }}
            className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-elegant backdrop-blur-xl"
          >
            {/* User info */}
            <div className="border-b border-border/40 p-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl",
                    hasLogo ? "border border-border/40 bg-secondary/10" : "text-[14px] font-black text-white"
                  )}
                  style={
                    hasLogo
                      ? undefined
                      : { background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)`, boxShadow: `0 0 20px ${cfg.color}44` }
                  }
                >
                  {hasLogo ? (
                    <img
                      src={activeLogoUrl!}
                      alt={name}
                      className="h-full w-full object-cover rounded-xl"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold">{name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{email}</p>
                  <div
                    className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    <RoleIcon className="h-2.5 w-2.5" />
                    {cfg.label}
                    {(role === "manufacturer" || role === "pharmacy") && (
                      <span className="ml-1 opacity-70">
                        · {session?.user?.isVerified ? "Verified" : "Unverified"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Menu items */}
            <nav className="p-1.5">
              {MENU_ITEMS.filter(item => {
                if (item.label === "API Access") {
                  return role !== "customer" && role !== "pharmacy" && role !== "manufacturer";
                }
                return true;
              }).map(item => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground"
                  >
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-border/40">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Sign out */}
            <div className="border-t border-border/40 p-1.5">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium text-destructive transition-all duration-150 hover:bg-destructive/8"
              >
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-destructive/10">
                  <LogOut className="h-3.5 w-3.5" />
                </span>
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
