import { createAPIFileRoute } from "@/lib/api-route-helper";
import { AuthService } from "@/server/services/auth.service";
import { ApiResponse } from "@/server/utils/api-response";

export const Route = createAPIFileRoute("/api/auth/login")({
    POST: async ({ request }: { request: Request }) => {
        try {
            const { email, password } = await request.json();
            const userAgent = request.headers.get("user-agent") || undefined;
            const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined;

            const result = await AuthService.login(email, password, { userAgent, ipAddress });

            if (result && typeof result === "object" && "status" in result && result.status === "PENDING_MFA") {
                return Response.json(
                    ApiResponse.success(result, result.message || "Verification code sent to your email.")
                );
            }

            return Response.json(ApiResponse.success(result, "Login successful."));
        } catch (error: any) {
            const status = error.statusCode || 401;
            return Response.json(ApiResponse.error(error.message, status), { status });
        }
    },
});
