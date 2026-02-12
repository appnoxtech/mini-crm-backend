/**
 * Import People from Pipedrive CSV with Email Addresses
 * 
 * This script imports people from Pipedrive and stores their email addresses
 * so that email-deal linking can work properly.
 * 
 * Usage:
 *   npx ts-node scripts/importPeopleWithEmails.ts <path-to-people-csv>
 */

import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PipedrivePerson {
    ID: string;
    Name: string;
    'First name': string;
    'Last name': string;
    'Email - Work': string;
    'Email - Home': string;
    'Email - Other': string;
    'Phone - Work': string;
    'Phone - Home': string;
    'Phone - Mobile': string;
    'Phone - Other': string;
    Organization: string;
    'Organization ID': string;
    [key: string]: string;
}

interface ImportStats {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    errors: Array<{ row: number; name: string; error: string }>;
}

async function importPerson(
    record: PipedrivePerson,
    rowNumber: number,
    stats: ImportStats
): Promise<void> {
    try {
        const firstName = record['First name']?.trim() || record.Name?.trim().split(/\s+/)[0] || '';
        const lastName = record['Last name']?.trim() || record.Name?.trim().split(/\s+/).slice(1).join(' ') || '';

        if (!firstName && !lastName) {
            stats.failed++;
            stats.errors.push({
                row: rowNumber,
                name: '(empty)',
                error: 'Person name is required'
            });
            return;
        }

        // Extract emails
        const emails: Array<{ email: string; label: string }> = [];
        const seenEmails = new Set<string>();

        const addEmail = (emailStr: string | undefined, label: 'work' | 'home' | 'other') => {
            if (!emailStr || !emailStr.trim()) return;
            
            const email = emailStr.trim().toLowerCase();
            if (email.includes('@') && !seenEmails.has(email)) {
                emails.push({ email, label });
                seenEmails.add(email);
            }
        };

        addEmail(record['Email - Work'], 'work');
        addEmail(record['Email - Home'], 'home');
        addEmail(record['Email - Other'], 'other');

        // Extract phones
        const phones: Array<{ phone: string; label: string }> = [];
        const seenPhones = new Set<string>();

        const addPhone = (phoneStr: string | undefined, label: 'work' | 'home' | 'mobile' | 'other') => {
            if (!phoneStr || !phoneStr.trim()) return;
            
            const phone = phoneStr.trim();
            if (!seenPhones.has(phone)) {
                phones.push({ phone, label });
                seenPhones.add(phone);
            }
        };

        addPhone(record['Phone - Work'], 'work');
        addPhone(record['Phone - Home'], 'home');
        addPhone(record['Phone - Mobile'], 'mobile');
        addPhone(record['Phone - Other'], 'other');

        // Check if person already exists
        const existing = await prisma.person.findFirst({
            where: {
                AND: [
                    { firstName: { equals: firstName, mode: 'insensitive' } },
                    { lastName: { equals: lastName, mode: 'insensitive' } }
                ]
            }
        });

        if (existing) {
            // Update existing person with emails (only if they don't have any)
            const currentEmails = existing.emails as any;
            const shouldUpdate = !currentEmails || (Array.isArray(currentEmails) && currentEmails.length === 0);
            
            if (shouldUpdate && emails.length > 0) {
                await prisma.person.update({
                    where: { id: existing.id },
                    data: {
                        emails: emails as any,
                        phones: phones.length > 0 ? (phones as any) : existing.phones
                    }
                });

                // Also create PersonEmail records for better querying
                for (const emailObj of emails) {
                    try {
                        await prisma.personEmail.create({
                            data: {
                                personId: existing.id,
                                email: emailObj.email
                            }
                        });
                    } catch (e) {
                        // Ignore duplicate errors
                    }
                }

                stats.updated++;
                console.log(`✅ Updated: ${firstName} ${lastName} (${emails.length} emails)`);
            } else {
                stats.skipped++;
            }
        } else {
            // Create new person
            const person = await prisma.person.create({
                data: {
                    firstName,
                    lastName,
                    emails: emails as any,
                    phones: phones as any
                }
            });

            // Create PersonEmail records
            for (const emailObj of emails) {
                try {
                    await prisma.personEmail.create({
                        data: {
                            personId: person.id,
                            email: emailObj.email
                        }
                    });
                } catch (e) {
                    // Ignore duplicate errors
                }
            }

            stats.created++;
            console.log(`✅ Created: ${firstName} ${lastName} (${emails.length} emails)`);
        }

    } catch (error) {
        stats.failed++;
        stats.errors.push({
            row: rowNumber,
            name: record.Name || '(unknown)',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.error(`❌ Error importing person at row ${rowNumber}:`, error);
    }
}

async function importPeopleFromCSV(filePath: string): Promise<void> {
    console.log('🚀 Starting People Import from Pipedrive CSV...\n');
    console.log(`📄 File: ${filePath}\n`);

    const stats: ImportStats = {
        total: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        errors: []
    };

    const records: PipedrivePerson[] = [];

    // Read CSV file
    await new Promise<void>((resolve, reject) => {
        createReadStream(filePath)
            .pipe(parse({
                columns: true,
                skip_empty_lines: true,
                trim: true
            }))
            .on('data', (record: PipedrivePerson) => {
                records.push(record);
            })
            .on('end', () => resolve())
            .on('error', (error) => reject(error));
    });

    console.log(`📊 Found ${records.length} people to import\n`);

    // Import people
    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        if (!record) continue;
        
        stats.total++;
        await importPerson(record, i + 1, stats);

        // Progress update every 50 records
        if (stats.total % 50 === 0) {
            console.log(`\n📈 Progress: ${stats.total}/${records.length} processed\n`);
        }
    }

    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total processed:  ${stats.total}`);
    console.log(`✅ Created:       ${stats.created}`);
    console.log(`🔄 Updated:       ${stats.updated}`);
    console.log(`⏭️  Skipped:       ${stats.skipped}`);
    console.log(`❌ Failed:        ${stats.failed}`);
    console.log('='.repeat(70));

    if (stats.errors.length > 0) {
        console.log('\n❌ ERRORS:');
        stats.errors.forEach(err => {
            console.log(`  Row ${err.row} (${err.name}): ${err.error}`);
        });
    }

    console.log('\n✅ People import complete!');
}

// Main execution
const filePath = process.argv[2];

if (!filePath) {
    console.error('❌ Error: Please provide path to Pipedrive people CSV file');
    console.log('\nUsage:');
    console.log('  npx ts-node scripts/importPeopleWithEmails.ts <path-to-people-csv>');
    console.log('\nExample:');
    console.log('  npx ts-node scripts/importPeopleWithEmails.ts uploads/imports/1770292861426_1_people_pipedrive.csv');
    process.exit(1);
}

importPeopleFromCSV(filePath)
    .catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    })
    .finally(() => {
        prisma.$disconnect();
    });
