import { createAPIFileRoute } from "@/lib/api-route-helper";
import { prisma } from "@/server/db/client";
import { ApiResponse } from "@/server/utils/api-response";
import { JwtService } from "@/server/auth/jwt.service";

export const Route = createAPIFileRoute("/api/report/$id")({
  GET: async ({ request, params }: { request: Request; params: { id: string } }) => {
    try {
      // 1. Authenticate user
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return Response.json(
          ApiResponse.error("Unauthorized: Missing or invalid token.", 401),
          { status: 401 }
        );
      }

      const token = authHeader.split(" ")[1];
      let userId: string;
      try {
        const payload = JwtService.verifyAccessToken(token);
        userId = payload.userId;
      } catch (err) {
        return Response.json(
          ApiResponse.error("Unauthorized: Token verification failed.", 401),
          { status: 401 }
        );
      }

      // 2. Fetch report
      const report = await prisma.report.findUnique({
        where: { id: params.id },
      });

      if (!report) {
        return Response.json(
          ApiResponse.error("Report not found.", 404),
          { status: 404 }
        );
      }

      // 3. Authorization check: must own the report
      if (report.userId !== userId) {
        return Response.json(
          ApiResponse.error("Forbidden: You do not own this report.", 403),
          { status: 403 }
        );
      }

      // 4. Return report status details
      return Response.json(
        ApiResponse.success({
          status: report.status,
          createdAt: report.createdAt,
          medicineName: report.medicineName,
        })
      );
    } catch (error: any) {
      return Response.json(
        ApiResponse.error("Failed to retrieve report. Please try again.", 500),
        { status: 500 }
      );
    }
  },
});
