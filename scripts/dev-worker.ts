import { processAnchorQueue } from "../src/server/services/blockchain/blockchain.worker";

console.log("🚀 Starting standalone Mediverify local blockchain queue worker...");
console.log("Polling for PENDING jobs every 15 seconds...\n");

async function poll() {
    try {
        const result = await processAnchorQueue();
        if (result.processed > 0) {
            console.log(`[${new Date().toLocaleTimeString()}] Processed ${result.processed} jobs: ${result.confirmed} confirmed, ${result.failed} failed`);
        }
    } catch (err: any) {
        console.error(`[${new Date().toLocaleTimeString()}] Queue worker error:`, err?.message || err);
    }
}

// Initial check
poll();

// Interval check
setInterval(poll, 15000);
