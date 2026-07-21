/**
 * MediVerify — Hardhat Deploy Script
 *
 * ⚠️  DO NOT RUN THIS AGAINST THE LIVE NETWORK UNLESS REDEPLOYMENT IS INTENTIONAL.
 * The contract is already deployed and confirmed at:
 *   0x0039546e8A3eE8b068878961CD721a775F8750EE  (Polygon Amoy testnet)
 * Confirmed via diagnostic run on 2026-07-20 (block 42,751,097, tx D14).
 *
 * This script exists purely so the team has a reproducible path if redeployment
 * is ever needed (e.g., contract upgrade, owner key rotation, or fresh testnet).
 *
 * To deploy to Amoy (only when needed):
 *   npx hardhat run scripts/deploy.ts --network amoy
 *
 * After deployment, update NEXT_PUBLIC_CONTRACT_ADDRESS in .env to the new address.
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying MediVerify with account:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "POL");

    if (balance === 0n) {
        throw new Error("Deployer wallet has zero balance. Fund it with POL before deploying.");
    }

    const MediVerify = await ethers.getContractFactory("MediVerify");
    console.log("Deploying contract...");
    const contract = await MediVerify.deploy();
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    const deployTx = contract.deploymentTransaction();
    const receipt = deployTx ? await deployTx.wait() : null;

    const deployment = {
        network: "polygon-amoy",
        chainId: 80002,
        contractAddress: address,
        deployer: deployer.address,
        blockNumber: receipt?.blockNumber ?? null,
        txHash: deployTx?.hash ?? null,
        deployedAt: new Date().toISOString(),
    };

    console.log("\n✅ MediVerify deployed successfully!");
    console.log("  Address  :", address);
    console.log("  Block    :", deployment.blockNumber);
    console.log("  Tx hash  :", deployment.txHash);
    console.log(`  Explorer : https://amoy.polygonscan.com/address/${address}`);
    console.log("\n⚠️  Update NEXT_PUBLIC_CONTRACT_ADDRESS in .env to:", address);

    // Persist deployment record
    const dir = path.resolve(__dirname, "../deployments");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, "amoy.json");
    fs.writeFileSync(filePath, JSON.stringify(deployment, null, 2));
    console.log("\nDeployment record saved to:", filePath);
}

main().catch((err) => {
    console.error("Deployment failed:", err);
    process.exit(1);
});
