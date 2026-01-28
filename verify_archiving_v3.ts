
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

async function runTest() {
    console.log('--- STARTING VERIFICATION ---');
    try {
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

        console.log('1. Setup: Creating Pipeline, Stage, and 3 Deals');
        const p = pipelineModel.create({ name: 'Test P', userId: 1, ownerIds: [1], dealRotting: false, rottenDays: 30, isActive: true });
        console.log('Pipeline created:', p.id);
        const s = stageModel.create({ name: 'Test S', pipelineId: p.id, orderIndex: 0 });
        console.log('Stage created:', s.id);

        const d1 = await dealService.createDeal(1, { title: 'D1', pipelineId: p.id, stageId: s.id });
        console.log('D1 created:', d1.deal.id);
        const d2 = await dealService.createDeal(1, { title: 'D2', pipelineId: p.id, stageId: s.id });
        console.log('D2 created:', d2.deal.id);
        const d3 = await dealService.createDeal(1, { title: 'D3', pipelineId: p.id, stageId: s.id });
        console.log('D3 created:', d3.deal.id);

        let active = await dealService.getDeals(1);
        console.log('Active deals count:', active.deals.length);
        if (active.deals.length !== 3) throw new Error('Setup failed');

        console.log('2. Archiving D1 and D2');
        await dealService.archiveDeals([d1.deal.id, d2.deal.id], 1);

        active = await dealService.getDeals(1);
        console.log('Active deals count after archive:', active.deals.length);
        if (active.deals.length !== 1) throw new Error('Archive failed to hide deals');
        if (active.deals[0].title !== 'D3') throw new Error('Wrong deal remains');

        console.log('3. Checking Archived List');
        let archived = await dealService.getArchivedDeals(1);
        console.log('Archived deals count:', archived.deals.length);
        if (archived.deals.length !== 2) throw new Error('Archived list incorrect');

        console.log('4. Unarchiving D1');
        await dealService.unarchiveDeals([d1.deal.id], 1);

        active = await dealService.getDeals(1);
        console.log('Active deals count after unarchive:', active.deals.length);
        if (active.deals.length !== 2) throw new Error('Unarchive failed');

        console.log('5. Verification Successful!');
        db.close();
    } catch (e) {
        console.error('VERIFICATION FAILED WITH ERROR:', e);
        console.error(e.stack);
        process.exit(1);
    }
}

runTest();
