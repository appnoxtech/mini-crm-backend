
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
    console.log('--- TESTING GET ARCHIVED DEALS (EMPTY STATE) ---');
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

        // Mock users table for foreign key if needed
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

        console.log('Testing getArchivedDeals for user 1 (should be empty)');
        let result;
        try {
            result = await dealService.getArchivedDeals(1);
            console.log('Result:', JSON.stringify(result, null, 2));
        } catch (innerError) {
            console.error('Inner Exception caught in getArchivedDeals:');
            console.error(innerError.message);
            console.error(innerError.stack);
            throw innerError;
        }

        if (result.deals.length === 0 && result.pagination.total === 0) {
            console.log('TEST PASSED: Empty state handled correctly.');
        } else {
            console.log('TEST FAILED: Result not as expected.', result);
        }

        db.close();
    } catch (e) {
        console.error('TEST CRASHED:', e);
        console.error(e.stack);
        process.exit(1);
    }
}

runTest();
