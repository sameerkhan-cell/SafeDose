import { createAPIFileRoute } from "@/lib/api-route-helper";
import { VerificationEngine } from "@/server/services/verification.service";
import { VerificationSchemas } from "@/server/validation/schemas";
import { ApiResponse } from "@/server/utils/api-response";
import { JwtService } from "@/server/auth/jwt.service";
import { GeoIPService } from "@/server/services/geoip.service";

export const Route = createAPIFileRoute("/api/verify")({
    POST: async ({ request }) => {
        try {
            const body = await request.json();
            const validatedData = VerificationSchemas.verify.parse(body);

            // Optional Auth (for history tracking)
            let userId: string | undefined;
            const authHeader = request.headers.get("Authorization");
            if (authHeader?.startsWith("Bearer ")) {
                try {
                    const payload = JwtService.verifyAccessToken(authHeader.split(" ")[1]);
                    userId = payload.userId;
                    
                    if (payload.role === "PHARMACY") {
                        const { prisma } = await import("@/server/db/client");
                        const { ApiError } = await import("@/server/utils/api-response");
                        const pharmacy = await prisma.pharmacy.findUnique({ where: { userId } });
                        if (!pharmacy || !pharmacy.isVerified) {
                            throw new ApiError(
                                403,
                                "Your pharmacy profile and DRAP Pharmacy License must be completed and approved by DRAP Admin before you can verify stock. Please complete your profile details and ensure your DRAP License is approved."
                            );
                        }
                    }
                } catch (e: any) {
                    if (e.statusCode === 403) throw e;
                    // Public verify, don't throw for invalid tokens
                }
            }

            // Extract client IP and resolve real geographical location (city, country)
            const xForwardedFor = request.headers.get("x-forwarded-for");
            const xRealIp = request.headers.get("x-real-ip");
            const clientIp = xForwardedFor?.split(",")[0]?.trim() || xRealIp || undefined;
            const resolvedLocation = await GeoIPService.resolveLocation(clientIp);

            const result = await VerificationEngine.verify({
                ...validatedData,
                userId,
                resolvedLocation,
                deviceInfo: request.headers.get("user-agent") || "Web"
            });

            return Response.json(ApiResponse.success(result, "Verification complete."));
        } catch (error: any) {
            const status = error.statusCode || 400;
            return Response.json(ApiResponse.error(error.message || "Verification service error", status), { status });
        }
    },
});

