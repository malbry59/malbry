// /api/paynow.js
// Vercel serverless function — Paynow EcoCash integration

export default async function handler(req, res) {
if (req.method !== ‘POST’) {
return res.status(405).json({ error: ‘Method not allowed’ });
}

const { amount, phone, reference, info, artist_id, track_id } = req.body;

if (!amount || !phone || !reference) {
return res.status(400).json({ error: ‘Missing required fields’ });
}

const PAYNOW_ID = process.env.PAYNOW_INTEGRATION_ID;
const PAYNOW_KEY = process.env.PAYNOW_INTEGRATION_KEY;
const BASE_URL = process.env.VERCEL_URL
? ‘https://’ + process.env.VERCEL_URL
: ‘https://malbry.vercel.app’;

if (!PAYNOW_ID || !PAYNOW_KEY) {
return res.status(500).json({ error: ‘Paynow not configured’ });
}

// Build Paynow payload
const params = {
id: PAYNOW_ID,
reference: reference,
amount: Number(amount).toFixed(2),
additionalinfo: info || ‘Malbry tip’,
phone: phone,
method: ‘ecocash’,
returnurl: BASE_URL + ‘/payment-return’,
resulturl: BASE_URL + ‘/api/paynow-callback’,
status: ‘Message’
};

// Generate hash
const hashString = Object.values(params).join(’’) + PAYNOW_KEY;
const hash = await sha512(hashString);
params.hash = hash.toUpperCase();

const body = new URLSearchParams(params).toString();

try {
const paynowRes = await fetch(
‘https://www.paynow.co.zw/interface/remotetransaction’,
{
method: ‘POST’,
headers: { ‘Content-Type’: ‘application/x-www-form-urlencoded’ },
body
}
);

```
const text = await paynowRes.text();
const parsed = parsePaynowResponse(text);

if (parsed.status?.toLowerCase() === 'error') {
  return res.status(400).json({ error: parsed.error || 'Paynow error' });
}

// Store pending tip in Supabase via service role
try {
  const { createClient } = await import('@supabase/supabase-js');
  const sbAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  await sbAdmin.from('tips').insert({
    reference,
    amount: Number(amount),
    phone,
    artist_id: artist_id || null,
    track_id: track_id || null,
    status: 'pending'
  });
} catch (dbErr) {
  console.error('DB insert error:', dbErr);
  // Don't fail the request — Paynow prompt already sent
}

return res.status(200).json({
  success: true,
  instructions: parsed.instructions || 'Check your phone to approve the EcoCash payment.',
  pollurl: parsed.pollurl || null
});
```

} catch (err) {
console.error(‘Paynow fetch error:’, err);
return res.status(500).json({ error: ‘Connection error — try again’ });
}
}

function parsePaynowResponse(text) {
const result = {};
text.split(’&’).forEach(pair => {
const [k, v] = pair.split(’=’);
if (k) result[decodeURIComponent(k)] = decodeURIComponent(v || ‘’);
});
return result;
}

async function sha512(message) {
const msgBuffer = new TextEncoder().encode(message);
const hashBuffer = await crypto.subtle.digest(‘SHA-512’, msgBuffer);
const hashArray = Array.from(new Uint8Array(hashBuffer));
return hashArray.map(b => b.toString(16).padStart(2, ‘0’)).join(’’);
}