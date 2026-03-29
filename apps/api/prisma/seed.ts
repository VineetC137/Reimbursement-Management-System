import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const roles = ["ADMIN", "MANAGER", "EMPLOYEE"];

  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, description: `${name} role` }
    });
  }

  console.log("Seed completed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
