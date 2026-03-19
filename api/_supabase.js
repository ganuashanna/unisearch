const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
export const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-32-chars-minimum';

export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
  res.setHeader('Content-Type', 'application/json');
}

export async function supabaseRequest(
  method, endpoint, body = null,
  serviceRole = false, extraHeaders = {}
) {
  const key = serviceRole ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;
  const url = SUPABASE_URL + endpoint;

  const headers = {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...extraHeaders,
  };

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  try {
    const response = await fetch(url, options);
    let data;
    const text = await response.text();
    try { data = JSON.parse(text); }
    catch { data = { raw: text }; }
    return { data, status: response.status };
  } catch (e) {
    return { data: { error: e.message }, status: 500 };
  }
}

export function addComputedFields(s) {
  const stat = s.enrollment_status || 'active';
  const adm  = s.admission_year;
  const grad = s.graduation_year;
  const yr   = s.current_year;
  const sem  = s.current_semester;
  const sfx  = ['', 'st', 'nd', 'rd'];

  s.batch_label = adm ? `${adm}–${grad ?? 'Enrolled'}` : '—';
  s.year_label  = yr  ? `${yr}${sfx[yr] || 'th'} Year` : '—';
  s.academic_year_label = {
    graduated:   `Graduated ${grad ?? ''}`,
    dropped:     `Left ${grad ?? ''}`,
    transferred: 'Transferred',
    suspended:   'Suspended',
  }[stat] ?? `${s.year_label}${sem ? ' · Sem ' + sem : ''}`;

  s.status_color = {
    active:      'emerald',
    graduated:   'indigo',
    dropped:     'rose',
    suspended:   'amber',
    transferred: 'cyan',
  }[stat] ?? 'gray';

  return s;
}

function b64u(input) {
  const str = typeof input === 'string' ? input : JSON.stringify(input);
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function b64uDecode(str) {
  return Buffer.from(
    str.replace(/-/g, '+').replace(/_/g, '/'),
    'base64'
  ).toString('utf-8');
}

export function jwtEncode(payload) {
  const { createHmac } = require('crypto');
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify(payload));
  const s = Buffer.from(
    createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest()
  ).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  return `${h}.${p}.${s}`;
}

export function jwtDecode(token) {
  try {
    const { createHmac } = require('crypto');
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const expected = Buffer.from(
      createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest()
    ).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
    if (expected !== s) return null;
    const payload = JSON.parse(b64uDecode(p));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

export function verifyAdminToken(req) {
  const auth = req.headers['authorization'] || req.headers['Authorization'] || '';
  const m = auth.match(/Bearer\s+(.+)/i);
  if (!m) return false;
  const payload = jwtDecode(m[1].trim());
  return payload !== null && payload.admin === true;
}
