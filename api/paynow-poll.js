const https = require(‘https’);
const qs = require(‘querystring’);

module.exports = async (req, res) => {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST,OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);
if (req.method === ‘OPTIONS’) return res.status(200).end();
try {
const { pollUrl } = req.body || {};
if (!pollUrl) return res.status(400).json({ error: ‘pollUrl required’ });
const url = new URL(pollUrl);
const result = await new Promise((resolve, reject) => {
const r = https.request({ hostname: url.hostname, path: url.pathname + url.search, method: ‘GET’ }, resp => {
let d = ‘’;
resp.on(‘data’, c => d += c);
resp.on(‘end’, () => resolve(qs.parse(d)));
});
r.on(‘error’, reject);
r.end();
});
const paid = result.status && result.status.toLowerCase() === ‘paid’;
return res.status(200).json({ paid, status: result.status || ‘unknown’, amount: result.amount });
} catch (err) {
return res.status(500).json({ error: ‘Poll failed’ });
}
};