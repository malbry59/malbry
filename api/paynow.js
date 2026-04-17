const https = require(‘https’);
const qs = require(‘querystring’);
const crypto = require(‘crypto’);

function hash(params, key) {
return crypto.createHash(‘md5’).update(Object.values(params).join(’’) + key).digest(‘hex’).toUpperCase();
}

module.exports = async (req, res) => {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST,OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);
if (req.method === ‘OPTIONS’) return res.status(200).end();
if (req.method !== ‘POST’) return res.status(405).json({ error: ‘Method not allowed’ });
try {
const { phone, amount, reference, artistName } = req.body || {};
if (!phone || !amount) return res.status(400).json({ error: ‘phone and amount required’ });
const id = process.env.PAYNOW_ID, key = process.env.PAYNOW_KEY;
if (!id || !key) return res.status(500).json({ error: ‘Paynow not configured. Add PAYNOW_ID and PAYNOW_KEY to Vercel environment variables.’ });
const fields = {
id,
reference: reference || (‘tip-’ + Date.now()),
amount: parseFloat(amount).toFixed(2),
additionalinfo: ‘Malbry tip’ + (artistName ? ’ for ’ + artistName : ‘’),
authemail: phone.replace(/\s/g,’’) + ‘@malbry.app’,
phone: phone.replace(/\s/g,’’),
method: ‘ecocash’,
returnurl: ‘https://malbry.vercel.app’,
resulturl: ‘https://malbry.vercel.app/api/paynow-result’,
status: ‘Message’,
};
fields.hash = hash(fields, key);
const body = qs.stringify(fields);
const result = await new Promise((resolve, reject) => {
const r = https.request({
hostname: ‘www.paynow.co.zw’,
path: ‘/interface/remotetransaction’,
method: ‘POST’,
headers: { ‘Content-Type’: ‘application/x-www-form-urlencoded’, ‘Content-Length’: Buffer.byteLength(body) }
}, resp => {
let d = ‘’;
resp.on(‘data’, c => d += c);
resp.on(‘end’, () => resolve(qs.parse(d)));
});
r.on(‘error’, reject);
r.write(body);
r.end();
});
if (result.status && result.status.toLowerCase() === ‘ok’) {
return res.status(200).json({ success: true, pollUrl: result.pollurl, instructions: result.instructions || ‘Check your phone and approve the EcoCash payment.’ });
}
return res.status(400).json({ success: false, error: result.error || ‘Payment initiation failed’ });
} catch (err) {
console.error(‘Paynow error:’, err);
return res.status(500).json({ error: ‘Internal server error’ });
}
};