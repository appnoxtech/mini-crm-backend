
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const company = await prisma.company.findFirst();
    console.log(company);
}
main().catch(console.error).finally(() => prisma.$disconnect());
