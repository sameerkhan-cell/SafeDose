import { prisma } from "../db/client";
import { ApiError } from "../utils/api-response";
import { PasswordService } from "../auth/password.service";
import { JwtService } from "../auth/jwt.service";
import { Role } from "@prisma/client";
import { GeoIPService } from "./geoip.service";

export class AuthService {
    static async register(data: any) {
        const restrictedRoles = ["MANUFACTURER", "manufacturer", "ADMIN", "SUPER_ADMIN", "DRAP_ADMIN", "REGULATOR"];
        if (data.role && restrictedRoles.includes(String(data.role).toUpperCase()) || restrictedRoles.includes(String(data.role))) {
          throw new ApiError(403, "This account type can only be created by administrators. Please contact SafeDose support.");
        }

        const { email, password, name, role } = data;

        // 1. Check if user exists
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) throw new ApiError(400, "User already exists with this email.");

        // 2. Validate password
        if (!PasswordService.validate(password)) {
            throw new ApiError(400, "Password must be 8+ chars and include upper, lower, and numbers.");
        }

        // 3. Hash password
        const passwordHash = await PasswordService.hash(password);

        try {
            return await prisma.$transaction(async (tx) => {
                // 4. Create User (IDs handled by default cuid() in schema)
                // Normalize role (Map CUSTOMER -> PATIENT if needed)
                let targetRole = Role.PATIENT;
                if (role) {
                    const normalized = String(role).toUpperCase();
                    if (normalized === "CUSTOMER" || normalized === "PATIENT") {
                        targetRole = Role.PATIENT;
                    } else if (normalized === "PHARMACY") {
                        targetRole = Role.PHARMACY;
                    } else if (normalized === "MANUFACTURER") {
                        targetRole = Role.MANUFACTURER;
                    } else {
                        // Allow other valid roles if necessary, though public signup should be restricted
                        try {
                            targetRole = normalized as Role;
                        } catch (e) {
                            targetRole = Role.PATIENT;
                        }
                    }
                }

                const user = await tx.user.create({
                    data: {
                        email,
                        passwordHash,
                        name,
                        role: targetRole,
                        status: "ACTIVE",
                    } as any
                });

                // 5. Initialize Profile based on role (Atomic)
                if (targetRole === Role.MANUFACTURER) {
                    const companyCode = await this.generateCompanyCode(name);
                    await tx.manufacturer.create({
                        data: {
                            userId: user.id,
                            companyName: name,
                            companyCode,
                            licenseNumber: `LIC-MFG-${user.id.slice(-6).toUpperCase()}`
                        } as any
                    });
                } else if (targetRole === Role.PHARMACY) {
                    await tx.pharmacy.create({
                        data: {
                            userId: user.id,
                            name: name,
                            licenseNumber: `LIC-PHR-${user.id.slice(-6).toUpperCase()}`
                        }
                    });
                }

                // Log outcome
                console.log(`[AUTH] User registered successfully: ${email} (${role})`);
                return await this.generateAuthResponse(user, {}, tx);
            });
        } catch (error: any) {
            console.error(`[AUTH_ERROR] Transaction failed for ${email}:`, error);
            throw new ApiError(500, "Account creation failed during profile initialization. Please try again.");
        }
    }

    static async login(email: string, password: string, metadata: { userAgent?: string, ipAddress?: string } = {}) {
        const normalizedEmail = email.trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (!user) throw new ApiError(401, "Invalid email or password.");

        if (user.googleId && !user.passwordHash) {
            throw new ApiError(
                400,
                "This email is linked to a Google account. Please use \"Continue with Google\" to sign in."
            );
        }

        if (!user.passwordHash) {
            throw new ApiError(
                400,
                "No password is set for this account. Sign in with Google or use Forgot password to create one."
            );
        }

        const isValid = await PasswordService.compare(password, user.passwordHash);
        if (!isValid) {
            throw new ApiError(401, "Invalid email or password.");
        }

        // If user is a Manufacturer or has 2FA enabled, enforce MFA
        if (user.role === "MANUFACTURER" || user.twoFactorEnabled) {
            const { MfaService } = await import("./mfa.service");
            const delivery = await MfaService.generateAndSendOtp(user.id, user.email);

            return {
                status: "PENDING_MFA",
                message: delivery.message,
                email: user.email,
                emailed: delivery.emailed,
            };
        }

        return this.generateAuthResponse(user, metadata);
    }

    public static async generateAuthResponse(user: any, metadata: { userAgent?: string, ipAddress?: string } = {}, db: any = prisma) {
        // If manufacturer, check if we need to return PENDING_MFA
        // (This is only called directly from verifyMfa or social logins for now)
        const refreshTokenPayload = { userId: user.id, role: user.role, email: user.email };
        const refreshToken = JwtService.signRefreshToken(refreshTokenPayload);

        const resolvedLocation = await GeoIPService.resolveLocation(metadata.ipAddress);

        // Store session in DB using passed client
        const newSession = await db.session.create({
            data: {
                userId: user.id,
                refreshToken,
                userAgent: metadata.userAgent,
                ipAddress: metadata.ipAddress,
                location: resolvedLocation,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            }
        });

        const accessToken = JwtService.signAccessToken({ userId: user.id, role: user.role, email: user.email, sid: newSession.id });

        // Fetch profile info to see if verified
        let isVerified = true;
        let companyLogo: string | null = null;
        if (user.role === "MANUFACTURER") {
            const mfg = await db.manufacturer.findUnique({ where: { userId: user.id } });
            isVerified = mfg?.isVerified ?? false;
            companyLogo = mfg?.companyLogo ?? null;

            // Backfill companyCode if missing (backward compatibility)
            if (mfg && !mfg.companyCode) {
                const newCode = await this.generateCompanyCode(mfg.companyName);
                await db.manufacturer.update({
                    where: { id: mfg.id },
                    data: { companyCode: newCode }
                });
            }
        } else if (user.role === "PHARMACY") {
            const pharmacy = await db.pharmacy.findUnique({ where: { userId: user.id } });
            isVerified = pharmacy?.isVerified ?? false;
        }

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                isVerified,
                companyLogo,
                logoUrl: companyLogo,
                avatar: companyLogo ?? undefined,
            },
            tokens: {
                accessToken,
                refreshToken,
            },
        };
    }

    static async verifyMfa(email: string, code: string, metadata: { userAgent?: string, ipAddress?: string } = {}) {
        const normalizedEmail = email.trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (!user) throw new ApiError(404, "User not found.");

        const { MfaService } = await import("./mfa.service");
        await MfaService.verifyOtp(user.id, code);

        return this.generateAuthResponse(user, metadata);
    }

    static async refresh(token: string) {
        // 1. Verify token signature and expiry
        const payload = JwtService.verifyRefreshToken(token);

        // 2. Check if session exists in DB (revocation check)
        const session = await prisma.session.findUnique({
            where: { refreshToken: token },
            include: { user: true }
        });

        if (!session || !session.user) {
            throw new ApiError(401, "Session expired or revoked.");
        }

        // 3. Remove old session
        try {
            await prisma.session.delete({ where: { id: session.id } });
        } catch (err: any) {
            // P2025 = "Record to delete does not exist" - happens if concurrent request already removed it.
            if (err.code !== "P2025") throw err;
        }

        // 4. Generate new pair
        return this.generateAuthResponse(session.user);
    }

    static async logout(token: string) {
        try {
            await prisma.session.delete({ where: { refreshToken: token } });
            return { success: true };
        } catch {
            return { success: true }; // Silent fail if session already gone
        }
    }

    static async updateProfile(userId: string, data: { name?: string, email?: string }) {
        return await prisma.user.update({
            where: { id: userId },
            data: {
                name: data.name,
                email: data.email,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
            }
        });
    }

    static async changePassword(userId: string, data: { currentPassword: string, newPassword: string }) {
        const { currentPassword, newPassword } = data;

        // 1. Get user
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new ApiError(404, "User not found.");

        // 2. Verify current password
        const isMatch = await PasswordService.compare(currentPassword, user.passwordHash || "");
        if (!isMatch) throw new ApiError(400, "Incorrect current password.");

        // 3. Validate new password strength
        if (!PasswordService.validate(newPassword)) {
            throw new ApiError(400, "New password must be 8+ chars and include upper, lower, and numbers.");
        }

        // 4. Hash new password
        const newPasswordHash = await PasswordService.hash(newPassword);

        // 5. Update password
        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash: newPasswordHash }
        });

        return { success: true };
    }

    static async googleLogin(idToken: string, options: { role?: Role, userAgent?: string, ipAddress?: string } = {}) {
        const { OAuth2Client } = await import("google-auth-library");
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        const { role, userAgent, ipAddress } = options;

        try {
            const ticket = await client.verifyIdToken({
                idToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();
            if (!payload || !payload.email) {
                throw new ApiError(400, "Invalid Google token payload.");
            }

            const { email, sub: googleId, name, picture } = payload;

            // 1. Check if user exists by googleId
            let user = await prisma.user.findUnique({ where: { googleId } });

            if (!user) {
                // 2. Check if user exists by email
                user = await prisma.user.findUnique({ where: { email } });

                if (user) {
                    // Link existing user with googleId
                    user = await prisma.user.update({
                        where: { id: user.id },
                        data: { googleId }
                    });
                } else {
                    // 3. Create new user with selected role (default to PATIENT if not provided)
                    let targetRole: Role = Role.PATIENT;
                    if ((role as any) === "MANUFACTURER") targetRole = Role.MANUFACTURER;
                    else if ((role as any) === "PHARMACY") targetRole = Role.PHARMACY;
                    else if ((role as any) === "CUSTOMER" || (role as any) === "PATIENT") targetRole = Role.PATIENT;

                    user = await prisma.$transaction(async (tx) => {
                        const newUser = await tx.user.create({
                            data: {
                                email,
                                googleId,
                                name: name || email.split("@")[0],
                                role: targetRole,
                                status: "ACTIVE",
                            } as any
                        });

                        // 4. Initialize Profile based on role
                        if (targetRole === "MANUFACTURER") {
                            const companyCode = await this.generateCompanyCode(name || email.split("@")[0]);
                            await tx.manufacturer.create({
                                data: {
                                    userId: newUser.id,
                                    companyName: name || email.split("@")[0],
                                    companyCode,
                                    licenseNumber: `LIC-MFG-G-${newUser.id.slice(-6).toUpperCase()}`
                                } as any
                            });
                        } else if (targetRole === "PHARMACY") {
                            await tx.pharmacy.create({
                                data: {
                                    userId: newUser.id,
                                    name: name || email.split("@")[0],
                                    licenseNumber: `LIC-PHR-G-${newUser.id.slice(-6).toUpperCase()}`
                                }
                            });
                        }

                        return newUser;
                    });
                }
            }

            console.log(`[AUTH] Google login successful: ${email}`);

            // Enforce MFA for MANUFACTURER role or 2FA enabled users
            if (user.role === "MANUFACTURER" || user.twoFactorEnabled) {
                const { MfaService } = await import("./mfa.service");
                await MfaService.generateAndSendOtp(user.id, user.email);
                return {
                    status: "PENDING_MFA",
                    message: "A verification code has been sent to your email.",
                    email: user.email,
                } as any;
            }

            return this.generateAuthResponse(user, { userAgent, ipAddress });
        } catch (error: any) {
            console.error("[AUTH_ERROR] Google token verification failed:", error);
            throw new ApiError(error.statusCode || 401, error.message || "Google authentication failed. Please try again.");
        }
    }

    private static async generateCompanyCode(companyName: string): Promise<string> {
        const prefix = "MFG";
        const shortName = companyName
            .replace(/[^a-zA-Z]/g, "")
            .substring(0, 3)
            .toUpperCase() || "GEN";

        // Find how many manufacturers share this prefix to increment counter
        const count = await prisma.manufacturer.count({
            where: {
                companyCode: {
                    startsWith: `${prefix}-${shortName}`,
                },
            },
        });

        const counter = (count + 1).toString().padStart(3, "0");
        return `${prefix}-${shortName}${counter}`;
    }
}
