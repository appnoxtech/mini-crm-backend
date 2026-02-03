const jwt = require('jsonwebtoken');
const http = require('http');

// Config
const SECRET = 'your-secret-key-change-in-production'; // Default from authService.ts
const PORT = 4000;
const USER_ID = 1;

// Generate Token
const token = jwt.sign({ id: USER_ID, email: 'test@example.com' }, SECRET, { expiresIn: '1h' });

function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: PORT,
            path: '/api/activities' + path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log(`\n[${method} ${path}] Status: ${res.statusCode}`);
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    console.log('Response:', data);
                    resolve(data);
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function run() {
    try {
        console.log('--- Verifying Activity Scheduler API ---');

        // 1. Check Availability
        console.log('\n> Checking availability...');
        const availability = await request('POST', '/check-availability', {
            startAt: new Date(Date.now() + 3600000).toISOString(),
            endAt: new Date(Date.now() + 7200000).toISOString(),
            userIds: [USER_ID]
        });
        console.log(availability);

        // 2. Create Activity (Testing 'lunch' type and 'message' response)
        console.log('\n> Creating Activity (Type: Lunch)...');
        const createResponse = await request('POST', '/', {
            title: 'Team Lunch',
            description: 'Monthly team bonding',
            type: 'lunch',
            startAt: new Date(Date.now() + 3600000).toISOString(),
            endAt: new Date(Date.now() + 7200000).toISOString(),
            priority: 'medium',
            status: 'busy'
        });

        console.log('Response Message:', createResponse.message);

        const newActivity = createResponse.activity;
        console.log('Created ID:', newActivity?.id);
        console.log('Created Type:', newActivity?.type);

        if (!newActivity) {
            console.error('FAILED: Activity not returned in response');
            return;
        }

        // 3. List Activities
        console.log('\n> Listing Activities...');
        const list = await request('GET', '/');
        console.log(`Found ${list.total} activities`);

        // 4. Search Activities
        console.log('\n> Searching Activities (Query: "Team", Type: "lunch")...');
        const searchResults = await request('GET', '/search?query=Team&type=lunch');
        console.log(`Found ${searchResults.length} matches`);
        console.log('Match Detail:', JSON.stringify(searchResults[0], null, 2));

        console.log('\n--- Done ---');
    } catch (error) {
        console.error('Error:', error);
    }
}

run();
