import { supabaseRequest, addComputedFields } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q       = req.query.q || '';
  const dept    = req.query.department_name || req.query.department_id || '';
  const admYear = req.query.admission_year || '';
  const curYear = req.query.current_year || '';
  const status  = req.query.enrollment_status || '';
  const gender  = req.query.gender || '';
  const page    = Math.max(1, parseInt(req.query.page) || 1);
  const limit   = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
  const sortBy  = ['full_name','student_id','admission_year','created_at']
    .includes(req.query.sort_by) ? req.query.sort_by : 'full_name';
  const sortDir = req.query.sort_dir === 'desc' ? 'desc' : 'asc';

  let qs = 'select=*';

  // Build filters
  const filters = [];
  if (q) {
    const s = encodeURIComponent(`%${q}%`);
    filters.push(`or=(full_name.ilike.${s},student_id.ilike.${s},email.ilike.${s},department_name.ilike.${s},phone_number.ilike.${s})`);
  }
  if (dept)    filters.push(`department_name=ilike.${encodeURIComponent('%'+dept+'%')}`);
  if (admYear) filters.push(`admission_year=eq.${admYear}`);
  if (curYear) filters.push(`current_year=eq.${curYear}`);
  if (status)  filters.push(`enrollment_status=eq.${status}`);
  if (gender)  filters.push(`gender=eq.${gender}`);

  if (filters.length) qs += '&' + filters.join('&');
  qs += `&order=${sortBy}.${sortDir}`;

  const from = (page - 1) * limit;
  const to   = from + limit - 1;

  // Get paginated data
  const result = await supabaseRequest(
    'GET', `/rest/v1/students?${qs}`,
    null, false,
    { 'Range': `${from}-${to}`, 'Prefer': 'count=exact' }
  );

  // Get total count
  const countResult = await supabaseRequest(
    'GET', `/rest/v1/students?${qs}&select=id`,
    null, false
  );

  const data  = Array.isArray(result.data) ? result.data.map(addComputedFields) : [];
  const total = Array.isArray(countResult.data) ? countResult.data.length : 0;

  res.status(200).json({
    data, total, page, limit,
    totalPages: Math.ceil(total / limit) || 1,
  });
}
