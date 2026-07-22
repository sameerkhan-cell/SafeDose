import { JwtService } from "../auth/jwt.service";
import { ApiError } from "../utils/api-response";
import { prisma } from "../db/client";

export async function authorizeRequest(request: Request, allowedRoles?: string[]) {
    const authHeader = request.headers.get("Authorization");
    console.log(`[AUTH_DEBUG] Received Header: "${authHeader}"`);

    if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader === "Bearer ") {
        throw new ApiError(401, "Authentication required.");
    }

    const token = authHeader.split(" ")[1];

    try {
        const payload = JwtService.verifyAccessToken(token);

        if (payload.sid) {
            const session = await prisma.session.findUnique({ where: { id: payload.sid } });
            if (!session || session.expiresAt < new Date()) {
                throw new ApiError(401, "Session has been revoked or expired.");
            }
        }

        if (allowedRoles && !allowedRoles.includes(payload.role)) {
            throw new ApiError(403, "Insufficient permissions for this action.");
        }

        return payload;
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(401, "Invalid or expired session.");
    }
}
