import { Link } from "@tanstack/react-router";
import { ShieldCheck, ArrowUpRight } from "lucide-react";

const PRODUCT = [
  { to: "/verify", label: "Verify Medicine" },
  { to: "/dashboard/manufacturer", label: "Manufacturer Portal" },
  { to: "/pharmacy", label: "Pharmacy Portal" },
  { to: "/monitoring", label: "Live Monitoring" },
];

const COMPANY = [
  { to: "/about", label: "About & Mission" },
  { to: "/report", label: "Report Fake" },
  { href: "#", label: "Privacy" },
  { href: "#", label: "Terms" },
];

export function Footer() {
  return (
    <footer className="relative border-t border-border/40 bg-card/30">
      {/* Subtle top gradient bleed */}
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        {/* Main grid */}
        <div className="grid gap-12 py-16 md:grid-cols-12">
          {/* Brand */}
          <div className="md:col-span-5 lg:col-span-5">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
                <ShieldCheck className="h-[18px] w-[18px]" />
              </span>
              <span className="text-[15px] font-semibold tracking-tight">SafeDose</span>
            </div>
            <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              Scan Karo, Safe Raho. AI + blockchain powered medicine
              authenticity verification trusted by manufacturers, pharmacies
              and regulators across South Asia.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["DRAP Verified", "WHO Aligned", "ISO 27001"].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border/60 bg-secondary/50 px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/20 hover:text-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Links */}
          <div className="md:col-span-3 lg:col-span-3">
            <h4 className="section-label mb-4">Product</h4>
            <ul className="space-y-2.5">
              {PRODUCT.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="group inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors duration-200 hover:text-foreground"
                  >
                    {l.label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 -translate-y-0.5 translate-x-0.5 transition-all duration-200 group-hover:opacity-60 group-hover:translate-y-0 group-hover:translate-x-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3 lg:col-span-3">
            <h4 className="section-label mb-4">Company</h4>
            <ul className="space-y-2.5">
              {COMPANY.map((l) =>
                "to" in l && l.to ? (
                  <li key={l.label}>
                    <Link
                      to={l.to}
                      className="group inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors duration-200 hover:text-foreground"
                    >
                      {l.label}
                      <ArrowUpRight className="h-3 w-3 opacity-0 -translate-y-0.5 translate-x-0.5 transition-all duration-200 group-hover:opacity-60 group-hover:translate-y-0 group-hover:translate-x-0" />
                    </Link>
                  </li>
                ) : (
                  <li key={l.label}>
                    <a
                      href={"href" in l ? l.href : "#"}
                      className="group inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors duration-200 hover:text-foreground"
                    >
                      {l.label}
                    </a>
                  </li>
                )
              )}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-start justify-between gap-3 border-t border-border/40 py-6 sm:flex-row sm:items-center">
          <p className="text-[12px] text-muted-foreground">
            © {new Date().getFullYear()} SafeDose. All rights reserved.
          </p>
          <p className="text-[12px] text-muted-foreground">
            Made with care for safer medicines worldwide.
          </p>
        </div>
      </div>
    </footer>
  );
}
