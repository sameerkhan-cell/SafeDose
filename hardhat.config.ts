import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        amoy: {
            url: process.env.POLYGON_AMOY_RPC || "https://rpc-amoy.polygon.technology",
            accounts: (() => {
                const key = process.env.BLOCKCHAIN_SIGNER_KEY || process.env.PRIVATE_KEY;
                if (!key) return [];
                // Normalize: Hardhat requires a 0x-prefixed hex key
                return [key.startsWith("0x") ? key : "0x" + key];
            })(),
        },
    },
    etherscan: {
        apiKey: process.env.POLYGONSCAN_API_KEY,
    },
};

export default config;
