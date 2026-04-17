// /api/paynow-poll.js — Vercel serverless function
// Polls Paynow for payment status

const https = require(‘https’);
const qs = require(‘querystring’);

module.exports = async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);
if (req.method === ‘OPTIONS’) return res.status(200).end();

try {
const body = req.body || {};
const { pollUrl } = body;
if (!pollUrl) return res.status(400).json({ paid: false, error: ‘pollUrl is required’ });

```
let parsedUrl;
try { parsedUrl = new URL(pollUrl); }
catch(e) { return res.status(400).json({ paid: false, error: 'Invalid pollUrl' }); }

const result = await new Promise((resolve, reject) => {
  const options = {
    hostname: parsedUrl.hostname,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET',
    timeout: 10000,
  };
  const request = https.request(options, (response) => {
    let data = '';
    response.on('data', (chunk) => { data += chunk; });
    response.on('end', () => { resolve(qs.parse(data)); });
  });
  request.on('error', reject);
  request.on('timeout', () => { request.destroy(); reject(new Error('Poll timed out')); });
  request.end();
});

const status = (result.status || '').toLowerCase();
const paid = status === 'paid';

return res.status(200).json({
  paid,
  status: result.status || 'unknown',
  amount: result.amount || null,
});
```

} catch (err) {
console.error(‘Poll error:’, err);
return res.status(500).json({ paid: false, error: ’Poll failed: ’ + err.message });
}
};