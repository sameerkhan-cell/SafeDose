import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@/lib/api-route-helper";

// Simulated reset token store (replace with real DB + email service)
const resetTokens = new Map<string, { email: string; expiresAt: number }>();

export const APIRoute = createAPIFileRoute("/api/auth/forgot-password")({
  POST: async ({ request }) => {
    try {
      const { email } = (await request.json()) as { email: string };

      if (!email) {
        return json({ error: "Email is required." }, { status: 400 });
      }

      // Generate a reset token
      const token = btoa(`${email}:${Date.now()}:${Math.random()}`).replace(/=/g, "");
      resetTokens.set(token, {
        email: email.toLowerCase(),
        expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
      });

      // In production: send email with reset link
      console.log(`[SafeDose] Password reset token for ${email}: ${token}`);

      // Always return success to prevent email enumeration
      return json({
        success: true,
        message: "If an account exists, a reset link has been sent to your email.",
        // Expose token only in dev for testing
        ...(process.env.NODE_ENV !== "production" && { devToken: token }),
      });
    } catch {
      return json({ error: "Internal server error." }, { status: 500 });
    }
  },
});
