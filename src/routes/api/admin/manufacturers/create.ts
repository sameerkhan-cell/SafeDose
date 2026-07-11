import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { prisma } from "@/server/db/client";
import { PasswordService } from "@/server/auth/password.service";

export const Route = createAPIFileRoute("/api/admin/manufacturers/create")({
    POST: async ({ request }: { request: Request }) => {
        try {
            await authorizeRequest(request, ["ADMIN", "SUPER_ADMIN", "DRAP_ADMIN"]);

            const body = await request.json();
            const { email, password, companyName } = body;

            if (!email || !password || !companyName) {
                return Response.json(
                    { success: false, error: "Email, password, and company name are required." },
                    { status: 400 }
                );
            }

            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) {
                return Response.json(
                    { success: false, error: "A user with this email already exists." },
                    { status: 400 }
                );
            }

            if (
                password.length < 8 ||
                !/[A-Z]/.test(password) ||
                !/[a-z]/.test(password) ||
                !/[0-9]/.test(password)
            ) {
                return Response.json(
                    { success: false, error: "Password must be 8+ chars with upper, lower, and a number." },
                    { status: 400 }
                );
            }

            const passwordHash = await PasswordService.hash(password);

            const result = await prisma.$transaction(async (tx) => {
                const user = await tx.user.create({
                    data: {
                        email,
                        passwordHash,
                        name: companyName,
                        role: "MANUFACTURER",
                        status: "ACTIVE",
                    } as any,
                });

                const prefix = "MFG";
                const shortName =
                    companyName.replace(/[^a-zA-Z]/g, "").substring(0, 3).toUpperCase() || "GEN";
                const count = await tx.manufacturer.count({
                    where: { companyCode: { startsWith: `${prefix}-${shortName}` } },
                });
                const counter = (count + 1).toString().padStart(3, "0");
                const companyCode = `${prefix}-${shortName}${counter}`;

                const manufacturer = await tx.manufacturer.create({
                    data: {
                        userId: user.id,
                        companyName,
                        companyCode,
                        licenseNumber: `LIC-MFG-${user.id.slice(-6).toUpperCase()}`,
                    } as any,
                });

                return { user, manufacturer };
            });

            return Response.json({
                success: true,
                data: { email, companyCode: result.manufacturer.companyCode },
            });
        } catch (err: any) {
            return Response.json({ success: false, error: err.message }, { status: 500 });
        }
    },
});
