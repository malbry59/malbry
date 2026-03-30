export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, phone } = req.body;

  const PAYNOW_ID = process.env.PAYNOW_ID;
  const PAYNOW_KEY = process.env.PAYNOW_KEY;

  // For now just return test response
  return res.status(200).json({
    message: 'Backend working',
    amount,
    phone
  });
}