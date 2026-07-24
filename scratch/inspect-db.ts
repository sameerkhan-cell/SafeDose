import { prisma } from "../src/server/db/client";
import { BlockchainService } from "../src/server/services/blockchain/blockchain.service";

async function main() {
    console.log("=== SIGNER WALLET BALANCE ===");
    const balance = await BlockchainService.getSignerBalance();
    const address = BlockchainService.getWalletAddress();
    console.log(`Signer Address: ${address}`);
    console.log(`POL Balance: ${balance} POL`);

    console.log("\n=== USERS & PROFILES ===");
    const users = await prisma.user.findMany({
        include: {
            manufacturer: true,
            pharmacy: true,
        }
    });
    for (const u of users) {
        console.log(`User: ${u.id} | Email: ${u.email} | Role: ${u.role}`);
        if (u.manufacturer) {
            console.log(`   Manufacturer: ID=${u.manufacturer.id}, Company=${u.manufacturer.companyName}, Verified=${u.manufacturer.isVerified}, Suspended=${u.manufacturer.isSuspended}`);
        }
        if (u.pharmacy) {
            console.log(`   Pharmacy: ID=${u.pharmacy.id}, Name=${u.pharmacy.name}, Verified=${u.pharmacy.isVerified}`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
