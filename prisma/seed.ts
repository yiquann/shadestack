import { PrismaClient } from "@prisma/client";
import { seedProducts } from "./seedData";

const prisma = new PrismaClient();

async function main() {
  await prisma.product.deleteMany();
  for (const product of seedProducts) {
    await prisma.product.create({ data: product });
  }
  console.log(`Seeded ${seedProducts.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
