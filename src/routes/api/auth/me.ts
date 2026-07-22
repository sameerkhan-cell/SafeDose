import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { prisma } from "@/server/db/client";
import { ApiResponse } from "@/server/utils/api-response";

export const Route = createAPIFileRoute("/api/auth/me")({
    GET: async ({ request }) => {
        try {
            const payload = await authorizeRequest(request);

            const user = await prisma.user.findUnique({
                where: { id: payload.userId },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    status: true,
                    twoFactorEnabled: true,
                    createdAt: true,
                    manufacturer: {
                        select: {
                            isVerified: true
                        }
                    },
                    pharmacy: {
                        select: {
                            isVerified: true
                        }
                    }
                }
            });

            if (!user) return Response.json(ApiResponse.error("User not found", 404), { status: 404 });

            return Response.json(ApiResponse.success({
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                status: user.status,
                twoFactorEnabled: user.twoFactorEnabled ?? false,
                createdAt: user.createdAt,
                isVerified: user.manufacturer?.isVerified ?? user.pharmacy?.isVerified ?? false,
            }));
        } catch (error: any) {
            return Response.json(ApiResponse.error(error.message, 401), { status: 401 });
        }
    },
});
