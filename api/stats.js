import { supabaseRequest } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const r = await supabaseRequest('GET',
    '/rest/v1/students?select=id,enrollment_status,admission_year,department_name',
    null, false
  );

  const students = Array.isArray(r.data) ? r.data : [];
  const counts   = { active:0, graduated:0, dropped:0, transferred:0, suspended:0 };
  const years    = {};
  const depts    = new Set();

  for (const s of students) {
    const st = s.enrollment_status || 'active';
    if (counts[st] !== undefined) counts[st]++;
    if (s.admission_year) years[s.admission_year] = (years[s.admission_year]||0)+1;
    if (s.department_name) depts.add(s.department_name);
  }

  const sorted = Object.fromEntries(
    Object.entries(years).sort(([a],[b]) => b - a)
  );

  res.status(200).json({
    total:             students.length,
    active:            counts.active,
    graduated:         counts.graduated,
    dropped:           counts.dropped,
    transferred:       counts.transferred,
    suspended:         counts.suspended,
    total_departments: depts.size,
    batch_breakdown:   sorted,
    latest_batch:      Object.keys(sorted)[0] || null,
  });
}
