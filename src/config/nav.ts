/**
 * Shared navigation configuration for all MediVerify dashboard pages.
 * Import DASH_NAV in every route that uses DashShell — do NOT redeclare locally.
 *
 * Usage:
 *   import { DASH_NAV } from "@/config/nav";
 *   <DashShell nav={DASH_NAV} ...>
 */

import {
  BarChart3,
  Stethoscope,
  Activity,
  Hash,
  FileWarning,
  Globe2,
  Library,
  Shield,
} from "lucide-react";

export const DASH_NAV = [
  { to: "/dashboard/manufacturer", label: "Manufacturer", icon: BarChart3, group: "main", roles: ["manufacturer"] },
  { to: "/dashboard/pharmacy", label: "Pharmacy", icon: Stethoscope, group: "main", roles: ["pharmacy"] },
  { to: "/dashboard/monitoring", label: "Intelligence Center", icon: Activity, group: "main", roles: ["manufacturer", "pharmacy"] },

  { to: "/dashboard/blockchain", label: "Blockchain", icon: Hash, group: "main", roles: ["manufacturer", "pharmacy"] },
  { to: "/dashboard/admin", label: "DRAP Admin", icon: Shield, group: "main", roles: ["ADMIN", "SUPER_ADMIN", "DRAP_ADMIN"] },
  { to: "/dashboard/qr-library", label: "QR Library", icon: Library, group: "tools", roles: ["manufacturer"] },
  { to: "/report", label: "Reports", icon: FileWarning, group: "tools", roles: ["manufacturer", "pharmacy", "customer"] },
  { to: "/dashboard/settings", label: "Settings", icon: Globe2, group: "tools", roles: ["manufacturer", "pharmacy", "customer"] },
] as const;
