const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        await prisma.person.update({
            where: { id: 1 },
            data: {
                firstName: 'Govind',
                lastName: 'Singh',
                emails: [{ email: 'govind.appnox@gmail.com', label: 'work' }]
            }
        });

        const existing = await prisma.personEmail.findFirst({
            where: { personId: 1 }
        });

        if (existing) {
            await prisma.personEmail.update({
                where: { id: existing.id },
                data: { email: 'govind.appnox@gmail.com' }
            });
        } else {
            await prisma.personEmail.create({
                data: {
                    personId: 1,
                    email: 'govind.appnox@gmail.com',
                    label: 'work'
                }
            });
        }

        console.log('Updated Person 1 to Govind');
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
