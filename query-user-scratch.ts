import dotenv from "dotenv";
dotenv.config();

import { prisma } from "./src/server/db/client";

async function main() {
    const doc = await prisma.manufacturerDocument.findUnique({
        where: { id: "cmr8vtesh000gb56bpmnao8w2" },
        include: { manufacturer: true }
    });
    console.log("Document and Manufacturer Status:", JSON.stringify(doc, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
