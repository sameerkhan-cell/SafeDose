import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    const passwordHash = await bcrypt.hash("Password123!", 12);

    await prisma.user.upsert({
        where: { email: "admin@mediverify.com" },
        update: {
            role: "ADMIN",
            passwordHash,
        },
        create: {
            email: "admin@mediverify.com",
            name: "DRAP Admin",
            passwordHash,
            role: "ADMIN",
        },
    });

    console.log("✅ Minimal seed complete. Created single ADMIN account:");
    console.log("Email: admin@mediverify.com");
    console.log("Password: Password123!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
