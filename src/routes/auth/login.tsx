import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, ShieldCheck, AlertCircle, User, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { authService } from "@/services/auth";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { ease } from "@/lib/motion";
import { useEffect } from "react";

declare global {
  interface Window {
    google: any;
  }
}

export const Route = createFileRoute("/auth/login")({
  head: () => ({
    meta: [
      { title: "Sign In — SafeDose" },
      { name: "description", content: "Sign in to your SafeDose account to verify medicines and manage your dashboard." },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;


function LoginPage() {
  const navigate = useNavigate();
  const { signIn, user, isAuthenticated } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { rememberMe: false },
  });

  const selectedRole = watch("role" as any);

  const ROLES: { value: string; label: string; description: string; icon: any }[] = [
    { value: "customer", label: "Patient", description: "Verify medicines", icon: User },
    { value: "pharmacy", label: "Pharmacy", description: "Bulk verification", icon: Stethoscope },
  ];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("expired") === "true") {
      // Clear URL params to avoid showing the toast repeatedly on manual refreshes
      window.history.replaceState({}, document.title, window.location.pathname);
      toast.error("Session expired", {
        description: "Your session has expired. Please sign in again.",
        duration: 5000,
      });
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      const role = user.role;
      if (role === "pharmacy") {
        navigate({ to: "/dashboard/pharmacy" });
      } else if (role === "manufacturer") {
        navigate({ to: "/dashboard/manufacturer" });
      } else if (role === "admin" || role === "super_admin" || role === "drap_admin") {
        navigate({ to: "/dashboard/admin" });
      } else if (role === "regulator") {
        navigate({ to: "/dashboard/regulator" });
      } else {
        navigate({ to: "/dashboard/patient" });
      }
    }
  }, [isAuthenticated, user, navigate]);

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      const res = await authService.login({
        email: data.email.trim(),
        password: data.password,
        rememberMe: data.rememberMe,
      });

      if ("pendingMfa" in res && res.pendingMfa) {
        toast.info("Verification required", {
          description:
            res.message ||
            "Enter the 6-digit code. If email is not set up, check the npm run dev terminal for the code.",
          duration: 8000,
        });
        navigate({
          to: "/auth/verify-mfa",
          search: { email: res.email, rememberMe: data.rememberMe } as any,
        });
        return;
      }

      if (!res.success || !res.data) {
        const message = res.error?.message ?? "Login failed. Please try again.";
        setServerError(message);
        toast.error(message);
        return;
      }

      signIn(res.data, data.rememberMe);
      toast.success("Welcome back!", {
        description: `Signed in as ${res.data.user.fullName}`,
        duration: 4000,
      });

      const role = res.data.user.role;
      if (role === "pharmacy") {
        navigate({ to: "/dashboard/pharmacy" });
      } else if (role === "manufacturer") {
        navigate({ to: "/dashboard/manufacturer" });
      } else if (role === "admin" || role === "super_admin" || role === "drap_admin") {
        navigate({ to: "/dashboard/admin" });
      } else if (role === "regulator") {
        navigate({ to: "/dashboard/regulator" });
      } else {
        navigate({ to: "/dashboard/patient" });
      }
    } catch {
      const message = "Something went wrong. Please try again.";
      setServerError(message);
      toast.error(message);
    }
  };

  const handleGoogleLogin = () => {
    if (!selectedRole) {
      toast.error("Please select a portal first", {
        description: "Choose if you are a Patient, Pharmacy, or Manufacturer to continue with Google.",
      });
      return;
    }

    if (!window.google) {
      toast.error("Google Sign-In is not available right now. Please refresh.");
      return;
    }

    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || "your-google-client-id.apps.googleusercontent.com",
      callback: async (response: any) => {
        const res = await authService.googleLogin(
          response.credential,
          selectedRole
        );

        // MFA required (manufacturer via Google)
        if ((res as any).pendingMfa) {
          toast.info("Verification required", {
            description:
              (res as any).message ||
              "Enter the 6-digit code sent to your email.",
            duration: 8000,
          });
          navigate({
            to: "/auth/verify-mfa",
            search: {
              email: (res as any).email,
              rememberMe: true,
            } as any,
          });
          return;
        }

        if (!res.success || !res.data) {
          toast.error(res.error?.message ?? "Google login failed.");
          return;
        }

        signIn(res.data, true);
        toast.success("Welcome back!", {
          description: `Signed in with Google as ${res.data.user.fullName}`,
        });

        const role = res.data.user.role;
        if (role === "pharmacy") {
          navigate({ to: "/dashboard/pharmacy" });
        } else if (role === "manufacturer") {
          navigate({ to: "/dashboard/manufacturer" });
        } else {
          navigate({ to: "/dashboard/patient" });
        }
      },
    });

    window.google.accounts.id.prompt(); // One Tap prompt

    // Also trigger the standard popup
    const googleButton = document.createElement("div");
    googleButton.id = "google-hidden-button";
    googleButton.style.display = "none";
    document.body.appendChild(googleButton);

    window.google.accounts.id.renderButton(
      googleButton,
      { theme: "outline", size: "large" }
    );

    const clickEvent = new MouseEvent("click", {
      view: window,
      bubbles: true,
      cancelable: true
    });

    const innerButton = googleButton.querySelector('div[role="button"]');
    if (innerButton) {
      innerButton.dispatchEvent(clickEvent);
    } else {
      // Fallback: prompt if button rendering is delayed
      window.google.accounts.id.prompt();
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your SafeDose account to continue protecting patients."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* Server error */}
        <AnimatePresence>
          {serverError && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.25, ease }}
              className="flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/6 px-4 py-3"
            >
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
              <p className="text-[13px] text-destructive">{serverError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="login-email" className="block text-[13px] font-medium">
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...register("email")}
            className={cn(
              "w-full rounded-xl border bg-secondary/50 px-4 py-2.5 text-[14px] transition-all duration-200",
              "placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring/60",
              errors.email ? "border-destructive/50 focus:ring-destructive/30" : "border-border/70"
            )}
          />
          <AnimatePresence>
            {errors.email && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-1 text-[12px] text-destructive"
              >
                <AlertCircle className="h-3 w-3" />
                {errors.email.message}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="block text-[13px] font-medium">
              Password
            </label>
            <Link
              to="/auth/forgot-password"
              className="text-[12px] text-primary hover:underline font-medium transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              {...register("password")}
              className={cn(
                "w-full rounded-xl border bg-secondary/50 px-4 py-2.5 pr-11 text-[14px] transition-all duration-200",
                "placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring/60",
                errors.password ? "border-destructive/50 focus:ring-destructive/30" : "border-border/70"
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <AnimatePresence>
            {errors.password && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-1 text-[12px] text-destructive"
              >
                <AlertCircle className="h-3 w-3" />
                {errors.password.message}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-2.5">
          <input
            id="login-remember"
            type="checkbox"
            {...register("rememberMe")}
            className="h-4 w-4 rounded border-border/70 accent-primary cursor-pointer"
          />
          <label htmlFor="login-remember" className="text-[13px] text-muted-foreground cursor-pointer select-none">
            Keep me signed in for 7 days
          </label>
        </div>

        {/* Submit */}
        <motion.button
          type="submit"
          disabled={isSubmitting}
          whileHover={{ scale: isSubmitting ? 1 : 1.015 }}
          whileTap={{ scale: isSubmitting ? 1 : 0.985 }}
          className={cn(
            "w-full rounded-full bg-gradient-primary py-2.5 text-[14px] font-medium text-primary-foreground shadow-elegant",
            "transition-all duration-300 hover:shadow-card-hover",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "flex items-center justify-center gap-2"
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </motion.button>

        {/* Divider */}
        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/40" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card px-3 text-[11px] text-muted-foreground">or continue with</span>
          </div>
        </div>

        {/* Role selector for Google Login */}
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((role) => {
            const Icon = role.icon;
            const selected = selectedRole === role.value;
            return (
              <button
                key={role.value}
                type="button"
                onClick={() => setValue("role" as any, role.value)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-2.5 transition-all duration-200",
                  selected
                    ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                    : "border-border/60 bg-secondary/30 hover:bg-secondary/50"
                )}
              >
                <div className={cn(
                  "grid h-8 w-8 place-items-center rounded-lg transition-colors",
                  selected ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground"
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className={cn("text-[11px] font-medium", selected ? "text-primary" : "text-muted-foreground")}>
                  {role.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Google login */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className={cn(
            "w-full flex items-center justify-center gap-3 rounded-xl border border-border/70 bg-secondary/40 px-4 py-2.5 text-[13px] font-medium transition-all duration-200",
            selectedRole ? "hover:bg-secondary hover:border-border opacity-100" : "opacity-50 grayscale-[0.5]"
          )}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>

        {/* Secure badge */}
        <div className="flex items-center justify-center gap-2 pt-1">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          <span className="text-[11px] text-muted-foreground">256-bit SSL encrypted · DRAP compliant</span>
        </div>

        {/* Footer link */}
        <p className="text-center text-[13px] text-muted-foreground pt-1">
          Don't have an account?{" "}
          <Link to="/auth/signup" className="font-medium text-primary hover:underline">
            Create one free
          </Link>
        </p>
      </form>


    </AuthLayout>
  );
}
