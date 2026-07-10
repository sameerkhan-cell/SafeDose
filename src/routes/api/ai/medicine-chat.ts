import { createAPIFileRoute } from "@/lib/api-route-helper";
import { AIMedicineChatService } from "@/server/services/ai-medicine-chat.service";
import { ApiResponse, ApiError } from "@/server/utils/api-response";
import { JwtService } from "@/server/auth/jwt.service";

/**
 * POST /api/ai/medicine-chat
 *
 * Authenticated (PATIENT only) streaming endpoint that answers patient
 * questions about a scanned medicine via Gemini AI.
 *
 * Response body: text/plain; charset=utf-8 streaming chunks.
 * Clients should consume the response body as a ReadableStream.
 */
export const Route = createAPIFileRoute("/api/ai/medicine-chat")({
    POST: async ({ request }) => {
        // ── 1. Strict Authentication ─────────────────────────────────────
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return Response.json(
                ApiResponse.error("Authentication required.", 401),
                { status: 401 }
            );
        }

        let userId: string;
        let userRole: string;
        try {
            const payload = JwtService.verifyAccessToken(
                authHeader.split(" ")[1]
            );
            userId = payload.userId;
            userRole = payload.role;
        } catch {
            return Response.json(
                ApiResponse.error("Invalid or expired session.", 401),
                { status: 401 }
            );
        }

        // ── 2. Role Check — patients only ────────────────────────────────
        if (userRole !== "PATIENT") {
            return Response.json(
                ApiResponse.error(
                    "Access denied. This endpoint is for patients only.",
                    403
                ),
                { status: 403 }
            );
        }

        // ── 3. Parse & Validate Request Body ────────────────────────────
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return Response.json(
                ApiResponse.error("Invalid JSON in request body.", 400),
                { status: 400 }
            );
        }

        if (!body || typeof body !== "object") {
            return Response.json(
                ApiResponse.error("Request body must be a JSON object.", 400),
                { status: 400 }
            );
        }

        const { message, history, medicineContext } = body as Record<
            string,
            unknown
        >;

        // Validate `message`
        if (
            typeof message !== "string" ||
            message.trim().length === 0 ||
            message.length > 1000
        ) {
            return Response.json(
                ApiResponse.error(
                    "Field 'message' must be a non-empty string (max 1000 characters).",
                    400
                ),
                { status: 400 }
            );
        }

        // Validate `history` — cap at last 10 messages
        if (!Array.isArray(history)) {
            return Response.json(
                ApiResponse.error("Field 'history' must be an array.", 400),
                { status: 400 }
            );
        }

        const validRoles = new Set(["user", "assistant"]);
        for (const entry of history) {
            if (
                typeof entry !== "object" ||
                entry === null ||
                !validRoles.has((entry as any).role) ||
                typeof (entry as any).content !== "string"
            ) {
                return Response.json(
                    ApiResponse.error(
                        "Each history entry must have role ('user'|'assistant') and content (string).",
                        400
                    ),
                    { status: 400 }
                );
            }
        }

        // Truncate to the last 10 messages to control token cost
        const cappedHistory = history.slice(-10) as {
            role: "user" | "assistant";
            content: string;
        }[];

        // Validate `medicineContext` — required fields
        if (
            !medicineContext ||
            typeof medicineContext !== "object" ||
            Array.isArray(medicineContext)
        ) {
            return Response.json(
                ApiResponse.error(
                    "Field 'medicineContext' must be an object.",
                    400
                ),
                { status: 400 }
            );
        }

        const ctx = medicineContext as Record<string, unknown>;
        const requiredFields: Array<keyof typeof ctx> = [
            "name",
            "manufacturer",
            "batchNumber",
            "expiry",
            "status",
        ];

        for (const field of requiredFields) {
            if (typeof ctx[field] !== "string" || (ctx[field] as string).trim().length === 0) {
                return Response.json(
                    ApiResponse.error(
                        `Field 'medicineContext.${field}' is required and must be a non-empty string.`,
                        400
                    ),
                    { status: 400 }
                );
            }
        }

        const typedContext = {
            name: ctx.name as string,
            manufacturer: ctx.manufacturer as string,
            batchNumber: ctx.batchNumber as string,
            expiry: ctx.expiry as string,
            status: ctx.status as string,
            category:
                typeof ctx.category === "string" ? ctx.category : undefined,
            activeIngredients:
                typeof ctx.activeIngredients === "string"
                    ? ctx.activeIngredients
                    : undefined,
            genericName:
                typeof ctx.genericName === "string"
                    ? ctx.genericName
                    : undefined,
            approvalStatus:
                typeof ctx.approvalStatus === "string"
                    ? ctx.approvalStatus
                    : undefined,
        };

        // ── 4. Stream AI Response ────────────────────────────────────────
        try {
            const generator = AIMedicineChatService.streamChatResponse({
                message: message.trim(),
                history: cappedHistory,
                medicineContext: typedContext,
            });

            // Wrap the async generator in a WHATWG ReadableStream and stream
            // plain text chunks back. The client reads via fetch + ReadableStream.
            const stream = new ReadableStream({
                async start(controller) {
                    const encoder = new TextEncoder();
                    try {
                        for await (const chunk of generator) {
                            controller.enqueue(encoder.encode(chunk));
                        }
                        controller.close();
                    } catch (err: any) {
                        // Error mid-stream: enqueue a sentinel and close gracefully
                        // rather than crashing the server.
                        const errMsg =
                            err instanceof ApiError
                                ? err.message
                                : "An error occurred while generating the response.";
                        controller.enqueue(
                            encoder.encode(`\n\n[ERROR]: ${errMsg}`)
                        );
                        controller.close();
                    }
                },
            });

            return new Response(stream, {
                status: 200,
                headers: {
                    "Content-Type": "text/plain; charset=utf-8",
                    // Prevent buffering by proxies/gateways
                    "X-Content-Type-Options": "nosniff",
                    "Cache-Control": "no-cache",
                    // Allow frontend to read the custom headers in CORS context
                    "Transfer-Encoding": "chunked",
                },
            });
        } catch (error: any) {
            // Error before the stream started — return a normal JSON error
            const status = error.statusCode || 500;
            return Response.json(
                ApiResponse.error(
                    error.message || "Failed to start AI chat session.",
                    status
                ),
                { status }
            );
        }
    },
});
