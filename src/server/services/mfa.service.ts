import { prisma } from "../db/client";
import { ApiError } from "../utils/api-response";
import nodemailer from "nodemailer";

const PLACEHOLDER_PATTERNS = [
    /^your-email@/i,
    /^your-app-password$/i,
    /example\.com$/i,
    /^changeme$/i,
];

export type OtpDeliveryResult = {
    emailed: boolean;
    message: string;
};

function isPlaceholderCredential(value: string): boolean {
    return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

export function isSmtpConfigured(): boolean {
    const host = process.env.SMTP_HOST;
    const portRaw = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !portRaw || !user || !pass) return false;
    if (isPlaceholderCredential(user) || isPlaceholderCredential(pass)) return false;
    return true;
}

function getMailerTransporter(): nodemailer.Transporter | null {
    if (!isSmtpConfigured()) return null;

    const host = process.env.SMTP_HOST!;
    const port = Number(process.env.SMTP_PORT);
    const secure = process.env.SMTP_SECURE === "true" || port === 465;

    return nodemailer.createTransport({
        host,
        port,
        secure,
        // Force IPv4 — avoids ECONNREFUSED when the OS prefers IPv6
        // but the network blocks it on the SMTP port
        family: 4,
        auth: {
            user: process.env.SMTP_USER!,
            pass: process.env.SMTP_PASS!,
        },
        // STARTTLS upgrade required on port 587
        ...(port === 587 ? { requireTLS: true } : {}),
        tls: {
            // Prevents "self-signed certificate in chain" errors
            // that occur with Gmail in some Node.js environments
            rejectUnauthorized: false,
        },
        connectionTimeout: 10000, // 10 s — safe for serverless
    });
}

export class MfaService {
    /**
     * Generates a 6-digit OTP and saves it to the user record
     */
    static async generateAndSendOtp(userId: string, deliveryEmail?: string): Promise<OtpDeliveryResult> {
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await prisma.user.update({
            where: { id: userId },
            data: {
                otpCode,
                otpExpiresAt: expiresAt
            }
        });

        console.log(`\n---------------------------------`);
        console.log(`[MFA] OTP for user ${userId}: ${otpCode}`);
        if (deliveryEmail) {
            console.log(`[MFA] Delivery email: ${deliveryEmail}`);
        }
        console.log(`[MFA] Expires at: ${expiresAt.toLocaleTimeString()}`);
        console.log(`---------------------------------\n`);

        if (!deliveryEmail) {
            return {
                emailed: false,
                message: "Verification code generated. Check the server console for the code (development).",
            };
        }

        const mailer = getMailerTransporter();
        if (!mailer) {
            const missing = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"].filter(
                (key) => !process.env[key]
            );
            console.warn(
                "[MFA] SMTP not configured. OTP email not sent.",
                missing.length ? `Missing: ${missing.join(", ")}` : "Check .env values and restart npm run dev."
            );
            return {
                emailed: false,
                message:
                    "A new code was generated. Email is not configured yet — check the terminal where npm run dev is running, or use the development bypass code '000000'.",
            };
        }

        const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@safedose.local";
        const expiryMinutes = 10;

        try {
            await mailer.sendMail({
                from,
                to: deliveryEmail,
                subject: "SafeDose - Your verification code",
                text: `Your SafeDose verification code is ${otpCode}. This code expires in ${expiryMinutes} minutes.`,
                html: `
                <div style="font-family: Arial, sans-serif; line-height:1.5; color:#111827;">
                    <h2 style="margin:0 0 12px;">SafeDose Verification Code</h2>
                    <p style="margin:0 0 8px;">Use the code below to complete sign-in:</p>
                    <p style="font-size:28px; letter-spacing:4px; font-weight:700; margin:8px 0 14px;">${otpCode}</p>
                    <p style="margin:0;">This code expires in ${expiryMinutes} minutes.</p>
                </div>
            `,
            });
            return {
                emailed: true,
                message: `A new verification code was sent to ${deliveryEmail}.`,
            };
        } catch (err: any) {
            console.error("[MFA] Failed to send OTP email:", err?.message || err);
            return {
                emailed: false,
                message:
                    "Could not send email (SMTP error). A new code was generated — check the terminal where npm run dev is running, or use '000000' as a bypass in development.",
            };
        }
    }

    /**
     * Verifies the provided OTP code
     */
    static async verifyOtp(userId: string, code: string): Promise<boolean> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { otpCode: true, otpExpiresAt: true }
        }) as any;

        if (!user || !user.otpCode || !user.otpExpiresAt) {
            throw new ApiError(400, "MFA request not found or expired.");
        }

        if (user.otpExpiresAt < new Date()) {
            throw new ApiError(400, "MFA code has expired.");
        }

        const isDevBypass = process.env.NODE_ENV !== "production" && code === "000000";
        if (user.otpCode !== code && !isDevBypass) {
            throw new ApiError(401, "Invalid verification code.");
        }

        // Clear OTP after successful verification
        await prisma.user.update({
            where: { id: userId },
            data: {
                otpCode: null,
                otpExpiresAt: null
            } as any
        });

        return true;
    }

    static async sendPasswordResetEmail(
        toEmail: string,
        resetUrl: string
    ): Promise<void> {
        const mailer = getMailerTransporter();
        if (!mailer) {
            console.log(`[PASSWORD_RESET] No mailer configured.`);
            console.log(`[PASSWORD_RESET] Reset URL for ${toEmail}: ${resetUrl}`);
            return;
        }

        const from =
            process.env.SMTP_FROM ||
            process.env.SMTP_USER ||
            "no-reply@safedose.local";

        await mailer.sendMail({
            from,
            to: toEmail,
            subject: "SafeDose — Reset your password",
            text: `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour.\nIf you did not request this, ignore this email.`,
            html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#111827;">
          <h2 style="margin:0 0 12px;color:#4F46E5;">Reset your SafeDose password</h2>
          <p style="margin:0 0 20px;color:#6B7280;">
            Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
          </p>
          <a href="${resetUrl}"
             style="display:inline-block;background:#4F46E5;color:#fff;padding:11px 28px;
                    border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            Reset Password
          </a>
          <p style="margin:20px 0 0;font-size:12px;color:#9CA3AF;">
            If you did not request a password reset, you can safely ignore this email.
          </p>
        </div>
      `,
        });
    }
}
