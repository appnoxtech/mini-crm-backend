import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PipedriveDeal {
    ID: string;
    Title: string;
    Creator: string;
    Owner: string;
    Value: string;
    'Currency of Value': string;
    'Weighted value': string;
    'Currency of Weighted value': string;
    Probability: string;
    Organization: string;
    'Organization ID': string;
    Pipeline: string;
    'Contact person': string;
    'Contact person ID': string;
    Stage: string;
    Label: string;
    Status: string;
    'Deal created': string;
    'Update time': string;
    'Last stage change': string;
    'Next activity date': string;
    'Last activity date': string;
    'Won time': string;
    'Last email received': string;
    'Last email sent': string;
    'Lost time': string;
    'Deal closed on': string;
    'Lost reason': string;
    'Visible to': string;
    'Total activities': string;
    'Done activities': string;
    'Activities to do': string;
    'Email messages count': string;
    'Product quantity': string;
    'Product amount': string;
    'Expected close date': string;
    'Product name': string;
    MRR: string;
    'Currency of MRR': string;
    ARR: string;
    'Currency of ARR': string;
    ACV: string;
    'Currency of ACV': string;
    'Source origin': string;
    'Source origin ID': string;
    'Source channel': string;
    'Source channel ID': string;
    'Archive status': string;
    'Archive time': string;
    'Sequence enrollment': string;
    Requirement: string;
    'Web URL': string;
    LinkedIn: string;
    'Search Related To': string;
    Country: string;
}

interface ImportStats {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    errors: Array<{ row: number; title: string; error: string }>;
}

const DEFAULT_USER_ID = 1; // Update this to your actual user ID

async function parseDate(dateStr: string): Promise<Date | null> {
    if (!dateStr || dateStr.trim() === '') return null;
    try {
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
    } catch {
        return null;
    }
}

async function getOrCreatePipeline(
    pipelineName: string,
    userId: number
): Promise<number> {
    try {
        // Search for existing pipeline
        const existing = await prisma.pipeline.findFirst({
            where: {
                name: {
                    equals: pipelineName,
                    mode: 'insensitive'
                }
            }
        });

        if (existing) return existing.id;

        // Create new pipeline
        const pipeline = await prisma.pipeline.create({
            data: {
                name: pipelineName,
                userId,
                isDefault: false,
                isActive: true,
                dealRotting: false,
                rottenDays: 30,
                ownerIds: [userId]
            }
        });

        console.log(`✅ Created new pipeline: ${pipelineName}`);
        return pipeline.id;
    } catch (error) {
        console.error(`❌ Error creating pipeline "${pipelineName}":`, error);
        throw error;
    }
}

async function getOrCreateStage(
    pipelineId: number,
    stageName: string
): Promise<number> {
    try {
        // Search for existing stage in pipeline
        const existing = await prisma.pipelineStage.findFirst({
            where: {
                pipelineId,
                name: {
                    equals: stageName,
                    mode: 'insensitive'
                }
            }
        });

        if (existing) return existing.id;

        // Get current stages count for order
        const stagesCount = await prisma.pipelineStage.count({
            where: { pipelineId }
        });

        // Create new stage
        const stage = await prisma.pipelineStage.create({
            data: {
                pipelineId,
                name: stageName,
                orderIndex: stagesCount,
                probability: 50
            }
        });

        console.log(`✅ Created new stage: ${stageName}`);
        return stage.id;
    } catch (error) {
        console.error(`❌ Error creating stage "${stageName}":`, error);
        throw error;
    }
}

async function getOrCreatePerson(personName: string): Promise<number | null> {
    if (!personName || personName.trim() === '') return null;

    try {
        // Parse name
        const nameParts = personName.trim().split(/\s+/);
        const firstName = nameParts[0] || personName;
        const lastName = nameParts.slice(1).join(' ') || '';

        // Search for existing person
        const existing = await prisma.person.findFirst({
            where: {
                OR: [
                    {
                        AND: [
                            { firstName: { equals: firstName, mode: 'insensitive' } },
                            { lastName: { equals: lastName, mode: 'insensitive' } }
                        ]
                    },
                    {
                        firstName: {
                            equals: personName,
                            mode: 'insensitive'
                        }
                    }
                ]
            }
        });

        if (existing) return existing.id;

        // Create new person
        const person = await prisma.person.create({
            data: {
                firstName,
                lastName,
                emails: [],
                phones: []
            }
        });

        console.log(`✅ Created new person: ${personName}`);
        return person.id;
    } catch (error) {
        console.error(`❌ Error creating person "${personName}":`, error);
        return null; // Continue without person
    }
}

async function getOrCreateOrganization(orgName: string): Promise<number | null> {
    if (!orgName || orgName.trim() === '') return null;

    try {
        // Search for existing organization
        const existing = await prisma.organization.findFirst({
            where: {
                name: {
                    equals: orgName,
                    mode: 'insensitive'
                }
            }
        });

        if (existing) return existing.id;

        // Create new organization
        const org = await prisma.organization.create({
            data: {
                name: orgName
            }
        });

        console.log(`✅ Created new organization: ${orgName}`);
        return org.id;
    } catch (error) {
        console.error(`❌ Error creating organization "${orgName}":`, error);
        return null; // Continue without organization
    }
}

async function importDeal(
    record: PipedriveDeal,
    rowNumber: number,
    stats: ImportStats
): Promise<void> {
    try {
        const title = record.Title?.trim();

        if (!title) {
            stats.failed++;
            stats.errors.push({
                row: rowNumber,
                title: '(empty)',
                error: 'Deal title is required'
            });
            return;
        }

        // Parse status
        const statusStr = record.Status?.trim().toUpperCase() || 'OPEN';
        const status = ['OPEN', 'WON', 'LOST'].includes(statusStr) ? statusStr : 'OPEN';

        // Parse value
        let value = 0;
        if (record.Value && record.Value.trim() !== '') {
            const parsedValue = parseFloat(record.Value);
            if (!isNaN(parsedValue) && parsedValue >= 0) {
                value = parsedValue;
            }
        }

        // Parse probability
        let probability = 0;
        if (record.Probability && record.Probability.trim() !== '') {
            const parsedProb = parseFloat(record.Probability);
            if (!isNaN(parsedProb) && parsedProb >= 0 && parsedProb <= 100) {
                probability = parsedProb;
            }
        }

        // Get currency
        const currency = record['Currency of Value']?.trim() || 'USD';

        // Get or create pipeline and stage
        const pipelineName = record.Pipeline?.trim() || 'Default Pipeline';
        const stageName = record.Stage?.trim() || 'New';

        const pipelineId = await getOrCreatePipeline(pipelineName, DEFAULT_USER_ID);
        const stageId = await getOrCreateStage(pipelineId, stageName);

        // Get or create person
        const personId = await getOrCreatePerson(record['Contact person']);

        // Get or create organization
        const organizationId = await getOrCreateOrganization(record.Organization);

        // Parse dates
        const expectedCloseDate = await parseDate(record['Expected close date']);
        const wonTime = await parseDate(record['Won time']);
        const lostTime = await parseDate(record['Lost time']);

        const actualCloseDate = status === 'WON' ? wonTime : (status === 'LOST' ? lostTime : null);

        // Prepare deal data
        const dealData: any = {
            title,
            value,
            currency,
            pipelineId,
            stageId,
            personId,
            organizationId,
            description: record.Requirement?.trim() || null,
            expectedCloseDate,
            actualCloseDate,
            probability,
            status,
            lostReason: record['Lost reason']?.trim() || null,
            source: record['Source origin']?.trim() || 'Pipedrive Import',
            userId: DEFAULT_USER_ID,
            isVisibleToAll: true,
            isRotten: false,
            ownerIds: [DEFAULT_USER_ID],
            labelIds: [],
            email: null,
            phone: null,
            customFields: {
                pipedriveId: record.ID,
                creator: record.Creator,
                owner: record.Owner,
                totalActivities: record['Total activities'],
                emailMessagesCount: record['Email messages count'],
                webUrl: record['Web URL'],
                linkedIn: record.LinkedIn,
                searchRelatedTo: record['Search Related To'],
                country: record.Country
            }
        };

        // Check for existing deal by title
        const existingDeal = await prisma.deal.findFirst({
            where: {
                title: {
                    equals: title,
                    mode: 'insensitive'
                },
                deletedAt: null
            }
        });

        if (existingDeal) {
            // Update existing deal (merge)
            await prisma.deal.update({
                where: { id: existingDeal.id },
                data: {
                    ...dealData,
                    updatedAt: new Date()
                }
            });
            stats.updated++;
            console.log(`🔄 Row ${rowNumber}: Updated "${title}"`);
        } else {
            // Create new deal
            await prisma.deal.create({
                data: dealData
            });
            stats.created++;
            console.log(`✅ Row ${rowNumber}: Created "${title}"`);
        }

    } catch (error) {
        stats.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        stats.errors.push({
            row: rowNumber,
            title: record.Title || '(unknown)',
            error: errorMsg
        });
        console.error(`❌ Row ${rowNumber}: Failed to import "${record.Title}": ${errorMsg}`);
    }
}

async function main() {
    const CSV_PATH = 'C:\\Users\\admin\\Downloads\\deals_pipedrive.csv';

    console.log('🚀 Starting deal import with merge...\n');
    console.log(`📁 CSV File: ${CSV_PATH}`);
    console.log(`👤 User ID: ${DEFAULT_USER_ID}\n`);

    const stats: ImportStats = {
        total: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        errors: []
    };

    try {
        // Create parser
        const parser = createReadStream(CSV_PATH).pipe(
            parse({
                columns: true,
                skip_empty_lines: true,
                trim: true,
                relax_column_count: true,
                relax_quotes: true
            })
        );

        // Process each record
        let rowNumber = 1; // Start from 1 (header is row 0)

        for await (const record of parser) {
            rowNumber++;
            stats.total++;

            // Import with exception handling
            await importDeal(record as PipedriveDeal, rowNumber, stats);

            // Progress update every 50 records
            if (stats.total % 50 === 0) {
                console.log(`\n📊 Progress: ${stats.total} processed | ${stats.created} created | ${stats.updated} updated | ${stats.failed} failed\n`);
            }
        }

        // Final summary
        console.log('\n' + '='.repeat(80));
        console.log('📊 IMPORT SUMMARY');
        console.log('='.repeat(80));
        console.log(`✅ Total Processed: ${stats.total}`);
        console.log(`🆕 Created: ${stats.created}`);
        console.log(`🔄 Updated (Merged): ${stats.updated}`);
        console.log(`⏭️  Skipped: ${stats.skipped}`);
        console.log(`❌ Failed: ${stats.failed}`);
        console.log('='.repeat(80));

        if (stats.errors.length > 0) {
            console.log('\n❌ ERRORS:');
            console.log('='.repeat(80));
            stats.errors.forEach((err, index) => {
                console.log(`${index + 1}. Row ${err.row}: "${err.title}" - ${err.error}`);
            });
            console.log('='.repeat(80));
        }

        console.log('\n✅ Import completed successfully!');

    } catch (error) {
        console.error('\n💥 Fatal error during import:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
