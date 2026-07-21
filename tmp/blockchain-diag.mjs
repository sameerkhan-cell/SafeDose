/**
 * MediVerify – Blockchain Diagnostic Script (B3–B8 + D14)
 * Run with: node tmp/blockchain-diag.mjs
 * Reads .env directly; never modifies any app code.
 *
 * Fix: ethers v6 JsonRpcProvider needs an explicit Network for Amoy (chainId 80002)
 * so it doesn't hang on auto-detection against an unreliable RPC.
 */
import { readFileSync } from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

// ── Load .env manually ───────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");
const envRaw = readFileSync(envPath, "utf8");
for (const line of envRaw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
}

const PRIVATE_KEY = process.env.BLOCKCHAIN_SIGNER_KEY || "";
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
// Try multiple known-good Amoy endpoints in order
const RPC_CANDIDATES = [
    process.env.POLYGON_AMOY_RPC,
    "https://rpc-amoy.polygon.technology",
    "https://polygon-amoy.drpc.org",
    "https://polygon-amoy-bor-rpc.publicnode.com",
].filter(Boolean);

const require = createRequire(import.meta.url);
const ethers = require("ethers");

// Polygon Amoy testnet = chainId 80002
const AMOY_NETWORK = new ethers.Network("polygon-amoy", 80002);

const ABI = [
    "function owner() view returns (address)",
    "function verifiedManufacturers(address) view returns (bool)",
    "function registerBatch(string _batchId, string _medicineName, uint256 _totalPills, uint256 _expiryDate) external",
    "function verifyPill(string _pillQR, string _location, string _status) external",
];

async function tryProvider(rpcUrl) {
    // staticNetwork=AMOY_NETWORK prevents the auto-detect hang
    const p = new ethers.JsonRpcProvider(rpcUrl, AMOY_NETWORK, { staticNetwork: AMOY_NETWORK });
    const blockNum = await Promise.race([
        p.getBlockNumber(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
    ]);
    return { provider: p, blockNum, rpcUrl };
}

async function main() {
    console.log("\n=== MediVerify Blockchain Diagnostic ===\n");
    console.log(`CONTRACT_ADDRESS  : ${CONTRACT_ADDRESS}`);
    console.log(`PRIVATE_KEY set   : ${PRIVATE_KEY ? "YES (length=" + PRIVATE_KEY.length + ")" : "NO"}`);
    console.log(`RPC candidates    : ${RPC_CANDIDATES.join(", ")}`);

    // B3 — Block number (try each RPC until one works)
    console.log("\n--- B3: Provider block number ---");
    let provider, blockNum, usedRpc;
    for (const rpc of RPC_CANDIDATES) {
        try {
            console.log(`  Trying: ${rpc} ...`);
            const result = await tryProvider(rpc);
            provider = result.provider;
            blockNum = result.blockNum;
            usedRpc = result.rpcUrl;
            break;
        } catch (e) {
            console.log(`  FAILED (${e.message})`);
        }
    }
    if (!provider) {
        console.log("ALL RPC endpoints failed → BROKEN (no network connectivity or all endpoints down)");
        return;
    }
    console.log(`Current block number: ${blockNum} (via ${usedRpc}) → OK`);

    // B4 — Contract bytecode
    console.log("\n--- B4: Contract bytecode check ---");
    let bytecode;
    try {
        bytecode = await provider.getCode(CONTRACT_ADDRESS);
        if (bytecode === "0x") {
            console.log(`getCode("${CONTRACT_ADDRESS}") returned "0x"`);
            console.log(`→ NOTHING DEPLOYED at this address on Polygon Amoy → BROKEN`);
        } else {
            console.log(`getCode returned ${bytecode.length} hex chars of bytecode → CONTRACT EXISTS → OK`);
        }
    } catch (e) {
        console.log(`getCode ERROR: ${e.message} → BROKEN`);
        return;
    }

    if (bytecode === "0x") {
        console.log("\nSkipping B5–B8 and D14: no contract deployed.");
        return;
    }

    const readContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    // B5 — owner()
    console.log("\n--- B5: Contract owner() ---");
    let ownerAddress = null;
    try {
        ownerAddress = await readContract.owner();
        console.log(`owner() = ${ownerAddress}`);
    } catch (e) {
        console.log(`owner() CALL ERROR: ${e.message}`);
    }

    // B6 — Wallet address from BLOCKCHAIN_SIGNER_KEY
    console.log("\n--- B6: Signer wallet address ---");
    let wallet = null;
    let walletAddress = null;
    try {
        const rawKey = PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : "0x" + PRIVATE_KEY;
        wallet = new ethers.Wallet(rawKey, provider);
        walletAddress = wallet.address;
        console.log(`Wallet address (from BLOCKCHAIN_SIGNER_KEY): ${walletAddress}`);
        if (ownerAddress) {
            const same = walletAddress.toLowerCase() === ownerAddress.toLowerCase();
            console.log(`Is signer == owner: ${same ? "YES → OK" : "NO → signer is NOT the contract owner"}`);
        }
    } catch (e) {
        console.log(`Wallet derivation ERROR: ${e.message}`);
    }

    // B7 — POL balance
    console.log("\n--- B7: Signer wallet POL balance ---");
    let balWei = 0n;
    if (wallet) {
        try {
            balWei = await provider.getBalance(walletAddress);
            const balPOL = ethers.formatEther(balWei);
            console.log(`Balance: ${balPOL} POL (${balWei.toString()} wei)`);
            if (balWei === 0n) {
                console.log("BALANCE IS ZERO → every transaction will fail for lack of gas → BROKEN");
            } else {
                console.log("Balance > 0 → OK");
            }
        } catch (e) {
            console.log(`getBalance ERROR: ${e.message}`);
        }
    }

    // B8 — verifiedManufacturers check
    console.log("\n--- B8: verifiedManufacturers(signerAddress) ---");
    let isVerified = false;
    if (walletAddress && ownerAddress) {
        const isOwner = walletAddress.toLowerCase() === ownerAddress.toLowerCase();
        if (isOwner) {
            console.log("Signer IS the owner — passes onlyVerifiedManufacturer (owner always allowed). Skipping mapping check.");
            isVerified = true;
        } else {
            try {
                isVerified = await readContract.verifiedManufacturers(walletAddress);
                console.log(`verifiedManufacturers(${walletAddress}) = ${isVerified}`);
                if (!isVerified) {
                    console.log("→ Wallet NOT a verified manufacturer: registerBatch() WILL REVERT → BROKEN");
                } else {
                    console.log("→ Wallet IS a verified manufacturer → OK");
                }
            } catch (e) {
                console.log(`verifiedManufacturers() ERROR: ${e.message}`);
            }
        }
    }

    // D14 — Live transaction
    console.log("\n--- D14: Live test transaction ---");
    if (!wallet) {
        console.log("Skipping: no valid wallet.");
    } else if (balWei === 0n) {
        console.log("Skipping: wallet has 0 POL balance — transaction would fail immediately for lack of gas.");
    } else if (!isVerified) {
        const testPillQR = `DIAG-PILL-${Date.now()}`;
        console.log(`Wallet cannot registerBatch (not owner/manufacturer). Trying verifyPill("${testPillQR}")...`);
        const writeContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
        try {
            const tx = await writeContract.verifyPill(testPillQR, "Karachi", "GENUINE");
            console.log(`Tx sent: ${tx.hash}`);
            const receipt = await tx.wait();
            console.log(`CONFIRMED → Tx: ${receipt.hash}`);
            console.log(`PolygonScan: https://amoy.polygonscan.com/tx/${receipt.hash}`);
        } catch (e) {
            console.log(`verifyPill FAILED (expected if pill not registered on-chain):`);
            console.log(`  Full error: ${e.message}`);
            if (e.data) console.log(`  Error data: ${JSON.stringify(e.data)}`);
        }
    } else {
        const testBatchId = `DIAG-${Date.now()}`;
        console.log(`Attempting registerBatch("${testBatchId}", "DiagMed", 10, ${Math.floor(Date.now() / 1000) + 86400})...`);
        const writeContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
        try {
            const tx = await writeContract.registerBatch(
                testBatchId, "DiagMed", 10,
                Math.floor(Date.now() / 1000) + 86400
            );
            console.log(`Tx sent: ${tx.hash}`);
            const receipt = await tx.wait();
            console.log(`CONFIRMED → Tx: ${receipt.hash}`);
            console.log(`Block: ${receipt.blockNumber}`);
            console.log(`PolygonScan: https://amoy.polygonscan.com/tx/${receipt.hash}`);
        } catch (e) {
            console.log(`registerBatch FAILED:`);
            console.log(`  Full error: ${e.message}`);
            if (e.data) console.log(`  Error data: ${JSON.stringify(e.data)}`);
        }
    }

    console.log("\n=== Diagnostic complete ===\n");
}

main().catch(console.error);
