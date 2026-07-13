import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { SmoothScrollProvider } from "./SmoothScrollProvider";

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <SmoothScrollProvider>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </SmoothScrollProvider>
  );
}
