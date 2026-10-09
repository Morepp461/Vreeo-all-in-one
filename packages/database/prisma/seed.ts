import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const plans = [
  { key: "free", name: "Free" },
  { key: "premium", name: "Premium" },
  { key: "premium_plus", name: "Premium+" },
] as const;

try {
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      update: { name: plan.name },
      create: {
        key: plan.key,
        name: plan.name,
        description: "",
        active: true,
      },
    });
  }
} finally {
  await prisma.$disconnect();
}
