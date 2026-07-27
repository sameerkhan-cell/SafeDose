import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { authService } from "@/services/auth";
import { cn } from "@/lib/utils";
import { ease } from "@/lib/motion";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — SafeDose" },
      { name: "description", content: "Set a new secure password for your SafeDose account." },
    ],
  }),
  validateSearch: z.object({ token: z.string().optional() }),
  component: ResetPasswordPage,
});

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[0-9]/, "Must contain a number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;


function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token } = useSearch({ from: "/auth/reset-password" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const password = watch("password") ?? "";

  const onSubmit = async (data: FormData) => {
    setServerError(null);

    if (!token) {
      setServerError("Invalid reset link. Please request a new password reset.");
      return;
    }
    const resetToken = token;
    const res = await authService.resetPassword({
      token: resetToken,
      password: data.password,
      confirmPassword: data.confirmPassword,
    });

    if (!res.success) {
      setServerError(res.error?.message ?? "Failed to reset password. Please try again.");
      return;
    }

    setDone(true);
    toast.success("Password reset!", { description: "You can now sign in with your new password." });
  };

  return (
    <AuthLayout
      title={done ? "Password updated!" : "Set new password"}
      subtitle={
        done
          ? "Your password has been reset successfully."
          : "Choose a strong password to protect your account."
      }
      panelHeading="Secure Your Account"
      panelTagline="A strong password keeps your healthcare data and patient records safe."
    >
      <AnimatePresence mode="wait">
        {done ? (
          /* ─── Success state ─── */
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -16 }}
            transition={{ duration: 0.4, ease }}
            className="space-y-6"
          >
            <div className="flex justify-center">
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, duration: 0.5, type: "spring", stiffness: 200 }}
                className="grid h-20 w-20 place-items-center rounded-2xl bg-success/10 text-success"
              >
                <CheckCircle2 className="h-9 w-9" />
              </motion.div>
            </div>

            <div className="rounded-xl border border-success/20 bg-success/6 px-4 py-3">
              <p className="text-[13px] text-success font-medium">
                ✓ Your password has been changed successfully.
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                You can now log in with your new password.
              </p>
            </div>

            <Link
              to="/auth/login"
              className="flex items-center justify-center gap-2 rounded-full bg-gradient-primary py-2.5 text-[14px] font-medium text-primary-foreground shadow-elegant transition-all duration-300 hover:shadow-card-hover"
            >
              Sign in to your account
            </Link>
          </motion.div>
        ) : (
          /* ─── Form state ─── */
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease }}
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
          >
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

            {/* New password */}
            <div className="space-y-1.5">
              <label htmlFor="reset-password" className="block text-[13px] font-medium">
                New password
              </label>
              <div className="relative">
                <input
                  id="reset-password"
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
                  aria-label={showPassword ? "Hide" : "Show"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrength password={password} />
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

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label htmlFor="reset-confirm" className="block text-[13px] font-medium">
                Confirm new password
              </label>
              <div className="relative">
                <input
                  id="reset-confirm"
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
                  aria-label={showConfirm ? "Hide" : "Show"}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <AnimatePresence>
                {errors.confirmPassword && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center gap-1 text-[12px] text-destructive"
                  >
                    <AlertCircle className="h-3 w-3" />
                    {errors.confirmPassword.message}
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
                  Updating password…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Reset password
                </>
              )}
            </motion.button>

            <p className="text-center text-[13px] text-muted-foreground">
              Remember your password?{" "}
              <Link to="/auth/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
