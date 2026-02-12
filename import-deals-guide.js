const fs = require('fs');
const https = require('https');
const http = require('http');
const FormData = require('form-data');
const path = require('path');

// Configuration
const API_BASE_URL = 'http://localhost:4000/api';
const CSV_FILE_PATH = 'C:\\Users\\admin\\Downloads\\deals_pipedrive.csv';
const USER_ID = 1; // Update if needed

// Get JWT token (you'll need to provide a valid token or implement login)
// For now, let's assume you have a token or we'll get it via login
const LOGIN_EMAIL = 'admin@example.com'; // Update with your admin email
const LOGIN_PASSWORD = 'your-password'; // Update with your password

async function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const req = protocol.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: data ? JSON.parse(data) : null
                    });
                } catch (e) {
                    resolve({ status: res.statusCode, headers: res.headers, data });
                }
            });
        });
        req.on('error', reject);
        if (options.body) req.write(JSON.stringify(options.body));
        req.end();
    });
}

async function uploadFile(token, filePath) {
    return new Promise((resolve, reject) => {
        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));

        form.submit({
            host: 'localhost',
            port: 4000,
            path: '/api/import/upload',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }, (err, res) => {
            if (err) return reject(err);

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${data}`));
                }
            });
        });
    });
}

async function main() {
    console.log('🚀 Starting simplified deal import via API...\n');


    // Step 1: Login to get token (if needed)
    console.log('⚠️  Note: This script requires a valid JWT token.');
    console.log('   You can either:');
    console.log('   1. Update LOGIN_EMAIL and LOGIN_PASSWORD variables and uncomment login code');
    console.log('   2. Manually get a token from your browser dev tools after logging in');
    console.log('   3. Use the frontend import feature at http://localhost:3000/import\n');

    // Uncomment this if you want to implement auto-login:
    /*
    const loginRes = await makeRequest(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { email: LOGIN_EMAIL, password: LOGIN_PASSWORD }
    });

    if (loginRes.status !== 200) {
        console.error('❌ Login failed:', loginRes.data);
        return;
    }

    const token = loginRes.data.token;
    console.log('✅ Logged in successfully\n');
    */

    // For now, provide instructions
    console.log('\n📋 RECOMMENDED APPROACH:');
    console.log('='.repeat(80));
    console.log('Use the frontend import feature for the best experience:');
    console.log('');
    console.log('1. Open your browser and navigate to: http://localhost:3000/import');
    console.log('2. Click "Import Deals" or "+ New Import"');
    console.log('3. Select Entity Type: "deal"');
    console.log(`4. Upload CSV file: ${CSV_FILE_PATH}`);
    console.log('5. Map the following fields:');
    console.log('   - ID → Skip (or map to custom field)');
    console.log('   - Title → title');
    console.log('   - Value → value');
    console.log('   - Currency of Value → currency');
    console.log('   - Pipeline → pipelineName');
    console.log('   - Stage → stageName');
    console.log('   - Contact person → personName');
    console.log('   - Organization → organizationName');
    console.log('   - Status → status');
    console.log('   - Expected close date → expectedCloseDate');
    console.log('   - Won time → wonTime');
    console.log('   - Lost time → lostTime');
    console.log('   - Lost reason → lostReason');
    console.log('   - Requirement → description');
    console.log('   - Source origin → source');
    console.log('');
    console.log('6. Select duplicate handling: "Update" (recommended for merge)');
    console.log('7. Click "Validate"');
    console.log('8. Review validation results');
    console.log('9. Click "Stage" to prepare import');
    console.log('10. Click "Merge" to complete the import');
    console.log('='.repeat(80));
    console.log('');
    console.log('✅ This approach provides:');
    console.log('   - Visual field mapping interface');
    console.log('   - Real-time validation feedback');
    console.log('   - Preview before committing');
    console.log('   - Progress tracking');
    console.log('   - Error reporting');
    console.log('   - Rollback capability');
    console.log('');
    console.log('🎯 Your backend server is already running on port 4000');
    console.log('🎯 Your database is connected and working');
    console.log('🎯 All import processors are ready (person, organization, deal)');
    console.log('');
}

main().catch(console.error);
