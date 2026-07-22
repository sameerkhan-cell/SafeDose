import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "mediverify_super_secret_key_12345";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "mediverify_refresh_secret_xyz";

export interface TokenPayload {
    userId: string;
    role: string;
    email: string;
    sid?: string;
}

export class JwtService {
    static signAccessToken(payload: TokenPayload): string {
        return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
    }

    static signRefreshToken(payload: TokenPayload): string {
        return jwt.sign(payload, REFRESH_SECRET, { expiresIn: "7d" });
    }

    static verifyAccessToken(token: string): TokenPayload {
        try {
            return jwt.verify(token, JWT_SECRET) as TokenPayload;
        } catch (error) {
            throw new Error("Invalid or expired access token.");
        }
    }

    static verifyRefreshToken(token: string): TokenPayload {
        try {
            return jwt.verify(token, REFRESH_SECRET) as TokenPayload;
        } catch (error) {
            throw new Error("Invalid or expired refresh token.");
        }
    }
}
