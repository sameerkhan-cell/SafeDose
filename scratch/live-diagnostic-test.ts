import { prisma } from "../src/server/db/client";
import { BlockchainService } from "../src/server/services/blockchain/blockchain.service";
import { BatchService } from "../src/server/services/manufacturer/batch.service";
import { processAnchorQueue } from "../src/server/services/blockchain/blockchain.worker";
import { VerificationEngine } from "../src/server/services/verification.service";
import { PasswordService } from "../src/server/auth/password.service";

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runLiveDiagnosticTest() {
    console.log("=================================================");
    console.log("   LIVE DIAGNOSTIC TEST - MEDIVERIFY BLOCKCHAIN  ");
    console.log("=================================================\n");

    // -------------------------------------------------------------------
    // STEP 1: Confirm current signer wallet POL balance
    // -------------------------------------------------------------------
    console.log("--- STEP 1: Signer Wallet Initial Status ---");
    const walletAddress = BlockchainService.getWalletAddress();
    const initialBalanceStr = await BlockchainService.getSignerBalance();
    const initialBalance = parseFloat(initialBalanceStr);
    console.log(`Signer Address: ${walletAddress}`);
    console.log(`Initial POL Balance: ${initialBalanceStr} POL\n`);

    // -------------------------------------------------------------------
    // Setup Accounts (Manufacturer, Pharmacy, Patient)
    // -------------------------------------------------------------------
    console.log("--- Setting up test accounts ---");
    const mfgEmail = "mfg_diag_test@mediverify.com";
    const pharmacyEmail = "pharmacy_diag_test@mediverify.com";
    const patientEmail = "patient_diag_test@mediverify.com";
    const pwdHash = await PasswordService.hash("Password123!");

    // Manufacturer
    let mfgUser = await prisma.user.findUnique({ where: { email: mfgEmail }, include: { manufacturer: true } });
    if (!mfgUser) {
        mfgUser = await prisma.user.create({
            data: {
                email: mfgEmail,
                passwordHash: pwdHash,
                name: "TestMed Pharma Corp",
                role: "MANUFACTURER",
                status: "ACTIVE",
                manufacturer: {
                    create: {
                        companyName: "TestMed Pharma Corp",
                        companyCode: "MFG-TM",
                        licenseNumber: "LIC-MFG-TM001",
                        isVerified: true,
                        isSuspended: false,
                    }
                }
            },
            include: { manufacturer: true }
        });
    } else {
        await prisma.manufacturer.update({
            where: { userId: mfgUser.id },
            data: { isVerified: true, isSuspended: false }
        });
    }

    // Pharmacy
    let pharmacyUser = await prisma.user.findUnique({ where: { email: pharmacyEmail }, include: { pharmacy: true } });
    if (!pharmacyUser) {
        pharmacyUser = await prisma.user.create({
            data: {
                email: pharmacyEmail,
                passwordHash: pwdHash,
                name: "City Care Pharmacy",
                role: "PHARMACY",
                status: "ACTIVE",
                pharmacy: {
                    create: {
                        name: "City Care Pharmacy",
                        licenseNumber: "LIC-PHR-CC001",
                        isVerified: true,
                    }
                }
            },
            include: { pharmacy: true }
        });
    }

    // Patient
    let patientUser = await prisma.user.findUnique({ where: { email: patientEmail } });
    if (!patientUser) {
        patientUser = await prisma.user.create({
            data: {
                email: patientEmail,
                passwordHash: pwdHash,
                name: "Ali Ahmed",
                role: "PATIENT",
                status: "ACTIVE",
            }
        });
    }

    console.log(`Manufacturer User ID: ${mfgUser.id}`);
    console.log(`Pharmacy User ID: ${pharmacyUser.id}`);
    console.log(`Patient User ID: ${patientUser.id}\n`);

    // -------------------------------------------------------------------
    // STEP 2: Create ONE real test batch through actual service flow
    // -------------------------------------------------------------------
    console.log("--- STEP 2: Create Batch ---");
    const testBatchNumber = `TM-DIAG-${Date.now().toString(36).toUpperCase()}`;
    const batchResult = await BatchService.registerBatch(mfgUser.id, {
        medicineName: "TestMed 500mg",
        genericName: "Paracetamol",
        category: "Analgesic",
        dosage: "500mg",
        description: "Live Diagnostic Test Medicine",
        batchNumber: testBatchNumber,
        manufacturingDate: new Date().toISOString().split("T")[0],
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        quantityBoxes: 1,
        pillsPerBox: 3,
        totalCartons: 1,
    });

    const batchRecord = await prisma.batch.findUnique({
        where: { id: batchResult.batch.id },
        include: { pills: { orderBy: { pillNumber: "asc" } }, boxes: true, cartons: true }
    });

    console.log(`Created Batch ID: ${batchRecord?.id}`);
    console.log(`Batch Number: ${batchRecord?.batchNumber}`);
    console.log(`Initial blockchainStatus: ${batchRecord?.blockchainStatus}`);
    console.log(`Total Pills Generated: ${batchRecord?.totalPillsGenerated}`);
    console.log(`Pill QRs: ${batchRecord?.pills.map(p => p.qrCode).join(", ")}\n`);

    // -------------------------------------------------------------------
    // STEP 3: Check BlockchainJob table immediately after batch creation
    // -------------------------------------------------------------------
    console.log("--- STEP 3: Check Enqueued Blockchain Jobs ---");
    const enqueuedJobs = await prisma.blockchainJob.findMany({
        where: {
            OR: [
                { entityId: batchRecord!.id },
                { entityId: { in: batchRecord!.pills.map(p => p.id) } }
            ]
        },
        orderBy: { createdAt: "asc" }
    });

    console.log(`Total Jobs Enqueued: ${enqueuedJobs.length}`);
    for (const job of enqueuedJobs) {
        console.log(`  Job ID: ${job.id} | Type: ${job.entityType} | Ref: ${job.entityRef} | Status: ${job.status}`);
    }
    console.log("");

    // -------------------------------------------------------------------
    // STEP 8 (Pre-Check test before queue runs): Test free pre-check path on PENDING pill
    // -------------------------------------------------------------------
    console.log("--- STEP 8: Testing Free Pre-Check Path on PENDING Pill ---");
    const pendingPill = batchRecord!.pills[2]; // Use pill 3 for pending pre-check
    console.log(`Testing verification on PENDING pill QR: ${pendingPill.qrCode}`);

    // Pre-check balance before verification attempt
    const preCheckBalanceStr = await BlockchainService.getSignerBalance();
    console.log(`Signer Balance before pending pill check: ${preCheckBalanceStr} POL`);

    // Call VerificationEngine.verify on pending pill (as patient)
    const pendingVerifyRes = await VerificationEngine.verify({
        code: pendingPill.qrCode,
        location: "Diagnostic Test Lab",
        userId: patientUser.id
    });
    console.log(`Verification Response ResultType: ${pendingVerifyRes.resultType}`);
    console.log(`Verification Response Message: ${pendingVerifyRes.message}`);

    // Allow background promises to resolve
    await sleep(3000);

    // Check BlockchainJob for PENDING_ANCHOR log entry
    const pendingAnchorJobs = await prisma.blockchainJob.findMany({
        where: {
            entityRef: pendingPill.qrCode,
            lastError: { contains: "PENDING_ANCHOR" }
        }
    });

    const postCheckBalanceStr = await BlockchainService.getSignerBalance();
    console.log(`Signer Balance after pending pill check: ${postCheckBalanceStr} POL`);
    console.log(`Pending Anchor Log Entries Found: ${pendingAnchorJobs.length}`);
    if (pendingAnchorJobs.length > 0) {
        console.log(`Pending Anchor Job ID: ${pendingAnchorJobs[0].id} | status: ${pendingAnchorJobs[0].status} | lastError text: "${pendingAnchorJobs[0].lastError}"`);
    }
    console.log(`Gas spent on pending pill check: ${parseFloat(preCheckBalanceStr) - parseFloat(postCheckBalanceStr)} POL (EXPECTED: 0.0)\n`);

    // -------------------------------------------------------------------
    // STEP 4: Process the Blockchain Queue
    // -------------------------------------------------------------------
    console.log("--- STEP 4: Process Blockchain Queue (Transmitting to Polygon Amoy) ---");
    console.log("Processing queue batch...");
    const workerResult = await processAnchorQueue();
    console.log(`Worker pass result: Processed=${workerResult.processed}, Confirmed=${workerResult.confirmed}, Failed=${workerResult.failed}`);

    // Loop until all 4 jobs are CONFIRMED or FAILED (max 3 mins)
    let pendingJobsCount = 4;
    let attempts = 0;
    while (pendingJobsCount > 0 && attempts < 10) {
        attempts++;
        await sleep(10000);
        const currentJobs = await prisma.blockchainJob.findMany({
            where: { id: { in: enqueuedJobs.map(j => j.id) } }
        });
        pendingJobsCount = currentJobs.filter(j => j.status === "PENDING" || j.status === "PROCESSING").length;
        console.log(`[Attempt ${attempts}] Queue status check: ${4 - pendingJobsCount}/4 completed...`);
        if (pendingJobsCount > 0) {
            await processAnchorQueue();
        }
    }

    // Re-check BlockchainJob table status
    const updatedJobs = await prisma.blockchainJob.findMany({
        where: {
            id: { in: enqueuedJobs.map(j => j.id) }
        },
        orderBy: { createdAt: "asc" }
    });

    console.log("\nUpdated BlockchainJob Statuses:");
    for (const job of updatedJobs) {
        console.log(`  Job ID: ${job.id} | Type: ${job.entityType} | Ref: ${job.entityRef} | Status: ${job.status} | txHash: ${job.txHash || "N/A"} | lastError: ${job.lastError || "None"}`);
    }
    console.log("");

    // -------------------------------------------------------------------
    // STEP 5: Report Batch Updated Status & txHash
    // -------------------------------------------------------------------
    console.log("--- STEP 5: Batch Updated Blockchain Status ---");
    const updatedBatch = await prisma.batch.findUnique({
        where: { id: batchRecord!.id }
    });
    console.log(`Batch ID: ${updatedBatch?.id}`);
    console.log(`Batch Number: ${updatedBatch?.batchNumber}`);
    console.log(`Updated blockchainStatus: ${updatedBatch?.blockchainStatus}`);
    console.log(`Batch txHash: ${updatedBatch?.txHash}`);
    if (updatedBatch?.txHash) {
        console.log(`PolygonScan Link: https://amoy.polygonscan.com/tx/${updatedBatch.txHash}`);
    }
    console.log("");

    // -------------------------------------------------------------------
    // STEP 6: Report Pills Updated Status & txHash
    // -------------------------------------------------------------------
    console.log("--- STEP 6: Pills Updated Blockchain Status ---");
    const updatedPills = await prisma.pill.findMany({
        where: { batchId: batchRecord!.id },
        orderBy: { pillNumber: "asc" }
    });
    for (const pill of updatedPills) {
        console.log(`Pill ID: ${pill.id} | QR: ${pill.qrCode} | Status: ${pill.blockchainStatus} | txHash: ${pill.blockchainTx}`);
        if (pill.blockchainTx) {
            console.log(`   PolygonScan Link: https://amoy.polygonscan.com/tx/${pill.blockchainTx}`);
        }
    }
    console.log("");

    // -------------------------------------------------------------------
    // STEP 7: Test Verification of CONFIRMED Pill
    // -------------------------------------------------------------------
    console.log("--- STEP 7: Verification Flow on CONFIRMED Pill ---");
    // 7a. Pharmacy scans box to establish supply chain check-in
    const boxRecord = batchRecord!.boxes[0];
    console.log(`Pharmacy scanning box QR: ${boxRecord.qrCode}...`);
    const boxVerifyRes = await VerificationEngine.verify({
        code: boxRecord.qrCode,
        location: "City Care Pharmacy, Lahore",
        userId: pharmacyUser.id
    });
    console.log(`Box Verification ResultType: ${boxVerifyRes.resultType}`);

    // 7b. Patient scans confirmed pill #1
    const confirmedPill = updatedPills[0];
    console.log(`Patient scanning confirmed pill QR: ${confirmedPill.qrCode}...`);
    const pillVerifyRes = await VerificationEngine.verify({
        code: confirmedPill.qrCode,
        location: "Gulberg, Lahore",
        userId: patientUser.id
    });

    console.log("API Response:");
    console.log(`  Success: ${pillVerifyRes.success}`);
    console.log(`  ResultType: ${pillVerifyRes.resultType}`);
    console.log(`  Message: ${pillVerifyRes.message}`);

    console.log("Waiting 15 seconds for verification on-chain transaction processing...");
    await sleep(15000);

    // Check VerificationLog & on-chain verification tx
    const vLogs = await prisma.verificationLog.findMany({
        where: { pillId: confirmedPill.id },
        orderBy: { createdAt: "desc" },
        take: 1
    });

    console.log(`VerificationLog ID: ${vLogs[0]?.id}`);

    // Check if verification anchor created a job / tx log in BlockchainJob
    const vAnchorJobs = await prisma.blockchainJob.findMany({
        where: {
            entityRef: confirmedPill.qrCode
        },
        orderBy: { createdAt: "desc" }
    });
    console.log(`Verification Blockchain Jobs count for ${confirmedPill.qrCode}: ${vAnchorJobs.length}`);
    for (const j of vAnchorJobs) {
        console.log(`  Job ID: ${j.id} | Status: ${j.status} | txHash: ${j.txHash} | lastError: ${j.lastError}`);
    }

    // Check on-chain history via BlockchainService
    const onChainHistory = await BlockchainService.getOnChainHistory(confirmedPill.qrCode);
    console.log(`On-Chain Verification History Count: ${onChainHistory.length}`);
    if (onChainHistory.length > 0) {
        console.log(`  On-chain record: location="${onChainHistory[0].location}", status="${onChainHistory[0].status}", timestamp=${onChainHistory[0].timestamp}`);
    }
    console.log("");

    // -------------------------------------------------------------------
    // STEP 9: Final Signer Balance & Calculation
    // -------------------------------------------------------------------
    console.log("--- STEP 9: Final POL Balance & Cost Summary ---");
    const finalBalanceStr = await BlockchainService.getSignerBalance();
    const finalBalance = parseFloat(finalBalanceStr);
    const totalSpent = initialBalance - finalBalance;

    console.log(`Initial Wallet Balance: ${initialBalance.toFixed(18)} POL`);
    console.log(`Final Wallet Balance:   ${finalBalance.toFixed(18)} POL`);
    console.log(`Total POL Spent in Test: ${totalSpent.toFixed(18)} POL`);
    console.log("\n=================================================");
    console.log("   DIAGNOSTIC TEST COMPLETE                      ");
    console.log("=================================================");
}

runLiveDiagnosticTest().catch(console.error).finally(() => prisma.$disconnect());
