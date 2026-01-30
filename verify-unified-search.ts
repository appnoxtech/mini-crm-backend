import Database from 'better-sqlite3';
import { AuthService } from './src/modules/auth/services/authService';
import { UserModel } from './src/modules/auth/models/User';
import { PersonModel } from './src/modules/management/persons/models/Person';

const db = new Database('data.db');
const userModel = new UserModel(db);
const personModel = new PersonModel(db);
const authService = new AuthService(userModel, personModel);

async function testSearch() {
    console.log('--- Testing Unified Search for "dev" ---');
    const resultsDev = await authService.searchByPersonName('dev');
    console.log(JSON.stringify(resultsDev, null, 2));

    console.log('\n--- Testing Unified Search for "a" ---');
    const resultsA = await authService.searchByPersonName('a');
    console.log(JSON.stringify(resultsA, null, 2));
}

testSearch().then(() => db.close()).catch(err => {
    console.error(err);
    db.close();
});
