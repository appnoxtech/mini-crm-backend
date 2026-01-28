
// @ts-nocheck
import Database from 'better-sqlite3';
import { DealModel } from './src/modules/pipelines/models/Deal';

async function test() {
    console.log('Starting simple test');
    const db = new Database(':memory:');
    const dealModel = new DealModel(db);
    console.log('DealModel instance created');
    console.log('Type of dealModel.create:', typeof dealModel.create);
    if (typeof dealModel.create === 'function') {
        console.log('SUCCESS: create is a function');
    } else {
        console.log('FAILURE: create is NOT a function');
        console.log('Keys in dealModel:', Object.getOwnPropertyNames(Object.getPrototypeOf(dealModel)));
    }
    db.close();
}

test().catch(err => {
    console.error('Test failed with error:', err);
});
