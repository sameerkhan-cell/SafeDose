import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle, Mail, CheckCircle2, ArrowLeft, Inbox } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { authService } from "@/services/auth";
import { cn } from "@/lib/utils";
import { ease } from "@/lib/motion";

export const Route = createFileRoute("/auth/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot Password — SafeDose" },
      { name: "description", content: "Reset your SafeDose password securely." },
    ],
  }),
  component: ForgotPasswordPage,
});

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
});

type FormData = z.infer<typeof schema>;


function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const res = await authService.forgotPassword({ email: data.email });

    if (!res.success) {
      setServerError(res.error?.message ?? "Something went wrong. Please try again.");
      return;
    }

    setSentEmail(data.email);
    setSent(true);
    toast.success("Reset link sent!", { description: "Check your email inbox." });
  };

  return (
    <AuthLayout
      title={sent ? "Check your inbox" : "Reset your password"}
      subtitle={
        sent
          ? `We've sent a reset link to ${sentEmail}`
          : "Enter your email and we'll send you a secure reset link."
      }
      panelHeading="Secure Account Recovery"
      panelTagline="Your account security is our top priority. Reset links expire in 1 hour."
    >
      <AnimatePresence mode="wait">
        {sent ? (
          /* ─── Success state ─── */
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -16 }}
            transition={{ duration: 0.4, ease }}
            className="space-y-6"
          >
            {/* Icon */}
            <div className="flex justify-center">
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, duration: 0.5, type: "spring", stiffness: 200 }}
                className="relative grid h-20 w-20 place-items-center rounded-2xl bg-success/10 text-success"
              >
                <Inbox className="h-9 w-9" />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.3, type: "spring" }}
                  className="absolute -top-2 -right-2 grid h-7 w-7 place-items-center rounded-full bg-success text-white shadow-md"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </motion.div>
              </motion.div>
            </div>

            <div className="rounded-xl border border-border/50 bg-secondary/30 px-4 py-3 space-y-2">
              <p className="text-[12px] text-muted-foreground">
                Sent to: <span className="font-medium text-foreground">{sentEmail}</span>
              </p>
              <p className="text-[12px] text-muted-foreground">
                The link will expire in <span className="font-medium text-foreground">1 hour</span>.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-[13px] text-muted-foreground text-center">Didn't receive an email?</p>
              <motion.button
                type="button"
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => {
                  const email = getValues("email");
                  authService.forgotPassword({ email });
                  toast.info("Reset link resent!", { description: "Check your spam folder too." });
                }}
                className="w-full rounded-full border border-border/70 bg-secondary/40 py-2.5 text-[14px] font-medium transition-all duration-200 hover:bg-secondary hover:border-border flex items-center justify-center gap-2"
              >
                <Mail className="h-4 w-4" />
                Resend reset link
              </motion.button>

              <Link
                to="/auth/login"
                className="flex items-center justify-center gap-2 rounded-full bg-gradient-primary py-2.5 text-[14px] font-medium text-primary-foreground shadow-elegant transition-all duration-300 hover:shadow-card-hover"
              >
                Back to sign in
              </Link>
            </div>
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

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="forgot-email" className="block text-[13px] font-medium">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...register("email")}
                  className={cn(
                    "w-full rounded-xl border bg-secondary/50 pl-10 pr-4 py-2.5 text-[14px] transition-all duration-200",
                    "placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring/60",
                    errors.email ? "border-destructive/50 focus:ring-destructive/30" : "border-border/70"
                  )}
                />
              </div>
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
                  Sending reset link…
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Send reset link
                </>
              )}
            </motion.button>

            {/* Back link */}
            <Link
              to="/auth/login"
              className="flex items-center justify-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to sign in
            </Link>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
