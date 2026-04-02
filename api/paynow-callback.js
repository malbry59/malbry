// /api/paynow-callback.js
// Receives Paynow result webhook and updates tip status in Supabase

export default async function handler(req, res) {
if (req.method !== ‘POST’) {
return res.status(405).send(‘Method not allowed’);
}

const body = req.body;
const PAYNOW_KEY = process.env.PAYNOW_INTEGRATION_KEY;

// Parse form-encoded body
let params = {};
if (typeof body === ‘string’) {
body.split(’&’).forEach(pair => {
const [k, v] = pair.split(’=’);
if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || ‘’);
});
} else {
params = body;
}

const { reference, status, amount, hash, paynowreference } = params;

if (!reference || !status) {
return res.status(400).send(‘Missing fields’);
}

// Verify hash
const fields = { …params };
delete fields.hash;
const hashString = Object.values(fields).join(’’) + PAYNOW_KEY;
const expectedHash = (await sha512(hashString)).toUpperCase();

if (hash?.toUpperCase() !== expectedHash) {
console.error(‘Hash mismatch — possible spoofed callback’);
return res.status(400).send(‘Invalid hash’);
}

const isPaid = status?.toLowerCase() === ‘paid’;

try {
const { createClient } = await import(’@supabase/supabase-js’);
const sbAdmin = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_SERVICE_ROLE_KEY
);

```
const { error } = await sbAdmin
  .from('tips')
  .update({
    status: isPaid ? 'paid' : status.toLowerCase(),
    paynow_reference: paynowreference || null,
    updated_at: new Date().toISOString()
  })
  .eq('reference', reference);

if (error) {
  console.error('Supabase update error:', error);
  return res.status(500).send('DB error');
}

console.log(`Tip ${reference} updated to ${status}`);
return res.status(200).send('OK');
```

} catch (err) {
console.error(‘Callback handler error:’, err);
return res.status(500).send(‘Server error’);
}
}

async function sha512(message) {
const msgBuffer = new TextEncoder().encode(message);
const hashBuffer = await crypto.subtle.digest(‘SHA-512’, msgBuffer);
const hashArray = Array.from(new Uint8Array(hashBuffer));
return hashArray.map(b => b.toString(16).padStart(2, ‘0’)).join(’’);
}