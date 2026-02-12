/**
 * Check Person and Organization Emails
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkEmails() {
    try {
        console.log('🔍 Checking Person & Organization Email Data...\n');

        // Check persons with PersonEmail records
        const personsWithPersonEmails = await prisma.person.findMany({
            where: {
                userEmails: { some: {} },
            },
            take: 5,
            include: {
                userEmails: true,
            },
        });

        console.log(`👥 Persons with PersonEmail records: ${personsWithPersonEmails.length}`);
        personsWithPersonEmails.forEach((person: any, i: number) => {
            console.log(`\n${i + 1}. ${person.firstName} ${person.lastName || ''}`);
            console.log(`   Emails: ${person.userEmails?.map((e: any) => e.email).join(', ') || 'None'}`);
        });

        // Check sample persons for JSON emails
        const samplePersons = await prisma.person.findMany({
            take: 5,
        });

        console.log(`\n\n👥 Sample Persons (JSON email field):`);
        samplePersons.forEach((person: any, i: number) => {
            console.log(`\n${i + 1}. ${person.firstName} ${person.lastName || ''}`);
            console.log(`   Emails JSON: ${JSON.stringify(person.emails)}`);
        });

        // Check organizations
        const sampleOrgs = await prisma.organization.findMany({
            take: 5,
        });

        console.log(`\n\n🏢 Sample Organizations:`);
        sampleOrgs.forEach((org: any, i: number) => {
            console.log(`\n${i + 1}. ${org.name}`);
            console.log(`   Emails: ${JSON.stringify(org.emails)}`);
        });

        // Count totals
        const totalPersons = await prisma.person.count();
        const totalOrgs = await prisma.organization.count();
        const personsEmailCount = await prisma.personEmail.count();

        console.log(`\n\n📊 Summary:`);
        console.log(`   Total Persons: ${totalPersons}`);
        console.log(`   Total Organizations: ${totalOrgs}`);
        console.log(`   PersonEmail records: ${personsEmailCount}`);

        if (personsEmailCount === 0) {
            console.log(`\n❌ No PersonEmail records found!`);
            console.log(`📌 This means emails need to be populated from the import`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkEmails();
