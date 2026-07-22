import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-5">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-elegant mb-6">
          <span className="text-3xl font-bold">404</span>
        </div>
        <h2 className="heading-md">Page not found</h2>
        <p className="mt-3 text-[14px] text-muted-foreground leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-gradient-primary px-7 py-2.5 text-[14px] font-medium text-primary-foreground shadow-elegant transition-all duration-300 hover:shadow-card-hover hover:scale-[1.02]"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-5">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-destructive/10 text-destructive mb-6">
          <span className="text-2xl font-bold">!</span>
        </div>
        <h1 className="heading-md">
          This page didn't load
        </h1>
        <p className="mt-3 text-[14px] text-muted-foreground leading-relaxed">
          {error?.message || "Something went wrong on our end. You can try refreshing or head back home."}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-gradient-primary px-7 py-2.5 text-[14px] font-medium text-primary-foreground shadow-elegant transition-all duration-300 hover:shadow-card-hover hover:scale-[1.02]"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border/60 bg-card px-7 py-2.5 text-[14px] font-medium text-foreground transition-all duration-300 hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MediVerify — Scan Karo, Safe Raho" },
      { name: "description", content: "AI + blockchain powered fake medicine detection. Verify any medicine in seconds." },
      { name: "author", content: "MediVerify" },
      { property: "og:title", content: "MediVerify — Scan Karo, Safe Raho" },
      { property: "og:description", content: "AI + blockchain powered fake medicine detection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@MediVerify" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const path = window.location.pathname;
                  let portal = 'public';
                  
                  if (path.startsWith('/dashboard')) {
                    let role = null;
                    try {
                      const raw = localStorage.getItem('mediverify_session') || sessionStorage.getItem('mediverify_session');
                      if (raw) {
                        const session = JSON.parse(raw);
                        if (session && session.user && session.user.role) {
                          role = session.user.role.toLowerCase();
                        }
                      }
                    } catch (e) {}

                    if (role === 'admin' || role === 'super_admin' || role === 'drap_admin') portal = 'admin';
                    else if (role === 'manufacturer') portal = 'manufacturer';
                    else if (role === 'pharmacy') portal = 'pharmacy';
                    else if (role === 'regulator') portal = 'regulator';
                    else if (role === 'customer' || role === 'patient') portal = 'patient';
                    else {
                      if (path.includes('/dashboard/admin')) portal = 'admin';
                      else if (path.includes('/dashboard/manufacturer')) portal = 'manufacturer';
                      else if (path.includes('/dashboard/pharmacy')) portal = 'pharmacy';
                      else if (path.includes('/dashboard/regulator')) portal = 'regulator';
                      else if (path.includes('/dashboard/patient')) portal = 'patient';
                    }
                  }
                  
                  const theme = localStorage.getItem('theme-' + portal) || 'light';
                  if (theme === 'system') {
                    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                    document.documentElement.classList.add(systemTheme);
                  } else if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })()
            `,
          }}
        />
      </head>
      <body>
        {children}
        <script src="https://accounts.google.com/gsi/client" async defer></script>
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <Outlet />
          <Toaster
            position="top-right"
            toastOptions={{
              classNames: {
                toast:
                  "!bg-card !border-border/60 !shadow-elegant !rounded-2xl !font-sans",
                title: "!text-foreground !text-[13px] !font-semibold",
                description: "!text-muted-foreground !text-[12px]",
                success: "!border-success/20",
                error: "!border-destructive/20",
                info: "!border-primary/20",
              },
            }}
          />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
