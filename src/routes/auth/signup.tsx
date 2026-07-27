import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, AlertCircle, User, Stethoscope, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { authService } from "@/services/auth";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/auth";
import { ease } from "@/lib/motion";
import { useEffect } from "react";

declare global {
  interface Window {
    google: any;
  }
}

export const Route = createFileRoute("/auth/signup")({
  head: () => ({
    meta: [
      { title: "Create Account — SafeDose" },
      { name: "description", content: "Join SafeDose — the trusted AI + blockchain medicine verification platform." },
    ],
  }),
  component: SignUpPage,
});

const schema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  role: z.enum(["customer", "pharmacy", "manufacturer"], {
    required_error: "Please select your role",
  }),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[0-9]/, "Must contain a number"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms and conditions" }),
  }),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof schema>;


const ROLES: { value: UserRole; label: string; description: string; icon: React.ElementType }[] = [
  { value: "customer", label: "Patient / Customer", description: "Verify medicines you purchase", icon: User },
  { value: "pharmacy", label: "Pharmacy", description: "Bulk verify incoming stock", icon: Stethoscope },
];

function SignUpPage() {
  const navigate = useNavigate();
  const { signIn, user, isAuthenticated } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      const role = user.role;
      if (role === "pharmacy") {
        navigate({ to: "/dashboard/pharmacy" });
      } else if (role === "manufacturer") {
        navigate({ to: "/dashboard/manufacturer" });
      } else {
        navigate({ to: "/dashboard/patient" });
      }
    }
  }, [isAuthenticated, user, navigate]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const selectedRole = watch("role");
  const password = watch("password") ?? "";

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const res = await authService.register({
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      confirmPassword: data.confirmPassword,
      role: data.role,
      acceptTerms: data.acceptTerms,
    });

    if (!res.success || !res.data) {
      setServerError(res.error?.message ?? "Registration failed. Please try again.");
      return;
    }

    signIn(res.data, false);
    toast.success("Account created!", {
      description: res.message ?? `Welcome to SafeDose, ${data.fullName}!`,
      duration: 5000,
    });

    const role = res.data.user.role;
    if (role === "pharmacy") {
      navigate({ to: "/dashboard/pharmacy" });
    } else if (role === "manufacturer") {
      navigate({ to: "/dashboard/manufacturer" });
    } else {
      navigate({ to: "/dashboard/patient" });
    }
  };

  const handleGoogleLogin = () => {
    if (!selectedRole) {
      toast.error("Please select a role first", {
        description: "Choose your role to continue with Google registration.",
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

    window.google.accounts.id.prompt();

    const googleButton = document.createElement("div");
    googleButton.id = "google-hidden-button-signup";
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
      window.google.accounts.id.prompt();
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join thousands of healthcare professionals on SafeDose."
      panelHeading="Start Protecting Lives Today"
      panelTagline="Set up your account in under 2 minutes. No credit card required."
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

        {/* Full Name */}
        <div className="space-y-1.5">
          <label htmlFor="signup-name" className="block text-[13px] font-medium">Full name</label>
          <input
            id="signup-name"
            type="text"
            autoComplete="name"
            placeholder="Dr. Ayesha Khan"
            {...register("fullName")}
            className={cn(
              "w-full rounded-xl border bg-secondary/50 px-4 py-2.5 text-[14px] transition-all duration-200",
              "placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring/60",
              errors.fullName ? "border-destructive/50 focus:ring-destructive/30" : "border-border/70"
            )}
          />
          <AnimatePresence>
            {errors.fullName && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-1 text-[12px] text-destructive">
                <AlertCircle className="h-3 w-3" />{errors.fullName.message}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="signup-email" className="block text-[13px] font-medium">Email address</label>
          <input
            id="signup-email"
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
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-1 text-[12px] text-destructive">
                <AlertCircle className="h-3 w-3" />{errors.email.message}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Role selector */}
        <div className="space-y-2">
          <p className="text-[13px] font-medium">I am a…</p>
          <div className="grid grid-cols-1 gap-2">
            {ROLES.map((role) => {
              const Icon = role.icon;
              const selected = selectedRole === role.value;
              return (
                <motion.button
                  key={role.value}
                  type="button"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setValue("role", role.value, { shouldValidate: true })}
                  className={cn(
                    "flex items-center gap-3.5 rounded-xl border px-4 py-3 text-left transition-all duration-200",
                    selected
                      ? "border-primary/50 bg-primary/6 ring-1 ring-primary/30"
                      : "border-border/70 bg-secondary/40 hover:bg-secondary hover:border-border"
                  )}
                >
                  <span className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors duration-200",
                    selected ? "bg-primary/12 text-primary" : "bg-border/40 text-muted-foreground"
                  )}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-[13px] font-medium", selected ? "text-primary" : "text-foreground")}>
                      {role.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{role.description}</p>
                  </div>
                  {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                </motion.button>
              );
            })}
          </div>
          <AnimatePresence>
            {errors.role && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-1 text-[12px] text-destructive">
                <AlertCircle className="h-3 w-3" />{errors.role.message}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="signup-password" className="block text-[13px] font-medium">Password</label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
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
          <PasswordStrength password={password} />
          <AnimatePresence>
            {errors.password && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-1 text-[12px] text-destructive">
                <AlertCircle className="h-3 w-3" />{errors.password.message}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Confirm password */}
        <div className="space-y-1.5">
          <label htmlFor="signup-confirm" className="block text-[13px] font-medium">Confirm password</label>
          <div className="relative">
            <input
              id="signup-confirm"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              {...register("confirmPassword")}
              className={cn(
                "w-full rounded-xl border bg-secondary/50 px-4 py-2.5 pr-11 text-[14px] transition-all duration-200",
                "placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring/60",
                errors.confirmPassword ? "border-destructive/50 focus:ring-destructive/30" : "border-border/70"
              )}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <AnimatePresence>
            {errors.confirmPassword && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-1 text-[12px] text-destructive">
                <AlertCircle className="h-3 w-3" />{errors.confirmPassword.message}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Terms */}
        <div className="space-y-1.5">
          <div className="flex items-start gap-2.5">
            <input
              id="signup-terms"
              type="checkbox"
              {...register("acceptTerms")}
              className="mt-0.5 h-4 w-4 rounded border-border/70 accent-primary cursor-pointer"
            />
            <label htmlFor="signup-terms" className="text-[12px] text-muted-foreground cursor-pointer leading-relaxed">
              I agree to SafeDose's{" "}
              <span className="text-primary hover:underline cursor-pointer">Terms of Service</span>{" "}
              and{" "}
              <span className="text-primary hover:underline cursor-pointer">Privacy Policy</span>
            </label>
          </div>
          <AnimatePresence>
            {errors.acceptTerms && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-1 text-[12px] text-destructive">
                <AlertCircle className="h-3 w-3" />{errors.acceptTerms.message}
              </motion.p>
            )}
          </AnimatePresence>
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
              Creating account…
            </>
          ) : (
            "Create free account"
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

        {/* Sign in link */}
        <p className="text-center text-[13px] text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
