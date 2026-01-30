
// @ts-nocheck
import Database from 'better-sqlite3';
import { DealModel } from './src/modules/pipelines/models/Deal';
import { PipelineModel } from './src/modules/pipelines/models/Pipeline';

const db = new Database(':memory:');
db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY)');
db.exec('INSERT INTO users (id) VALUES (1)');
const pm = new PipelineModel(db);
pm.initialize();
const dm = new DealModel(db);
dm.initialize();

try {
    console.log('Running findByUserId...');
    const res = dm.findByUserId(1, { onlyArchived: true });
    console.log('Result:', res);
} catch (e) {
    console.error('CRASHED WITH ERROR:');
    console.error(e.message);
    console.error(e.stack);
}
