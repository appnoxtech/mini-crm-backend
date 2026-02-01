const net = require('net');
console.log('Testing connection to smtp.hostinger.com:465...');
const client = new net.Socket();
client.setTimeout(5000);
client.connect(465, 'smtp.hostinger.com', function () {
    console.log('Successfully connected to port 465');
    client.destroy();
});
client.on('data', function (data) {
    console.log('Received: ' + data);
    client.destroy();
});
client.on('error', (err) => console.log('Connection Error:', err.message));
client.on('timeout', () => {
    console.log('Connection Timed Out');
    client.destroy();
});
