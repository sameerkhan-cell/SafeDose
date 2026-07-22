import { prisma } from "../db/client";
import { ApiError } from "../utils/api-response";

export class RecallService {
    static async initiateManufacturerRecall(
        userId: string,
        data: {
            batchId: string;
            reason: string;
            severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
        }
    ) {
        const { batchId, reason, severity } = data;

        // Fetch the batch via prisma, including its medicine and manufacturer relation.
        const batch = await prisma.batch.findUnique({
            where: { id: batchId },
            include: {
                medicine: {
                    include: {
                        manufacturer: true
                    }
                }
            }
        });

        if (!batch) {
            throw new ApiError(404, "Batch not found.");
        }

        // CRITICAL SECURITY CHECK: verify batch.medicine.manufacturer.userId === userId
        if (!batch.medicine?.manufacturer || batch.medicine.manufacturer.userId !== userId) {
            throw new ApiError(403, "You can only recall your own batches.");
        }

        // If the batch is already recalled (isRecalled: true), return 400
        if (batch.isRecalled) {
            throw new ApiError(400, "This batch has already been recalled.");
        }

        // In a single transaction: update Batch, and create DRAPRecall
        return await prisma.$transaction(async (tx) => {
            const updatedBatch = await tx.batch.update({
                where: { id: batchId },
                data: {
                    isRecalled: true,
                    recallReason: reason,
                    status: "RECALLED"
                },
                include: {
                    medicine: {
                        include: {
                            manufacturer: true
                        }
                    }
                }
            });

            const drapRecall = await tx.dRAPRecall.create({
                data: {
                    medicineName: batch.medicine.name,
                    batchNumber: batch.batchNumber,
                    recallDate: new Date(),
                    reason,
                    severity,
                    isActive: true,
                    createdBy: userId
                }
            });

            return {
                batch: updatedBatch,
                recall: drapRecall
            };
        });
    }
}
