export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'POST only' });

  // Read raw body manually
  let rawBody = '';
  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    rawBody = Buffer.concat(chunks).toString('utf-8');
  } catch (e) { rawBody = ''; }

  let body = {};
  try { body = rawBody ? JSON.parse(rawBody) : {}; }
  catch { body = {}; }

  const password = String(body.password || '').trim();
  const adminPwd = String(process.env.ADMIN_PASSWORD || 'admin123').trim();

  if (!password)
    return res.status(400).json({ error: 'Password is required' });

  if (password !== adminPwd) {
    await new Promise(r => setTimeout(r, 500));
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Simple JWT without external imports
  function b64u(str) {
    return Buffer.from(str).toString('base64')
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  }

  const { createHmac } = await import('crypto');
  const secret = process.env.JWT_SECRET || 'fallback-secret';
  const now = Math.floor(Date.now() / 1000);
  const header  = b64u(JSON.stringify({ alg:'HS256', typ:'JWT' }));
  const payload = b64u(JSON.stringify({ admin:true, iat:now, exp:now+86400 }));
  const sig = b64u(createHmac('sha256', secret)
    .update(`${header}.${payload}`).digest());
  const token = `${header}.${payload}.${sig}`;

  return res.status(200).json({ success: true, token });
}
