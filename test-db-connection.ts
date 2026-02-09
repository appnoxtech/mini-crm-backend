import { PrismaClient } from '@prisma/client';

// Test different password combinations
const passwords = ['postgres', 'admin', 'root', '', 'password', '123456'];

async function testConnection(password: string) {
    const connectionString = password
        ? `postgresql://postgres:${password}@localhost:5433/crm?schema=public`
        : `postgresql://postgres@localhost:5433/crm?schema=public`;

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: connectionString
            }
        }
    });

    try {
        await prisma.$connect();
        console.log(`✅ SUCCESS! Password is: "${password || '(empty)'}"`);
        console.log(`\nUpdate your .env file with:`);
        console.log(`DATABASE_URL="${connectionString}"`);
        await prisma.$disconnect();
        return true;
    } catch (error: any) {
        console.log(`❌ Failed with password: "${password || '(empty)'}"`);
        await prisma.$disconnect();
        return false;
    }
}

async function main() {
    console.log('Testing PostgreSQL connection with different passwords...\n');

    for (const password of passwords) {
        const success = await testConnection(password);
        if (success) {
            process.exit(0);
        }
    }

    console.log('\n❌ None of the common passwords worked.');
    console.log('\nPlease check your PostgreSQL installation or reset the password.');
    console.log('\nTo find your password:');
    console.log('1. Check your PostgreSQL installation notes');
    console.log('2. Look for pgAdmin 4 - it might have saved credentials');
    console.log('3. Reset the password using pg_hba.conf (see DATABASE_FIX_GUIDE.md)');
    process.exit(1);
}

main();
