import { supabaseRequest, verifyAdminToken } from './_supabase.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',
    'Authorization,Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'POST only' });

  // ── Auth check ──
  if (!verifyAdminToken(req))
    return res.status(401).json({ error: 'Unauthorized' });

  // ── Read raw body ──
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks);

  const ct  = req.headers['content-type'] || '';

  // ══════════════════════════════════════════════
  // PATH A: JSON body → upsert single semester
  // ══════════════════════════════════════════════
  if (ct.includes('application/json')) {
    let body = {};
    try { body = JSON.parse(raw.toString('utf-8')); } catch {}

    if (body.action === 'upsert_semester' && body.data) {
      const d = body.data;
      const r = await supabaseRequest(
        'POST',
        '/rest/v1/semesters'
        + '?on_conflict=student_id,semester_number',
        d, true,
        { Prefer: 'resolution=merge-duplicates,return=minimal' }
      );
      if (r.status >= 200 && r.status < 300)
        return res.status(200).json({ success: true });
      return res.status(400).json({
        error: r.data?.message || 'Semester save failed'
      });
    }
    return res.status(400).json({ error: 'Unknown action' });
  }

  // ══════════════════════════════════════════════
  // PATH B: multipart/form-data → CSV file import
  // ══════════════════════════════════════════════
  const boundaryMatch = ct.match(/boundary=([^\s;]+)/i);
  if (!boundaryMatch)
    return res.status(400).json({
      error: 'Expected multipart/form-data or application/json'
    });

  const boundary  = '--' + boundaryMatch[1];
  const rawString = raw.toString('binary');
  const parts     = rawString.split(boundary);

  let fileBuffer  = null;
  let fileName    = '';

  for (const part of parts) {
    if (!part.includes('Content-Disposition')) continue;
    if (!part.includes('filename')) continue;
    const fnMatch = part.match(/filename="([^"]+)"/i);
    if (fnMatch) fileName = fnMatch[1];
    const sep  = part.indexOf('\r\n\r\n');
    if (sep === -1) continue;
    const body = part.slice(sep + 4).replace(/\r\n--$/, '').replace(/--$/, '');
    fileBuffer = Buffer.from(body, 'binary');
    break;
  }

  if (!fileBuffer || !fileName)
    return res.status(400).json({ error: 'No file found in upload' });

  const ext = fileName.split('.').pop().toLowerCase();
  if (!['csv', 'xlsx', 'xls'].includes(ext))
    return res.status(400).json({
      error: 'Only CSV, XLSX, XLS files allowed'
    });

  if (fileBuffer.length > 10 * 1024 * 1024)
    return res.status(400).json({ error: 'File too large (max 10MB)' });

  // ── Parse file into rows ──
  let rows = [];
  if (ext === 'csv') {
    rows = parseCSV(fileBuffer.toString('utf-8'));
  } else {
    // XLSX: parse shared strings + sheet XML
    rows = parseXLSX(fileBuffer);
  }

  if (rows.length === 0)
    return res.status(400).json({ error: 'File is empty or unreadable' });

  // ── Column aliases ──
  const aliases = {
    'name':             'full_name',
    'student name':     'full_name',
    'id':               'student_id',
    'roll no':          'student_id',
    'roll':             'student_id',
    'dept':             'department_name',
    'department':       'department_name',
    'phone':            'phone_number',
    'mobile':           'phone_number',
    'adm year':         'admission_year',
    'admission':        'admission_year',
    'adm_year':         'admission_year',
    'grad year':        'graduation_year',
    'graduation':       'graduation_year',
    'grad_year':        'graduation_year',
    'year':             'current_year',
    'sem':              'current_semester',
    'semester':         'current_semester',
    'status':           'enrollment_status',
    'dob':              'date_of_birth',
    'birth date':       'date_of_birth',
    'birth_date':       'date_of_birth',
    'acc':              'account_number',
    'account':          'account_number',
    'guardian':         'guardian_name',
    'parent':           'guardian_name',
    'guardian mobile':  'guardian_phone',
    'parent phone':     'guardian_phone',
  };

  const validStatuses = [
    'active', 'graduated', 'dropped', 'suspended', 'transferred'
  ];

  const imported = [];
  const errors   = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Apply aliases
    const mapped = {};
    for (const [k, v] of Object.entries(row)) {
      const key = aliases[k.trim().toLowerCase()] || k.trim().toLowerCase();
      mapped[key] = typeof v === 'string' ? v.trim() : v;
    }

    // Validate required fields
    if (!mapped.full_name) {
      errors.push(`Row ${i + 2}: full_name is required`);
      continue;
    }
    if (!mapped.student_id) {
      errors.push(`Row ${i + 2}: student_id is required`);
      continue;
    }
    if (!mapped.admission_year) {
      errors.push(`Row ${i + 2}: admission_year is required`);
      continue;
    }

    // Type coerce numbers
    for (const f of [
      'admission_year', 'graduation_year',
      'current_year', 'current_semester'
    ]) {
      if (mapped[f] !== undefined && mapped[f] !== '') {
        const n = parseInt(mapped[f]);
        mapped[f] = isNaN(n) ? null : n;
      } else {
        mapped[f] = null;
      }
    }

    // Default enrollment_status
    if (!mapped.enrollment_status ||
        !validStatuses.includes(mapped.enrollment_status)) {
      mapped.enrollment_status = 'active';
    }

    // Remove empty strings → null
    for (const k of Object.keys(mapped)) {
      if (mapped[k] === '') mapped[k] = null;
    }

    // Only keep known student columns
    const allowed = [
      'full_name', 'student_id', 'email', 'phone_number',
      'address', 'account_number', 'department_name',
      'admission_year', 'graduation_year', 'current_year',
      'current_semester', 'enrollment_status', 'date_of_birth',
      'photo_url', 'gender', 'blood_group', 'guardian_name',
      'guardian_phone'
    ];
    const clean = {};
    for (const k of allowed) {
      if (mapped[k] !== undefined) clean[k] = mapped[k];
    }

    imported.push(clean);
  }

  if (imported.length === 0) {
    return res.status(400).json({
      success: false,
      imported: 0,
      errors,
      message: 'No valid rows to import'
    });
  }

  // ── Upsert to Supabase in batches of 20 ──
  let totalInserted = 0;
  const batchSize   = 20;

  for (let b = 0; b < imported.length; b += batchSize) {
    const batch = imported.slice(b, b + batchSize);
    const r = await supabaseRequest(
      'POST',
      '/rest/v1/students?on_conflict=student_id',
      batch,
      true,   // use service role key
      { Prefer: 'resolution=merge-duplicates,return=minimal' }
    );
    if (r.status >= 200 && r.status < 300) {
      totalInserted += batch.length;
    } else {
      const msg = r.data?.message || r.data?.error || JSON.stringify(r.data);
      errors.push(`Batch ${Math.floor(b / batchSize) + 1} failed: ${msg}`);
    }
  }

  return res.status(200).json({
    success:  true,
    imported: totalInserted,
    skipped:  rows.length - imported.length,
    total:    rows.length,
    errors,
    message:  `Imported ${totalInserted} of ${rows.length} students`
  });
}

// ══════════════════════════════════════
// CSV PARSER (handles quoted fields)
// ══════════════════════════════════════
function parseCSV(text) {
  const lines   = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(l => l.trim());

  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0])
    .map(h => h.toLowerCase().trim());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitCSVLine(lines[i]);
    if (!vals.some(v => v.trim())) continue; // skip blank rows
    const row = {};
    headers.forEach((h, j) => {
      row[h] = (vals[j] || '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function splitCSVLine(line) {
  const result = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (c === ',' && !inQuote) {
      result.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

// ══════════════════════════════════════
// XLSX PARSER (pure Node.js, no libs)
// ══════════════════════════════════════
function parseXLSX(buffer) {
  try {
    // Need to use dynamic import for JSZip-style parsing
    // Instead: convert buffer to base64 and use regex parsing
    const str = buffer.toString('binary');

    // Find PK signature (ZIP file)
    if (!str.startsWith('PK')) {
      return []; // Not a valid XLSX
    }

    // Parse using simple ZIP extraction
    const files = extractZipEntries(buffer);
    const sharedStrings = parseSharedStrings(
      files['xl/sharedStrings.xml'] || ''
    );
    const sheet = parseSheet(
      files['xl/worksheets/sheet1.xml'] || '',
      sharedStrings
    );
    return sheet;
  } catch (e) {
    console.error('XLSX parse error:', e);
    return [];
  }
}

function extractZipEntries(buffer) {
  const entries = {};
  let offset    = 0;

  while (offset < buffer.length - 4) {
    // Local file header signature: PK\x03\x04
    if (buffer[offset]     !== 0x50 ||
        buffer[offset + 1] !== 0x4B ||
        buffer[offset + 2] !== 0x03 ||
        buffer[offset + 3] !== 0x04) {
      offset++;
      continue;
    }

    const compression   = buffer.readUInt16LE(offset + 8);
    const compSize      = buffer.readUInt32LE(offset + 18);
    const uncompSize    = buffer.readUInt32LE(offset + 22);
    const fnLen         = buffer.readUInt16LE(offset + 26);
    const extraLen      = buffer.readUInt16LE(offset + 28);
    const fileName      = buffer
      .slice(offset + 30, offset + 30 + fnLen)
      .toString('utf-8');
    const dataStart     = offset + 30 + fnLen + extraLen;

    if (compression === 0 && uncompSize > 0) {
      // Stored (no compression)
      entries[fileName] = buffer
        .slice(dataStart, dataStart + uncompSize)
        .toString('utf-8');
    } else if (compression === 8 && compSize > 0) {
      // Deflate — use Node zlib
      try {
        const zlib      = require('zlib');
        const compressed = buffer.slice(dataStart, dataStart + compSize);
        const decompressed = zlib.inflateRawSync(compressed);
        entries[fileName] = decompressed.toString('utf-8');
      } catch {}
    }

    offset = dataStart + compSize;
  }
  return entries;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const strings = [];
  const regex   = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = regex.exec(xml)) !== null) {
    const tMatch = m[1].match(/<t[^>]*>([\s\S]*?)<\/t>/g);
    if (tMatch) {
      strings.push(
        tMatch
          .map(t => t.replace(/<[^>]+>/g, ''))
          .join('')
      );
    } else {
      strings.push('');
    }
  }
  return strings;
}

function parseSheet(xml, sharedStrings) {
  if (!xml) return [];
  const rows    = [];
  const rowReg  = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let headers   = null;
  let rowMatch;

  while ((rowMatch = rowReg.exec(xml)) !== null) {
    const cellReg = /<c[^>]*r="([A-Z]+)\d+"[^>]*>([\s\S]*?)<\/c>/g;
    const rowData = {};
    let   cellMatch;

    while ((cellMatch = cellReg.exec(rowMatch[1])) !== null) {
      const col  = cellMatch[1];
      const cell = cellMatch[2];
      const tMatch = cell.match(/t="([^"]+)"/);
      const vMatch = cell.match(/<v>([\s\S]*?)<\/v>/);
      let   value  = '';

      if (vMatch) {
        const raw = vMatch[1];
        if (tMatch && tMatch[1] === 's') {
          value = sharedStrings[parseInt(raw)] || '';
        } else {
          value = raw;
        }
      }
      rowData[col] = value;
    }

    const vals = Object.values(rowData);
    if (!vals.some(v => v)) continue; // skip empty

    if (!headers) {
      headers = vals.map(v => v.toLowerCase().trim());
    } else {
      const row = {};
      headers.forEach((h, i) => {
        row[h] = vals[i] || '';
      });
      rows.push(row);
    }
  }
  return rows;
}
