import { ethers } from "ethers";
import { prisma } from "../../db/client";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
const PRIVATE_KEY = process.env.BLOCKCHAIN_SIGNER_KEY || "";
const RPC_URL = process.env.POLYGON_AMOY_RPC || "https://rpc-amoy.polygon.technology";

// Polygon Amoy testnet = chainId 80002. Using staticNetwork prevents the
// ethers v6 auto-detect hang when the RPC is slow or temporarily unreachable.
const AMOY_NETWORK = new ethers.Network("polygon-amoy", 80002);

// ABI Fragment for the core functions
const MEDIVERIFY_ABI = [
    "function registerBatch(string _batchId, string _medicineName, uint256 _totalPills, uint256 _expiryDate) external",
    "function registerPill(string _pillQR, string _batchId, uint256 _pillNumber) external",
    "function verifyPill(string _pillQR, string _location, string _status) external",
    "function owner() view returns (address)",
    "function verifiedManufacturers(address) view returns (bool)",
    "function batches(string) view returns (string batchId, string medicineName, uint256 totalPills, uint256 expiryDate, address manufacturer, bool isRegistered, bool isRecalled)",
    "function pills(string) view returns (string pillQR, string batchId, uint256 pillNumber, bool isRegistered)",
    "function getPillHistory(string _pillQR) view returns (tuple(uint256 timestamp, string location, string status)[])",
    "event BatchRegistered(string indexed batchId, string medicineName, address manufacturer)",
];

export class BlockchainService {
    private static getWallet(): ethers.Wallet | null {
        const key = (process.env.BLOCKCHAIN_SIGNER_KEY || PRIVATE_KEY || "").trim();
        if (!key || key === "0x0000000000000000000000000000000000000000000000000000000000000000") {
            return null;
        }
        try {
            const normalizedKey = key.startsWith("0x") ? key : "0x" + key;
            return new ethers.Wallet(normalizedKey, this.getProvider());
        } catch (e) {
            console.warn("[BLOCKCHAIN] Failed to initialize wallet with provided key.");
            return null;
        }
    }

    static getContract() {
        const wallet = this.getWallet();
        if (!wallet) throw new Error("Blockchain signer not configured.");
        const contractAddr = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || CONTRACT_ADDRESS || "").trim();
        return new ethers.Contract(contractAddr, MEDIVERIFY_ABI, wallet);
    }

    static getWalletAddress(): string | null {
        return this.getWallet()?.address ?? null;
    }

    static getProvider() {
        const rpcUrl = (process.env.POLYGON_AMOY_RPC || RPC_URL || "https://rpc-amoy.polygon.technology").trim();
        return new ethers.JsonRpcProvider(rpcUrl, AMOY_NETWORK, {
            staticNetwork: AMOY_NETWORK,
        });
    }

    static async getSignerBalance(): Promise<string> {
        const wallet = this.getWallet();
        if (!wallet) return "0.0";
        try {
            const provider = this.getProvider();
            const balance = await provider.getBalance(wallet.address);
            return ethers.formatEther(balance);
        } catch (error) {
            console.error("[BLOCKCHAIN] Failed to fetch signer balance:", error);
            return "0.0";
        }
    }

    /**
     * Anchors a batch on-chain by calling registerBatch().
     * On success, updates the Batch row in DB with txHash and blockchainStatus="CONFIRMED".
     * Throws on failure — caller (queue worker) handles retry logic.
     */
    static async anchorBatch(batch: any): Promise<{ txHash: string; blockNumber: number; gasUsed: string }> {
        try {
            const contract = this.getContract();
            const tx = await contract.registerBatch(
                batch.batchNumber,
                batch.medicine.name,
                batch.totalPillsGenerated,
                Math.floor(new Date(batch.expiryDate).getTime() / 1000)
            );

            console.log(`[BLOCKCHAIN] anchorBatch tx sent: ${tx.hash} (batch=${batch.batchNumber})`);
            const receipt = await tx.wait();

            await prisma.batch.update({
                where: { id: batch.id },
                data: {
                    txHash: receipt.hash,
                    blockchainStatus: "CONFIRMED",
                },
            });

            const gasUsed = receipt.gasUsed?.toString() ?? null;
            console.log(`[BLOCKCHAIN] anchorBatch confirmed: ${receipt.hash} (block=${receipt.blockNumber}, gas=${gasUsed})`);
            return { txHash: receipt.hash, blockNumber: receipt.blockNumber, gasUsed: gasUsed ?? "0" };
        } catch (error) {
            console.error("[BLOCKCHAIN] anchorBatch error:", error);
            throw error;
        }
    }

    /**
     * Anchors an individual pill on-chain by calling registerPill().
     * On success, updates the Pill row in DB with blockchainTx and blockchainStatus="CONFIRMED".
     * Throws on failure — caller (queue worker) handles retry logic.
     *
     * Contract signature: registerPill(string _pillQR, string _batchId, uint256 _pillNumber)
     * Requires: onlyVerifiedManufacturer, and the parent batch must already be registered on-chain.
     */
    static async anchorPill(
        pillId: string,
        pillQR: string,
        batchNumber: string,
        pillNumber: number
    ): Promise<{ txHash: string; blockNumber: number; gasUsed: string }> {
        try {
            const contract = this.getContract();
            const tx = await contract.registerPill(pillQR, batchNumber, pillNumber);

            console.log(`[BLOCKCHAIN] anchorPill tx sent: ${tx.hash} (pill=${pillQR})`);
            const receipt = await tx.wait();

            await prisma.pill.update({
                where: { id: pillId },
                data: {
                    blockchainTx: receipt.hash,
                    blockchainStatus: "CONFIRMED",
                },
            });

            const gasUsed = receipt.gasUsed?.toString() ?? null;
            console.log(`[BLOCKCHAIN] anchorPill confirmed: ${receipt.hash} (block=${receipt.blockNumber}, gas=${gasUsed})`);
            return { txHash: receipt.hash, blockNumber: receipt.blockNumber, gasUsed: gasUsed ?? "0" };
        } catch (error) {
            console.error(`[BLOCKCHAIN] anchorPill error (pill=${pillQR}):`, error);
            throw error;
        }
    }

    /**
     * Anchors a verification event on-chain by calling verifyPill().
     * Non-throwing — returns null on failure.
     * NOTE: verifyPill() requires the pill to be registered on-chain first.
     * If the pill hasn't been anchored yet (PENDING_ANCHOR), this will revert.
     * That is expected and handled by the caller with structured error logging.
     */
    static async anchorVerification(
        qrCode: string,
        location: string,
        status: string
    ): Promise<string | null> {
        try {
            const contract = this.getContract();
            const tx = await contract.verifyPill(qrCode, location, status);
            const receipt = await tx.wait();
            console.log(`[BLOCKCHAIN] anchorVerification confirmed: ${receipt.hash} (pill=${qrCode})`);
            return receipt.hash;
        } catch (error) {
            console.error("[BLOCKCHAIN] anchorVerification error:", error);
            return null;
        }
    }

    /**
     * Read-only: checks if a pill QR is registered on-chain.
     * Costs zero gas.
     */
    static async isPillRegistered(pillQR: string): Promise<boolean> {
        try {
            const contract = new ethers.Contract(CONTRACT_ADDRESS, MEDIVERIFY_ABI, this.provider);
            const pillInfo = await contract.pills(pillQR);
            return !!pillInfo.isRegistered;
        } catch (error) {
            console.error("[BLOCKCHAIN] isPillRegistered read-only check failed:", error);
            return false;
        }
    }

    /**
     * Read-only: returns the on-chain verification history for a pill QR code.
     */
    static async getOnChainHistory(qrCode: string) {
        try {
            const contract = new ethers.Contract(CONTRACT_ADDRESS, MEDIVERIFY_ABI, this.provider);
            return await contract.getPillHistory(qrCode);
        } catch (error) {
            return [];
        }
    }
}
