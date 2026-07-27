import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Settings, Shield, Bell, Eye, Globe, Palette, Lock, Mail,
  Smartphone, Monitor, CheckCircle2, Loader2, Save, Key,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { authService } from "@/services/auth";
import { DASH_NAV } from "@/config/nav";
import { DashShell } from "@/components/dashboard/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ease } from "@/lib/motion";
import { useTheme } from "@/lib/theme-context";

export const Route = createFileRoute("/dashboard/settings")({
  head: () => ({ meta: [{ title: "Settings — SafeDose" }] }),
  component: SettingsPage,
});

function parseUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Unknown Device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) && !/Chrome/.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Browser";
  const os = /iPhone/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : "Unknown OS";
  return `${browser} · ${os}`;
}

function SettingsPage() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/auth/login" />;

  const [tab, setTab] = useState<"account" | "security" | "notifications" | "privacy" | "appearance">("account");

  const tabs = [
    { id: "account" as const, label: "Account", icon: Settings },
    { id: "security" as const, label: "Security", icon: Shield },
    { id: "notifications" as const, label: "Notifications", icon: Bell },
    { id: "privacy" as const, label: "Privacy", icon: Eye },
    { id: "appearance" as const, label: "Appearance", icon: Palette },
  ];

  return (
    <DashShell title="Settings" subtitle="Manage your account preferences" badge="Settings" nav={DASH_NAV}>
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease }}
          className="card-premium p-2 h-fit">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-4 py-2.5 text-[13px] font-medium transition-all ${tab === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"}`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </motion.div>

        {/* Content */}
        <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }}>
          {tab === "account" && <AccountSettings />}
          {tab === "security" && <SecuritySettings />}
          {tab === "notifications" && <NotificationSettings />}
          {tab === "privacy" && <PrivacySettings />}
          {tab === "appearance" && <AppearanceSettings />}
        </motion.div>
      </div>
    </DashShell>
  );
}

function Toggle({ label, desc, defaultOn = false }: { label: string; desc: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="group flex items-center justify-between p-4 rounded-xl bg-secondary/20 border border-border/30 transition-all hover:bg-secondary/30">
      <div className="space-y-0.5">
        <p className="text-[13px] font-semibold tracking-tight">{label}</p>
        <p className="text-[11px] text-muted-foreground leading-tight">{desc}</p>
      </div>
      <Switch checked={on} onCheckedChange={setOn} />
    </div>
  );
}

function AccountSettings() {
  const { user, session, signIn } = useAuth();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(user?.fullName || "");
  const [email, setEmail] = useState(user?.email || "");

  const save = async () => {
    if (!session?.token) return;
    setSaving(true);
    const res = await authService.updateProfile({ name, email }, session.token);
    setSaving(false);

    if (res.success && res.data) {
      toast.success("Account updated");
      // Update local session
      const updatedUser = { ...user!, fullName: res.data.name, email: res.data.email };
      signIn({ ...session, user: updatedUser }, true);
    } else {
      toast.error(res.error?.message || "Failed to update profile");
    }
  };

  return (
    <div className="card-premium p-6 space-y-5">
      <h3 className="text-[16px] font-semibold flex items-center gap-2"><Settings className="h-4 w-4 text-primary" /> Account Settings</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider mb-1.5 block">Full Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} className="h-11 rounded-xl bg-secondary/20" />
        </div>
        <div>
          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider mb-1.5 block">Email</label>
          <Input value={email} onChange={e => setEmail(e.target.value)} type="email" className="h-11 rounded-xl bg-secondary/20" />
        </div>
      </div>
      <div>
        <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider mb-1.5 block">Role</label>
        <div className="h-11 rounded-xl border border-border/60 bg-secondary/30 px-4 flex items-center text-[14px] text-muted-foreground capitalize">{user?.role === "customer" ? "Patient" : user?.role}</div>
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="rounded-xl bg-gradient-primary shadow-elegant text-[13px]">
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save</>}
        </Button>
      </div>
    </div>
  );
}

function SecuritySettings() {
  const { user, session } = useAuth();
  const [saving, setSaving] = useState(false);
  const [curr, setCurr] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const [twoFA, setTwoFA] = useState(user?.twoFactorEnabled ?? false);
  const [twoFASaving, setTwoFASaving] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.twoFactorEnabled !== undefined) {
      setTwoFA(user.twoFactorEnabled);
    }
  }, [user?.twoFactorEnabled]);

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch("/api/auth/sessions", { headers: { Authorization: `Bearer ${session?.token ?? ""}` } });
      const data = await res.json();
      if (data.success) setSessions(data.data);
    } catch {
      // silent fallback
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.token) loadSessions();
  }, [session?.token]);

  const validatePassword = (pwd: string) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(pwd);
    const hasLowerCase = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    return pwd.length >= minLength && hasUpperCase && hasLowerCase && hasNumber;
  };

  const save = async () => {
    if (!session?.token) return;
    if (!curr) { toast.error("Enter current password"); return; }
    if (!validatePassword(next)) {
      toast.error("New password must be at least 8 characters and include uppercase, lowercase, and numbers");
      return;
    }
    if (next !== confirm) { toast.error("Passwords don't match"); return; }

    setSaving(true);
    const res = await authService.changePassword({
      currentPassword: curr,
      newPassword: next
    }, session.token);
    setSaving(false);

    if (res.success) {
      setCurr(""); setNext(""); setConfirm("");
      toast.success("Password changed successfully");
    } else {
      toast.error(res.error?.message || "Failed to update password");
    }
  };

  return (
    <div className="space-y-5">
      <form
        className="card-premium p-6 space-y-4"
        onSubmit={(e) => { e.preventDefault(); save(); }}
        autoComplete="on"
      >
        <h3 className="text-[16px] font-semibold flex items-center gap-2"><Lock className="h-4 w-4 text-primary" /> Change Password</h3>
        <div>
          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider mb-1.5 block">Current Password</label>
          <Input
            value={curr}
            onChange={e => setCurr(e.target.value)}
            type="password"
            autoComplete="current-password"
            name="current-password"
            className="h-11 rounded-xl bg-secondary/20"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider mb-1.5 block">New Password</label>
            <Input
              value={next}
              onChange={e => setNext(e.target.value)}
              type="password"
              autoComplete="new-password"
              name="new-password"
              className="h-11 rounded-xl bg-secondary/20"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider mb-1.5 block">Confirm Password</label>
            <Input
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              type="password"
              autoComplete="new-password"
              name="confirm-password"
              className="h-11 rounded-xl bg-secondary/20"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="rounded-xl bg-gradient-primary shadow-elegant text-[13px]">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</> : <><Key className="mr-2 h-4 w-4" />Update Password</>}
          </Button>
        </div>
      </form>
      <div className="card-premium p-6 space-y-3">
        <h3 className="text-[16px] font-semibold flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Two-Factor Authentication</h3>
        <div className="group flex items-center justify-between p-4 rounded-xl bg-secondary/20 border border-border/30 transition-all hover:bg-secondary/30">
          <div className="space-y-0.5">
            <p className="text-[13px] font-semibold tracking-tight">Enable 2FA</p>
            <p className="text-[11px] text-muted-foreground leading-tight">Add an extra layer of security to your account — you'll receive a code by email at every login.</p>
          </div>
          <Switch
            checked={twoFA}
            disabled={twoFASaving}
            onCheckedChange={async (checked) => {
              setTwoFASaving(true);
              const prev = twoFA;
              setTwoFA(checked);
              try {
                const res = await fetch("/api/auth/two-factor", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.token ?? ""}` },
                  body: JSON.stringify({ enabled: checked })
                });
                const data = await res.json();
                if (!data.success) { setTwoFA(prev); toast.error(data.error ?? "Failed to update 2FA."); }
                else toast.success(checked ? "2FA enabled." : "2FA disabled.");
              } catch { setTwoFA(prev); toast.error("Failed to update 2FA."); }
              finally { setTwoFASaving(false); }
            }}
          />
        </div>
      </div>
      <div className="card-premium p-6 space-y-3">
        <h3 className="text-[16px] font-semibold flex items-center gap-2"><Monitor className="h-4 w-4 text-primary" /> Active Sessions</h3>
        {sessionsLoading ? (
          <p className="text-xs text-muted-foreground">Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active sessions found.</p>
        ) : sessions.map((s, i) => (
          <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/20 border border-border/30">
            <div className="flex items-center gap-3">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[13px] font-medium">{parseUserAgent(s.userAgent)}</p>
                <p className="text-[10px] text-muted-foreground">{s.location ?? s.ipAddress ?? "Unknown"} · {new Date(s.createdAt).toLocaleString()}</p>
              </div>
            </div>
            {i === 0 ? (
              <span className="text-[10px] text-success font-bold flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Current</span>
            ) : (
              <Button
                size="sm" variant="outline" className="h-7 text-[11px] rounded-lg"
                disabled={revokingId === s.id}
                onClick={async () => {
                  setRevokingId(s.id);
                  try {
                    const res = await fetch(`/api/auth/sessions/${s.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${session?.token ?? ""}` } });
                    const data = await res.json();
                    if (data.success) { toast.success("Session revoked."); loadSessions(); }
                    else toast.error(data.error ?? "Failed to revoke session.");
                  } finally { setRevokingId(null); }
                }}
              >
                {revokingId === s.id ? "Revoking..." : "Revoke"}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationSettings() {
  return (
    <div className="card-premium p-6 space-y-3">
      <h3 className="text-[16px] font-semibold flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Notification Preferences</h3>
      <Toggle label="Email Notifications" desc="Receive verification alerts via email" defaultOn />
      <Toggle label="Push Notifications" desc="Browser push notifications for scan alerts" defaultOn />
      <Toggle label="Fraud Alerts" desc="Immediate alerts for suspicious activity" defaultOn />
      <Toggle label="Weekly Report" desc="Receive weekly verification summary" />
      <Toggle label="Marketing Updates" desc="Product updates and feature announcements" />
    </div>
  );
}

function PrivacySettings() {
  return (
    <div className="card-premium p-6 space-y-3">
      <h3 className="text-[16px] font-semibold flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /> Privacy Settings</h3>
      <Toggle label="Profile Visibility" desc="Make your profile visible to other users" defaultOn />
      <Toggle label="Activity Status" desc="Show when you're active on the platform" defaultOn />
      <Toggle label="Analytics Sharing" desc="Help improve SafeDose by sharing usage data" />
      <Toggle label="Search Engine Indexing" desc="Allow your public profile to be indexed" />
    </div>
  );
}

function AppearanceSettings() {
  const { theme, setTheme, portal } = useTheme();

  const themes: { label: "Light" | "Dark" | "System"; value: "light" | "dark" | "system" }[] = [
    { label: "Light", value: "light" },
    { label: "Dark", value: "dark" },
    { label: "System", value: "system" }
  ];

  return (
    <div className="card-premium p-6 space-y-3">
      <h3 className="text-[16px] font-semibold flex items-center gap-2"><Palette className="h-4 w-4 text-primary" /> Appearance</h3>
      <p className="text-[11px] text-muted-foreground leading-tight">
        Customize the theme of your portal. This setting only applies to the <span className="font-semibold capitalize">{portal === "public" ? "patient" : portal}</span> dashboard.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {themes.map(t => {
          const active = theme === t.value;
          return (
            <button
              key={t.value}
              onClick={() => {
                setTheme(t.value);
                toast.success(`Theme set to ${t.label} for ${portal === "public" ? "patient" : portal} dashboard`);
              }}
              className={`rounded-xl border p-4 text-center text-[13px] font-medium transition-all cursor-pointer ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/40 bg-secondary/20 text-muted-foreground hover:bg-accent"
              } ${t.value === "system" ? "col-span-2 sm:col-span-1" : ""}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <Toggle label="Reduce Animations" desc="Minimize motion effects for accessibility" />
      <Toggle label="Compact Mode" desc="Use smaller spacing and text sizes" />
    </div>
  );
}
