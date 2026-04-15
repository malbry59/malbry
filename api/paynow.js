// /api/paynow.js
// Vercel serverless function — keeps Paynow keys off the frontend
// Deploy: put this file at /api/paynow.js in your GitHub repo

const https = require(‘https’);
const querystring = require(‘querystring’);
const crypto = require(‘crypto’);

function generateHash(fields, key) {
const str = Object.values(fields).join(’’) + key;
return crypto.createHash(‘md5’).update(str).digest(‘hex’).toUpperCase();
}

module.exports = async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);

if (req.method === ‘OPTIONS’) return res.status(200).end();
if (req.method !== ‘POST’) return res.status(405).json({ error: ‘Method not allowed’ });

const { phone, amount, reference, artistName, trackName } = req.body;

if (!phone || !amount || !reference) {
return res.status(400).json({ error: ‘Missing required fields’ });
}

const PAYNOW_ID  = process.env.PAYNOW_ID;
const PAYNOW_KEY = process.env.PAYNOW_KEY;

if (!PAYNOW_ID || !PAYNOW_KEY) {
return res.status(500).json({ error: ‘Paynow not configured’ });
}

const fields = {
id:             PAYNOW_ID,
reference:      reference,
amount:         parseFloat(amount).toFixed(2),
additionalinfo: ’Malbry tip for ’ + (artistName || ‘artist’),
authemail:      phone + ‘@malbry.app’,
phone:          phone,
method:         ‘ecocash’,
returnurl:      ‘https://malbry.vercel.app’,
resulturl:      ‘https://malbry.vercel.app/api/confirm’,
status:         ‘Message’,
};

fields.hash = generateHash(fields, PAYNOW_KEY);

const postData = querystring.stringify(fields);

const options = {
hostname: ‘www.paynow.co.zw’,
path:     ‘/interface/remotetransaction’,
method:   ‘POST’,
headers:  {
‘Content-Type’:   ‘application/x-www-form-urlencoded’,
‘Content-Length’: Buffer.byteLength(postData),
},
};

return new Promise((resolve) => {
const request = https.request(options, (response) => {
let data = ‘’;
response.on(‘data’, (chunk) => data += chunk);
response.on(‘end’, () => {
const parsed = querystring.parse(data);
if (parsed.status && parsed.status.toLowerCase() === ‘ok’) {
res.status(200).json({
success:      true,
pollUrl:      parsed.pollurl,
instructions: parsed.instructions || ‘Check your phone and approve the EcoCash payment.’,
});
} else {
res.status(400).json({
success: false,
error:   parsed.error || ‘Payment initiation failed’,
});
}
resolve();
});
});
request.on(‘error’, (e) => {
res.status(500).json({ success: false, error: e.message });
resolve();
});
request.write(postData);
request.end();
});
};