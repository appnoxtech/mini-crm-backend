import Database from 'better-sqlite3';
import { DraftModel } from './src/modules/email/models/draftModel';

try {
    const db = new Database(':memory:');
    const model = new DraftModel(db);

    console.log('Checking DraftModel methods...');

    if (typeof model.createDraft === 'function') console.log('✅ createDraft exists');
    else console.error('❌ createDraft MISSING');

    if (typeof model.updateDraft === 'function') console.log('✅ updateDraft exists');
    else console.error('❌ updateDraft MISSING');

    if (typeof model.deleteDraft === 'function') console.log('✅ deleteDraft exists');
    else console.error('❌ deleteDraft MISSING');

    if (typeof model.getScheduledDraftsReadyToSend === 'function') console.log('✅ getScheduledDraftsReadyToSend exists');
    else console.error('❌ getScheduledDraftsReadyToSend MISSING');

} catch (error) {
    console.error('Error verifying structure:', error);
}
