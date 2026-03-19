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

      // Clean semester data
      const clean = {
        student_id:      d.student_id      || null,
        semester_number: parseInt(d.semester_number) || null,
        academic_year:   d.academic_year   || null,
        sgpa:    d.sgpa    !== undefined && d.sgpa    !== '' ? parseFloat(d.sgpa)    : null,
        cgpa:    d.cgpa    !== undefined && d.cgpa    !== '' ? parseFloat(d.cgpa)    : null,
        attendance_pct: d.attendance_pct !== undefined && d.attendance_pct !== ''
          ? parseFloat(d.attendance_pct) : null,
        result:   d.result   || 'pending',
        backlogs: d.backlogs !== undefined ? parseInt(d.backlogs) || 0 : 0,
        remarks:  d.remarks  || null,
      };

      const r = await supabaseRequest(
        'POST',
        '/rest/v1/semesters?on_conflict=student_id,semester_number',
        clean, true,
        { Prefer: 'resolution=merge-duplicates,return=minimal' }
      );

      if (r.status >= 200 && r.status < 300)
        return res.status(200).json({ success: true });

      return res.status(400).json({
        error: r.data?.message || r.data?.error || 'Semester save failed'
      });
    }
    return res.status(400).json({ error: 'Unknown action' });
  }

  // ══════════════════════════════════════════════
  // PATH B: multipart/form-data → file import
  // ══════════════════════════════════════════════
  const boundaryMatch = ct.match(/boundary=([^\s;]+)/i);
  if (!boundaryMatch)
    return res.status(400).json({
      error: 'Expected multipart/form-data or application/json'
    });

  const boundary  = '--' + boundaryMatch[1];
  const rawStr    = raw.toString('binary');
  const parts     = rawStr.split(boundary);

  let fileBuffer = null;
  let fileName   = '';

  for (const part of parts) {
    if (!part.includes('Content-Disposition')) continue;
    if (!part.includes('filename'))            continue;
    const fnMatch = part.match(/filename="([^"]+)"/i);
    if (fnMatch) fileName = fnMatch[1];
    const sep = part.indexOf('\r\n\r\n');
    if (sep === -1) continue;
    const body = part.slice(sep + 4)
      .replace(/\r\n--$/, '')
      .replace(/--$/, '');
    fileBuffer = Buffer.from(body, 'binary');
    break;
  }

  if (!fileBuffer || !fileName)
    return res.status(400).json({ error: 'No file found in upload' });

  const ext = fileName.split('.').pop().toLowerCase();
  if (!['csv','xlsx','xls'].includes(ext))
    return res.status(400).json({
      error: 'Only CSV, XLSX, XLS files are allowed'
    });

  if (fileBuffer.length > 10 * 1024 * 1024)
    return res.status(400).json({ error: 'File too large (max 10MB)' });

  // ── Parse file ──
  let rows = [];
  if (ext === 'csv') {
    rows = parseCSV(fileBuffer.toString('utf-8'));
  } else {
    rows = parseXLSX(fileBuffer);
    if (rows.length === 0) {
      return res.status(400).json({
        error: 'Could not read XLSX file. ' +
          'Try saving as CSV (File → Save As → CSV) and re-uploading.'
      });
    }
  }

  if (rows.length === 0)
    return res.status(400).json({
      error: 'File is empty or has no readable data rows'
    });

  // ── Column aliases mapping ──
  const aliases = {
    'name':              'full_name',
    'student name':      'full_name',
    'studentname':       'full_name',
    'id':                'student_id',
    'roll no':           'student_id',
    'roll number':       'student_id',
    'rollno':            'student_id',
    'dept':              'department_name',
    'department':        'department_name',
    'phone':             'phone_number',
    'mobile':            'phone_number',
    'mobile number':     'phone_number',
    'adm year':          'admission_year',
    'admission':         'admission_year',
    'adm_year':          'admission_year',
    'year of admission': 'admission_year',
    'grad year':         'graduation_year',
    'graduation':        'graduation_year',
    'grad_year':         'graduation_year',
    'passing year':      'graduation_year',
    'year':              'current_year',
    'current yr':        'current_year',
    'sem':               'current_semester',
    'semester':          'current_semester',
    'current sem':       'current_semester',
    'status':            'enrollment_status',
    'enroll status':     'enrollment_status',
    'dob':               'date_of_birth',
    'birth date':        'date_of_birth',
    'birth_date':        'date_of_birth',
    'date of birth':     'date_of_birth',
    'acc':               'account_number',
    'account':           'account_number',
    'acc no':            'account_number',
    'guardian':          'guardian_name',
    'parent':            'guardian_name',
    'father name':       'guardian_name',
    'guardian mobile':   'guardian_phone',
    'parent phone':      'guardian_phone',
    'father phone':      'guardian_phone',
  };

  // Allowed student table columns
  const allowedCols = new Set([
    'full_name', 'student_id', 'email',
    'phone_number', 'address', 'account_number',
    'department_name', 'admission_year', 'graduation_year',
    'current_year', 'current_semester', 'enrollment_status',
    'date_of_birth', 'photo_url', 'gender',
    'blood_group', 'guardian_name', 'guardian_phone'
  ]);

  const validStatuses = [
    'active', 'graduated', 'dropped',
    'suspended', 'transferred'
  ];

  const nullValues = new Set([
    '', 'null', 'NULL', 'Null',
    'n/a', 'N/A', 'na', 'NA',
    'none', 'None', 'NONE',
    '-', '—', 'undefined'
  ]);

  const imported = [];
  const errors   = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // ── Apply column aliases ──
    const raw2 = {};
    for (const [k, v] of Object.entries(row)) {
      const keyLower = k.trim().toLowerCase();
      const mapped   = aliases[keyLower] || keyLower;
      raw2[mapped]   = typeof v === 'string' ? v.trim() : String(v ?? '').trim();
    }

    // ── Validate required fields ──
    if (!raw2.full_name || nullValues.has(raw2.full_name)) {
      errors.push(`Row ${i + 2}: full_name is required`);
      continue;
    }
    if (!raw2.student_id || nullValues.has(raw2.student_id)) {
      errors.push(`Row ${i + 2}: student_id is required`);
      continue;
    }
    if (!raw2.admission_year || nullValues.has(raw2.admission_year)) {
      errors.push(`Row ${i + 2} (${raw2.student_id}): admission_year is required`);
      continue;
    }

    // ── Type coerce numeric fields ──
    const numFields = [
      'admission_year', 'graduation_year',
      'current_year',   'current_semester'
    ];
    for (const f of numFields) {
      const val = raw2[f];
      if (!val || nullValues.has(val)) {
        raw2[f] = null;
      } else {
        const n = parseInt(String(val).trim());
        raw2[f] = isNaN(n) ? null : n;
      }
    }

    // ── Clean string fields ──
    const strFields = [
      'full_name', 'student_id', 'email',
      'phone_number', 'department_name',
      'enrollment_status', 'gender', 'blood_group',
      'date_of_birth', 'address', 'account_number',
      'guardian_name', 'guardian_phone'
    ];
    for (const f of strFields) {
      const val = raw2[f];
      if (!val || nullValues.has(val)) {
        raw2[f] = null;
      } else {
        raw2[f] = String(val).trim();
      }
    }

    // ── Fix enrollment_status ──
    if (!raw2.enrollment_status ||
        !validStatuses.includes(raw2.enrollment_status)) {
      raw2.enrollment_status = 'active';
    }

    // ── Fix date format → YYYY-MM-DD ──
    if (raw2.date_of_birth) {
      const dob = String(raw2.date_of_birth);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
        // already correct
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) {
        const [d, m, y] = dob.split('/');
        raw2.date_of_birth = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
      } else if (/^\d{2}-\d{2}-\d{4}$/.test(dob)) {
        const [d, m, y] = dob.split('-');
        raw2.date_of_birth = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
      } else {
        raw2.date_of_birth = null;
      }
    }

    // ── Only keep known columns ──
    const clean = {};
    for (const col of allowedCols) {
      if (raw2[col] !== undefined) {
        clean[col] = raw2[col];
      }
    }

    imported.push(clean);
  }

  if (imported.length === 0) {
    return res.status(400).json({
      success: false,
      imported: 0,
      total: rows.length,
      errors,
      message: 'No valid rows found to import. ' +
        'Check that full_name, student_id and admission_year are present.'
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
      true,  // use service role key
      { Prefer: 'resolution=merge-duplicates,return=minimal' }
    );

    if (r.status >= 200 && r.status < 300) {
      totalInserted += batch.length;
    } else {
      const msg = r.data?.message
        || r.data?.error
        || r.data?.details
        || JSON.stringify(r.data).slice(0, 300);

      // Report per-student errors in failed batch
      batch.forEach((student, idx) => {
        errors.push(
          `Row ${b + idx + 2} (${student.student_id}): ${msg}`
        );
      });
    }
  }

  return res.status(200).json({
    success:  true,
    imported: totalInserted,
    skipped:  rows.length - imported.length,
    total:    rows.length,
    errors,
    message:  `Imported ${totalInserted} of ${rows.length} students` +
      (errors.length ? `. ${errors.length} row(s) had errors.` : '. All rows successful!')
  });
}

// ══════════════════════════════════════
// CSV PARSER — handles quoted fields,
// Windows/Mac/Linux line endings
// ══════════════════════════════════════
function parseCSV(text) {
  // Normalize line endings
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(l => l.trim().length > 0);

  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0])
    .map(h => h.toLowerCase().trim().replace(/^"|"$/g, ''));

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitCSVLine(lines[i]);
    // Skip completely empty rows
    if (!vals.some(v => v && v.trim())) continue;
    const row = {};
    headers.forEach((h, j) => {
      row[h] = (vals[j] || '').trim().replace(/^"|"$/g, '');
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
      if (inQuote && line[i + 1] === '"') {
        cur += '"'; i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (c === ',' && !inQuote) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

// ══════════════════════════════════════
// XLSX PARSER — pure Node.js, no libs
// Uses ZipArchive + XML parsing
// ══════════════════════════════════════
function parseXLSX(buffer) {
  try {
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
      console.error('Not a valid ZIP/XLSX file');
      return [];
    }

    const files          = extractZipEntries(buffer);
    const sharedStrings  = parseSharedStrings(
      files['xl/sharedStrings.xml'] || ''
    );
    const sheet          = parseSheet(
      files['xl/worksheets/sheet1.xml'] || '',
      sharedStrings
    );
    return sheet;
  } catch(e) {
    console.error('XLSX parse error:', e.message);
    return [];
  }
}

function extractZipEntries(buffer) {
  const entries = {};
  let offset    = 0;

  while (offset < buffer.length - 30) {
    // Local file header: PK\x03\x04
    if (buffer[offset]     !== 0x50 ||
        buffer[offset + 1] !== 0x4B ||
        buffer[offset + 2] !== 0x03 ||
        buffer[offset + 3] !== 0x04) {
      offset++;
      continue;
    }

    const compression = buffer.readUInt16LE(offset + 8);
    const compSize    = buffer.readUInt32LE(offset + 18);
    const uncompSize  = buffer.readUInt32LE(offset + 22);
    const fnLen       = buffer.readUInt16LE(offset + 26);
    const extraLen    = buffer.readUInt16LE(offset + 28);
    const fileName    = buffer
      .slice(offset + 30, offset + 30 + fnLen)
      .toString('utf-8');
    const dataStart   = offset + 30 + fnLen + extraLen;

    if (compression === 0 && uncompSize > 0) {
      entries[fileName] = buffer
        .slice(dataStart, dataStart + uncompSize)
        .toString('utf-8');
    } else if (compression === 8 && compSize > 0) {
      try {
        const zlib        = require('zlib');
        const compressed  = buffer.slice(dataStart, dataStart + compSize);
        const decompressed = zlib.inflateRawSync(compressed);
        entries[fileName] = decompressed.toString('utf-8');
      } catch(e) {
        console.warn('Could not decompress:', fileName, e.message);
      }
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
    const tMatches = m[1].match(/<t[^>]*>([\s\S]*?)<\/t>/g);
    if (tMatches) {
      strings.push(
        tMatches
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
  let   headers = null;
  let   rowMatch;

  while ((rowMatch = rowReg.exec(xml)) !== null) {
    const cellContent = rowMatch[1];
    const cellReg     =
      /<c[^>]+r="([A-Z]+\d+)"[^>]*>([\s\S]*?)<\/c>/g;
    const colValues   = {};
    let   cellMatch;

    while ((cellMatch = cellReg.exec(cellContent)) !== null) {
      const ref    = cellMatch[1];
      const col    = ref.replace(/\d+/g, '');
      const inner  = cellMatch[2];
      const tAttr  = (cellMatch[0].match(/\st="([^"]+)"/) || [])[1];
      const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
      let   value  = '';

      if (vMatch) {
        const raw = vMatch[1];
        if (tAttr === 's') {
          value = sharedStrings[parseInt(raw)] || '';
        } else if (tAttr === 'b') {
          value = raw === '1' ? 'true' : 'false';
        } else {
          value = raw;
        }
      } else {
        // Inline string
        const isMatch = inner.match(/<is><t>([\s\S]*?)<\/t><\/is>/);
        if (isMatch) value = isMatch[1];
      }

      colValues[col] = value;
    }

    // Convert column letters to ordered array
    const cols   = Object.keys(colValues).sort();
    const vals   = cols.map(c => colValues[c] || '');

    if (!vals.some(v => v.trim())) continue; // skip empty rows

    if (!headers) {
      headers = vals.map(v => v.toLowerCase().trim());
    } else {
      const row = {};
      headers.forEach((h, j) => {
        row[h] = vals[j] || '';
      });
      rows.push(row);
    }
  }
  return rows;
}
