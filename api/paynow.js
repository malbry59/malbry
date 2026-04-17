// /api/paynow.js — Vercel serverless function
// Initiates EcoCash payment via Paynow

const https = require(‘https’);
const qs = require(‘querystring’);
const crypto = require(‘crypto’);

function buildHash(fields, key) {
const values = Object.values(fields).join(’’);
return crypto.createHash(‘md5’).update(values + key).digest(‘hex’).toUpperCase();
}

module.exports = async function handler(req, res) {
// CORS
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);
if (req.method === ‘OPTIONS’) return res.status(200).end();
if (req.method !== ‘POST’) return res.status(405).json({ error: ‘Method not allowed’ });

try {
// Vercel parses JSON body automatically when Content-Type is application/json
const body = req.body || {};
const { phone, amount, reference, artistName } = body;

```
if (!phone) return res.status(400).json({ success: false, error: 'phone is required' });
if (!amount) return res.status(400).json({ success: false, error: 'amount is required' });

const PAYNOW_ID = process.env.PAYNOW_ID;
const PAYNOW_KEY = process.env.PAYNOW_KEY;

if (!PAYNOW_ID || !PAYNOW_KEY) {
  return res.status(500).json({ success: false, error: 'Paynow not configured. Add PAYNOW_ID and PAYNOW_KEY in Vercel settings.' });
}

const cleanPhone = String(phone).replace(/[\s\-+]/g, '');
const amountStr = parseFloat(amount).toFixed(2);

const fields = {
  id: PAYNOW_ID,
  reference: reference || ('mbry-' + Date.now()),
  amount: amountStr,
  additionalinfo: 'Malbry tip' + (artistName ? ' for ' + artistName : ''),
  authemail: cleanPhone + '@malbry.app',
  phone: cleanPhone,
  method: 'ecocash',
  returnurl: 'https://malbry.vercel.app',
  resulturl: 'https://malbry.vercel.app/api/paynow-result',
  status: 'Message',
};

fields.hash = buildHash(fields, PAYNOW_KEY);
const postBody = qs.stringify(fields);

const result = await new Promise((resolve, reject) => {
  const options = {
    hostname: 'www.paynow.co.zw',
    path: '/interface/remotetransaction',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postBody),
    },
    timeout: 15000,
  };
  const request = https.request(options, (response) => {
    let data = '';
    response.on('data', (chunk) => { data += chunk; });
    response.on('end', () => { resolve(qs.parse(data)); });
  });
  request.on('error', reject);
  request.on('timeout', () => { request.destroy(); reject(new Error('Paynow request timed out')); });
  request.write(postBody);
  request.end();
});

if (result.status && result.status.toLowerCase() === 'ok') {
  return res.status(200).json({
    success: true,
    pollUrl: result.pollurl,
    instructions: result.instructions || 'Check your phone and approve the EcoCash payment.',
  });
}

return res.status(400).json({
  success: false,
  error: result.error || ('Payment failed: ' + (result.status || 'unknown')),
});
```

} catch (err) {
console.error(‘Paynow handler error:’, err);
return res.status(500).json({ success: false, error: ’Internal server error: ’ + err.message });
}
};