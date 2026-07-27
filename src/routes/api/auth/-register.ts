import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@/lib/api-route-helper";
import type { SignUpCredentials } from "@/types/auth";

// Simulated in-memory user store (replace with real DB)
const registeredUsers: Array<{
  id: string;
  email: string;
  password: string;
  fullName: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
}> = [];

function signJWT(payload: object): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const sig = btoa("mediverify-secret-signature");
  return `${header}.${body}.${sig}`;
}

export const APIRoute = createAPIFileRoute("/api/auth/register")({
  POST: async ({ request }) => {
    try {
      const body = (await request.json()) as SignUpCredentials;
      const { fullName, email, password, confirmPassword, role, acceptTerms } = body;

      if (!fullName || !email || !password || !confirmPassword || !role) {
        return json({ error: "All fields are required." }, { status: 400 });
      }
      if (password !== confirmPassword) {
        return json({ error: "Passwords do not match." }, { status: 400 });
      }
      if (!acceptTerms) {
        return json({ error: "You must accept the terms and conditions." }, { status: 400 });
      }
      if (password.length < 8) {
        return json({ error: "Password must be at least 8 characters." }, { status: 400 });
      }

      const existing = registeredUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        return json({ error: "An account with this email already exists." }, { status: 409 });
      }

      const newUser = {
        id: `usr_${Date.now()}`,
        email: email.toLowerCase(),
        password,
        fullName,
        role,
        emailVerified: false,
        createdAt: new Date().toISOString(),
      };

      registeredUsers.push(newUser);
      const { password: _pwd, ...user } = newUser;
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
      const token = signJWT({ sub: user.id, role: user.role, exp: Math.floor(expiresAt / 1000) });

      return json({
        success: true,
        data: { user, token, expiresAt },
        message: `Welcome to SafeDose, ${user.fullName}!`,
      });
    } catch {
      return json({ error: "Internal server error." }, { status: 500 });
    }
  },
});
