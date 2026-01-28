
// @ts-nocheck
import Database from 'better-sqlite3';
import { DealModel } from './src/modules/pipelines/models/Deal';
import { PipelineModel } from './src/modules/pipelines/models/Pipeline';
import { PipelineStageModel } from './src/modules/pipelines/models/PipelineStage';
import { DealHistoryModel } from './src/modules/pipelines/models/DealHistory';
import { DealService } from './src/modules/pipelines/services/dealService';
import { ProductModel } from './src/modules/pipelines/models/Product';
import { OrganizationModel } from './src/modules/management/organisations/models/Organization';
import { PersonModel } from './src/modules/management/persons/models/Person';
import { LabelModel } from './src/modules/pipelines/models/Label';

async function verifyArchiving() {
    const db = new Database(':memory:');

    // Initialize models
    const dealModel = new DealModel(db);
    const pipelineModel = new PipelineModel(db);
    const stageModel = new PipelineStageModel(db);
    const historyModel = new DealHistoryModel(db);
    const productModel = new ProductModel(db);
    const organizationModel = new OrganizationModel(db);
    const personModel = new PersonModel(db);
    const labelModel = new LabelModel(db);

    // Create tables
    db.exec(`
        CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT);
        INSERT INTO users (id, email) VALUES (1, 'test@example.com');
    `);

    pipelineModel.initialize();
    stageModel.initialize();
    dealModel.initialize();
    historyModel.initialize();
    productModel.initialize();
    organizationModel.initialize();
    personModel.initialize();
    labelModel.initialize();

    const dealService = new DealService(
        dealModel,
        historyModel,
        pipelineModel,
        stageModel,
        productModel,
        organizationModel,
        personModel,
        labelModel
    );

    console.log('Models initialized');
    console.log('dealModel has create:', typeof dealModel.create);
    console.log('dealService has createDeal:', typeof dealService.createDeal);

    console.log('--- 1. Setup ---');
    if (typeof pipelineModel.create !== 'function') throw new Error('pipelineModel.create is not a function');
    const pipeline = pipelineModel.create({ name: 'Test Pipeline', userId: 1 });
    const stage = stageModel.create({ name: 'Lead', pipelineId: pipeline.id, orderIndex: 0 });

    const deal1 = await dealService.createDeal(1, { title: 'Deal 1', pipelineId: pipeline.id, stageId: stage.id });
    const deal2 = await dealService.createDeal(1, { title: 'Deal 2', pipelineId: pipeline.id, stageId: stage.id });
    const deal3 = await dealService.createDeal(1, { title: 'Deal 3', pipelineId: pipeline.id, stageId: stage.id });

    console.log('Total deals created: 3');

    console.log('\n--- 2. Verify Active Deals ---');
    let activeDeals = await dealService.getDeals(1);
    console.log('Active deals count (initial):', activeDeals.deals.length);
    if (activeDeals.deals.length !== 3) throw new Error('Initial count mismatch');

    console.log('\n--- 3. Archive Deal 1 & 2 ---');
    const archiveResult = await dealService.archiveDeals([deal1.deal.id, deal2.deal.id], 1);
    console.log('Archive status:', archiveResult);

    activeDeals = await dealService.getDeals(1);
    console.log('Active deals count (after archive):', activeDeals.deals.length);
    if (activeDeals.deals.length !== 1) throw new Error('Archive failed: active deals count should be 1');
    console.log('Remaining active deal:', activeDeals.deals[0].title);

    console.log('\n--- 4. Verify Archived List ---');
    let archivedDeals = await dealService.getArchivedDeals(1);
    console.log('Archived deals count:', archivedDeals.deals.length);
    if (archivedDeals.deals.length !== 2) throw new Error('Archived list mismatch');
    console.log('Archived titles:', archivedDeals.deals.map(d => d.title).join(', '));

    console.log('\n--- 5. Unarchive Deal 1 ---');
    const unarchiveResult = await dealService.unarchiveDeals([deal1.deal.id], 1);
    console.log('Unarchive status:', unarchiveResult);

    activeDeals = await dealService.getDeals(1);
    console.log('Active deals count (after unarchive):', activeDeals.deals.length);
    if (activeDeals.deals.length !== 2) throw new Error('Unarchive failed: active deals count should be 2');

    archivedDeals = await dealService.getArchivedDeals(1);
    console.log('Archived deals count (remaining):', archivedDeals.deals.length);
    if (archivedDeals.deals.length !== 1) throw new Error('Unarchive failed: archived count should be 1');

    console.log('\n--- 6. Verify Fetch with includeArchived ---');
    const allRecent = await dealService.getDeals(1, { includeArchived: true });
    console.log('Deals with includeArchived=true:', allRecent.deals.length);
    if (allRecent.deals.length !== 3) throw new Error('includeArchived=true failed');

    console.log('\n--- 7. Verify History ---');
    const history1 = await dealService.getDealHistory(deal1.deal.id);
    console.log('Deal 1 History events:', history1.map(h => h.eventType).join(', '));
    if (!history1.some(h => h.eventType === 'deal_archived')) throw new Error('Archived event missing');
    if (!history1.some(h => h.eventType === 'deal_unarchived')) throw new Error('Unarchived event missing');

    console.log('\nSUCCESS: Deal archiving logic verified!');
    db.close();
}

verifyArchiving().catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
});
