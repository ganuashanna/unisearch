/**
 * UniSearch Export — PDF / Excel / CSV
 * Depends on: jsPDF, jsPDF-AutoTable, SheetJS (XLSX)
 * state object is defined in main.js (loaded before this file)
 */

// ═══════════════════════════════
// FETCH ALL MATCHING STUDENTS
// ═══════════════════════════════
async function fetchAllForExport() {
  // Build query params from current state
  const params = new URLSearchParams();

  // Get values from state (defined in main.js)
  const q      = (typeof state !== 'undefined' && state.query)           ? state.query           : '';
  const status = (typeof state !== 'undefined' && state.status)          ? state.status          : '';
  const dept   = (typeof state !== 'undefined' && state.department_name) ? state.department_name : '';
  const admYr  = (typeof state !== 'undefined' && state.admission_year)  ? state.admission_year  : '';
  const curYr  = (typeof state !== 'undefined' && state.current_year)    ? state.current_year    : '';
  const gender = (typeof state !== 'undefined' && state.gender)          ? state.gender          : '';

  if (q)      params.set('q',                  q);
  if (status) params.set('enrollment_status',  status);
  if (dept)   params.set('department_name',    dept);
  if (admYr)  params.set('admission_year',     admYr);
  if (curYr)  params.set('current_year',       curYr);
  if (gender) params.set('gender',             gender);

  // Always fetch max records for export
  params.set('limit', '1000');
  params.set('page',  '1');
  params.set('sort_by',  'full_name');
  params.set('sort_dir', 'asc');

  try {
    const url = '/api/search?' + params.toString();
    console.log('Export fetch URL:', url);

    const res  = await fetch(url);
    if (!res.ok) throw new Error('API error: ' + res.status);

    const data = await res.json();
    const rows = data.data || [];
    console.log('Export fetched:', rows.length, 'records');
    return rows;
  } catch(e) {
    console.error('fetchAllForExport error:', e);
    if (typeof showToast === 'function')
      showToast('Failed to fetch data: ' + e.message, 'error');
    return [];
  }
}

// Helper: batch label
function _batchLabel(s) {
  if (!s.admission_year) return '—';
  return s.admission_year + '–' + (s.graduation_year || 'Enrolled');
}

// Helper: academic label
function _acadLabel(s) {
  const stat = s.enrollment_status || 'active';
  const yr   = s.current_year;
  const sem  = s.current_semester;
  const sfx  = ['','st','nd','rd'];
  if (stat === 'graduated')   return 'Graduated ' + (s.graduation_year || '');
  if (stat === 'dropped')     return 'Left '      + (s.graduation_year || '');
  if (stat === 'transferred') return 'Transferred';
  if (stat === 'suspended')   return 'Suspended';
  return yr ? yr + (sfx[yr]||'th') + ' Yr' + (sem ? '/S'+sem : '') : '—';
}

// ═══════════════════════════════
// PDF EXPORT
// ═══════════════════════════════
async function exportPDF() {
  // Get button and show loading
  const btn = document.querySelector('[onclick="exportPDF()"]');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML =
      '<i class="fa fa-spinner fa-spin"></i> PDF...';
  }

  try {
    const students = await fetchAllForExport();

    if (!students.length) {
      if (typeof showToast === 'function')
        showToast('No students to export', 'error');
      return;
    }

    // jsPDF loaded as window.jspdf
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'landscape',
      unit:        'mm',
      format:      'a4'
    });

    const pageW = doc.internal.pageSize.getWidth();

    // ── Header background ──
    doc.setFillColor(0, 48, 135);      // BAMU navy
    doc.rect(0, 0, pageW, 22, 'F');

    // ── Orange accent line ──
    doc.setFillColor(244, 121, 32);    // BAMU orange
    doc.rect(0, 22, pageW, 3, 'F');

    // ── Title ──
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('UniSearch Student Registry', 12, 14);

    // ── Subtitle ──
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'Dr. Babasaheb Ambedkar Marathwada University, ' +
      'Chhatrapati Sambhajinagar',
      12, 20
    );

    // ── Date + count (right side) ──
    const dateStr = new Date().toLocaleString('en-IN');
    doc.text('Generated on: ' + dateStr, pageW - 12, 12,
      { align: 'right' });
    doc.text('Filtered Records: ' + students.length,
      pageW - 12, 18, { align: 'right' });

    // ── Table ──
    const headers = [[
      '#', 'Full Name', 'Student ID',
      'Department', 'Batch', 'Year/Sem',
      'Status', 'Email'
    ]];

    const rows = students.map((s, i) => [
      String(i + 1),
      s.full_name          || '',
      s.student_id         || '',
      (s.department_name   || '—').substring(0, 22),
      _batchLabel(s),
      _acadLabel(s),
      (s.enrollment_status || 'active')
        .charAt(0).toUpperCase()
        + (s.enrollment_status || 'active').slice(1),
      (s.email             || '').toLowerCase(),
    ]);

    doc.autoTable({
      head:    headers,
      body:    rows,
      startY:  28,
      theme:   'grid',
      headStyles: {
        fillColor:  [0, 48, 135],
        textColor:  [255, 255, 255],
        fontSize:   8,
        fontStyle:  'bold',
        halign:     'center',
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [235, 242, 255]
      },
      bodyStyles: {
        fontSize:  7.5,
        textColor: [26, 26, 46],
        cellPadding: 2.5,
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8  },
        1: { cellWidth: 40 },
        2: { cellWidth: 26, halign: 'center' },
        3: { cellWidth: 42 },
        4: { cellWidth: 22, halign: 'center' },
        5: { cellWidth: 24, halign: 'center' },
        6: { cellWidth: 22, halign: 'center' },
        7: { cellWidth: 50 },
      },
      margin: { left: 8, right: 8 },
      didDrawPage: function(data) {
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(
          'Page ' + data.pageNumber + ' of ' + pageCount,
          8,
          doc.internal.pageSize.getHeight() - 5
        );
        doc.text(
          'UniSearch | Dr. BAMU Student Portal',
          pageW / 2,
          doc.internal.pageSize.getHeight() - 5,
          { align: 'center' }
        );
      }
    });

    // ── Save ──
    const date = new Date().toISOString().slice(0, 10);
    doc.save('unisearch-students-' + date + '.pdf');

    if (typeof showToast === 'function')
      showToast('PDF exported: ' + students.length +
        ' students', 'success');

  } catch(e) {
    console.error('PDF export error:', e);
    if (typeof showToast === 'function')
      showToast('PDF export failed: ' + e.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML =
        '<i class="fa fa-file-pdf" style="color:#EF4444"></i>PDF';
    }
  }
}

// ═══════════════════════════════
// EXCEL EXPORT
// ═══════════════════════════════
async function exportExcel() {
  const btn = document.querySelector('[onclick="exportExcel()"]');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML =
      '<i class="fa fa-spinner fa-spin"></i> Excel...';
  }

  try {
    const students = await fetchAllForExport();

    if (!students.length) {
      if (typeof showToast === 'function')
        showToast('No students to export', 'error');
      return;
    }

    const wb = XLSX.utils.book_new();
    const date = new Date().toLocaleDateString('en-IN');

    // ── Build sheet data ──
    const wsData = [
      // Row 1: Title (merged)
      ['UniSearch Student Export — Dr. BAMU — ' + date],
      [],  // Empty row
      // Row 3: Column headers
      [
        '#', 'Full Name', 'Student ID', 'Email',
        'Phone', 'Department', 'Admission Year',
        'Graduation Year', 'Current Year', 'Semester',
        'Status', 'Gender', 'Blood Group',
        'Date of Birth', 'Address',
        'Account No', 'Guardian', 'CGPA'
      ],
      // Data rows
      ...students.map((s, i) => [
        i + 1,
        s.full_name          || '',
        s.student_id         || '',
        s.email              || '',
        s.phone_number       || '',
        s.department_name    || '',
        s.admission_year     || '',
        s.graduation_year    || 'Enrolled',
        s.current_year       || '',
        s.current_semester   || '',
        s.enrollment_status  || '',
        s.gender             || '',
        s.blood_group        || '',
        s.date_of_birth      || '',
        s.address            || '',
        s.account_number     || '',
        s.guardian_name      || '',
        s.latest_cgpa        || '',
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Merge title row across all 18 columns
    ws['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:17} }];

    // Column widths
    ws['!cols'] = [
      {wch:5},  {wch:25}, {wch:14}, {wch:30},
      {wch:16}, {wch:24}, {wch:14}, {wch:14},
      {wch:12}, {wch:10}, {wch:14}, {wch:8},
      {wch:10}, {wch:14}, {wch:30}, {wch:12},
      {wch:20}, {wch:8},
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Students');

    // ── Summary sheet ──
    const statusCounts = {};
    students.forEach(s => {
      const st = s.enrollment_status || 'active';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    });

    const summaryData = [
      ['UniSearch Export Summary'],
      [],
      ['Total Students', students.length],
      [],
      ['Status', 'Count'],
      ...Object.entries(statusCounts).map(([k,v]) => [
        k.charAt(0).toUpperCase() + k.slice(1), v
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
    ws2['!cols'] = [{wch:20},{wch:10}];
    XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

    // Save
    const fileName = 'unisearch-students-' +
      new Date().toISOString().slice(0,10) + '.xlsx';
    XLSX.writeFile(wb, fileName);

    if (typeof showToast === 'function')
      showToast('Excel exported: ' + students.length +
        ' students', 'success');

  } catch(e) {
    console.error('Excel export error:', e);
    if (typeof showToast === 'function')
      showToast('Excel failed: ' + e.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML =
        '<i class="fa fa-file-excel" style="color:#10B981"></i>Excel';
    }
  }
}

// ═══════════════════════════════
// CSV EXPORT
// ═══════════════════════════════
function exportCSV() {
  // Build query string from state
  const params = new URLSearchParams();

  if (typeof state !== 'undefined') {
    if (state.query)          params.set('q',                 state.query);
    if (state.status)         params.set('enrollment_status', state.status);
    if (state.department_name)params.set('department_name',   state.department_name);
    if (state.admission_year) params.set('admission_year',    state.admission_year);
    if (state.current_year)   params.set('current_year',      state.current_year);
    if (state.gender)         params.set('gender',            state.gender);
  }

  const url = '/api/export?' + params.toString();

  // Trigger download via hidden link
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'unisearch-students-' +
    new Date().toISOString().slice(0,10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (typeof showToast === 'function')
    showToast('CSV download started!', 'success');
}
