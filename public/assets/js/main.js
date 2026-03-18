/**
 * UniSearch BAMU Edition - Main JS
 */

const state = {
  query: '', 
  status: '', 
  department_id: '',
  admission_year: '', 
  current_year: '',
  gender: '',
  page: 1, 
  limit: 25,
  sort_by: 'full_name', 
  sort_dir: 'asc',
  total: 0, 
  totalPages: 0,
  view: localStorage.getItem('uni_view') || 'table',
  theme: localStorage.getItem('uni_theme') || 'light'
};

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadDepartments();
    loadStats();
    search();
    setupEventListeners();
});

function initTheme() {
    if (state.theme === 'dark') {
        document.body.classList.add('dark');
        document.getElementById('themeBtn').innerHTML = '<i class="fa fa-sun"></i>';
    } else {
        document.body.classList.remove('dark');
        document.getElementById('themeBtn').innerHTML = '<i class="fa fa-moon"></i>';
    }
}

function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('uni_theme', state.theme);
    initTheme();
}

/**
 * API CALLS
 */
async function loadDepartments() {
    try {
        const res = await fetch('/api/departments');
        const data = await res.json();
        const select = document.getElementById('deptFilter');
        data.departments.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = d.name;
            select.appendChild(opt);
        });
    } catch (err) { console.error('Error loading depts', err); }
}

async function loadStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        
        document.getElementById('heroTotal').textContent = data.total_students || 0;
        document.getElementById('heroActive').textContent = data.active_students || 0;
        document.getElementById('heroDepts').textContent = data.departments_count || 0;
        document.getElementById('heroBatches').textContent = data.batches?.length || 0;
    } catch (err) { console.error('Error loading stats', err); }
}

async function search() {
    showLoading(true);
    const params = new URLSearchParams({
        q: state.query,
        enrollment_status: state.status,
        department_id: state.department_id,
        admission_year: state.admission_year,
        current_year: state.current_year,
        gender: state.gender,
        page: state.page,
        limit: state.limit,
        sort_by: state.sort_by,
        sort_dir: state.sort_dir
    });

    try {
        const res = await fetch(`/api/search?${params.toString()}`);
        const data = await res.json();
        
        state.total = data.total;
        state.totalPages = data.totalPages;
        
        renderResults(data.data);
        renderPagination();
        updateToolbar();
    } catch (err) {
        console.error('Search failed', err);
        showToast('Search failed. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * RENDERING
 */
function renderResults(students) {
    const tableBody = document.getElementById('tableBody');
    const gridContainer = document.getElementById('gridContainer');
    
    tableBody.innerHTML = '';
    gridContainer.innerHTML = '';
    
    if (!students || students.length === 0) {
        showEmptyState();
        return;
    }
    
    students.forEach((s, idx) => {
        const rowNum = (state.page - 1) * state.limit + idx + 1;
        tableBody.appendChild(buildTableRow(s, rowNum));
        gridContainer.appendChild(buildGridCard(s));
    });
}

function buildTableRow(s, num) {
    const tr = document.createElement('tr');
    tr.className = 'cursor-pointer animate-fade-in';
    const initials = s.full_name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
    
    tr.innerHTML = `
        <td class="text-xs font-black text-gray-400">#${num}</td>
        <td>
            <div class="flex items-center gap-3">
                <div class="avatar">${initials}</div>
                <div>
                    <div class="font-bold text-navy">${s.full_name}</div>
                    <div class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">${s.email || 'NO EMAIL'}</div>
                </div>
            </div>
        </td>
        <td><code class="text-[10px] font-bold bg-gray-50 border border-gray-100 px-2 py-1 rounded text-gray-500">${s.student_id}</code></td>
        <td class="text-xs font-bold text-gray-600">${s.department_name || 'N/A'}</td>
        <td><span class="batch-badge">${s.batch}</span></td>
        <td><div class="text-[11px] font-bold text-navy truncate max-w-[120px]">${s.academic_year_label}</div></td>
        <td><span class="badge badge-${s.enrollment_status}">${s.enrollment_status}</span></td>
        <td>
           <div class="flex gap-1" onclick="event.stopPropagation()">
              <button onclick="openModal('${s.id}')" class="btn btn-icon btn-sm" title="View details"><i class="fa fa-eye"></i></button>
              <button onclick="copyToClipboard('${s.student_id}')" class="btn btn-icon btn-sm" title="Copy ID"><i class="fa fa-copy"></i></button>
           </div>
        </td>
    `;
    tr.onclick = () => openModal(s.id);
    return tr;
}

function buildGridCard(s) {
    const div = document.createElement('div');
    div.className = 'student-card animate-fade-in';
    div.onclick = () => openModal(s.id);
    const initials = s.full_name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();

    div.innerHTML = `
        <div class="flex justify-between items-start mb-6">
           <div class="avatar w-12 h-12 text-sm">${initials}</div>
           <span class="badge badge-${s.enrollment_status}">${s.enrollment_status}</span>
        </div>
        <h4 class="font-bold text-navy leading-tight mb-1">${s.full_name}</h4>
        <p class="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-4">${s.student_id}</p>
        
        <div class="space-y-3 pt-4 border-t border-gray-50 text-[11px]">
           <div class="flex justify-between items-center"><span class="text-gray-400 font-bold uppercase">Department</span><span class="font-bold text-navy">${s.department_name}</span></div>
           <div class="flex justify-between items-center"><span class="text-gray-400 font-bold uppercase">Batch</span><span class="batch-badge">${s.batch}</span></div>
           <div class="flex justify-between items-center"><span class="text-gray-400 font-bold uppercase">Latest CGPA</span><span class="font-bold text-emerald-500">${s.latest_cgpa || 'N/A'}</span></div>
        </div>
        
        <div class="cgpa-bar"><div class="cgpa-fill" style="width: ${(s.latest_cgpa || 0) * 10}%"></div></div>
    `;
    return div;
}

function renderPagination() {
    const area = document.getElementById('pageBtns');
    area.innerHTML = '';
    if (state.totalPages <= 1) return;

    for (let i = 1; i <= state.totalPages; i++) {
        if (i === 1 || i === state.totalPages || (i >= state.page - 2 && i <= state.page + 2)) {
            const btn = document.createElement('button');
            btn.className = `page-btn ${i === state.page ? 'active' : ''}`;
            btn.textContent = i;
            btn.onclick = () => { state.page = i; search(); window.scrollTo({top: 400, behavior: 'smooth'}); };
            area.appendChild(btn);
        } else if (i === state.page - 3 || i === state.page + 3) {
            const dot = document.createElement('span');
            dot.className = 'px-2 py-1.5 text-gray-400';
            dot.textContent = '...';
            area.appendChild(dot);
        }
    }
}

function updateToolbar() {
    const from = state.total === 0 ? 0 : (state.page - 1) * state.limit + 1;
    const to = Math.min(from + state.limit - 1, state.total);
    document.getElementById('resultsFrom').textContent = from;
    document.getElementById('resultsTo').textContent = to;
    document.getElementById('resultsTotal').textContent = state.total;
    
    document.getElementById('clearFiltersBtn').classList.toggle('hidden', !state.query && !state.status && !state.department_id && !state.admission_year && !state.current_year);
}

function toggleSort(col) {
    if (state.sort_by === col) {
        state.sort_dir = state.sort_dir === 'asc' ? 'desc' : 'asc';
    } else {
        state.sort_by = col;
        state.sort_dir = 'asc';
    }
    search();
}

/**
 * MODAL
 */
async function openModal(id) {
    const modal = document.getElementById('studentModal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTab('overview');
    
    try {
        const res = await fetch(`/api/student?id=${id}`);
        const s = await res.json();
        
        document.getElementById('modalAvatar').textContent = s.full_name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
        document.getElementById('modalName').textContent = s.full_name;
        document.getElementById('modalMeta').innerHTML = `
           <span class="badge badge-${s.enrollment_status}">${s.enrollment_status}</span>
           <span class="batch-badge">${s.batch}</span>
           <span class="text-[11px] font-bold text-white/70 tracking-widest uppercase ml-3">${s.student_id}</span>
        `;

        renderOverviewTab(s);
        renderSemestersTab(s.semesters);
        renderContactTab(s);
    } catch (e) { showToast('Failed to load details', 'error'); closeModal(); }
}

function renderOverviewTab(s) {
    const tab = document.getElementById('tabOverview');
    tab.innerHTML = `
        <div class="grid grid-cols-2 gap-8 animate-fade-in">
           <div>
              <label class="text-[10px] font-black uppercase text-gray-400 tracking-widest">Department</label>
              <div class="font-bold text-navy flex items-center gap-2">${s.department_name} <i class="fa fa-building text-[10px] text-gray-200"></i></div>
              
              <div class="mt-6">
                 <label class="text-[10px] font-black uppercase text-gray-400 tracking-widest">Academic Year</label>
                 <div class="font-bold text-navy">${s.academic_year_label}</div>
              </div>
              <div class="mt-6">
                 <label class="text-[10px] font-black uppercase text-gray-400 tracking-widest">Admission Range</label>
                 <div class="font-bold text-navy">${s.admission_year} <i class="fa fa-arrow-right text-[10px] mx-1 text-gray-300"></i> ${s.graduation_year || 'Ongoing'}</div>
              </div>
           </div>
           <div>
              <label class="text-[10px] font-black uppercase text-gray-400 tracking-widest">Latest Performance</label>
              <div class="text-2xl font-black text-emerald-500">${s.latest_cgpa || '0.00'}<span class="text-xs font-bold text-gray-400 ml-1 italic">/ 10.0</span></div>
              <div class="cgpa-bar mt-2"><div class="cgpa-fill" style="width: ${(s.latest_cgpa || 0) * 10}%"></div></div>
              
              <div class="mt-6 grid grid-cols-2 gap-4">
                 <div><label class="text-[10px] font-black uppercase text-gray-400 tracking-widest">Gender</label><div class="font-bold text-navy">${s.gender || 'N/A'}</div></div>
                 <div><label class="text-[10px] font-black uppercase text-gray-400 tracking-widest">Blood Group</label><div class="font-bold text-orange">${s.blood_group || 'N/A'}</div></div>
              </div>
           </div>
        </div>
    `;
}

function renderSemestersTab(sems) {
    const tab = document.getElementById('tabSemesters');
    if (!sems || sems.length === 0) {
        tab.innerHTML = `<div class="py-12 text-center text-gray-300 font-bold uppercase tracking-widest text-xs">No records found for this student.</div>`;
        return;
    }
    let html = `<div class="sem-grid animate-fade-in">`;
    sems.forEach(sem => {
        html += `
           <div class="sem-block ${sem.result}">
              <div class="flex justify-between items-center mb-4">
                 <span class="text-[10px] font-black text-gray-300 uppercase tracking-widest">Sem ${sem.semester_number}</span>
                 <span class="text-[9px] font-bold text-navy bg-white/50 px-2 py-0.5 rounded border border-gray-100">${sem.academic_year}</span>
              </div>
              <div class="flex justify-between items-end">
                 <div><div class="text-[10px] text-gray-400 font-bold uppercase">SGPA</div><div class="text-sm font-black text-navy">${sem.sgpa}</div></div>
                 <div><div class="text-[10px] text-gray-400 font-bold uppercase">CGPA</div><div class="text-sm font-black text-orange">${sem.cgpa}</div></div>
              </div>
              <div class="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                 <span class="text-[9px] font-black uppercase text-${sem.result === 'pass' ? 'emerald' : 'rose'}-500">${sem.result}</span>
                 <span class="text-[9px] font-bold text-gray-400">${sem.attendance_pct}% Att.</span>
              </div>
           </div>
        `;
    });
    html += `</div>`;
    tab.innerHTML = html;
}

function renderContactTab(s) {
    const tab = document.getElementById('tabContact');
    tab.innerHTML = `
        <div class="space-y-6 animate-fade-in">
           <div class="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div class="w-10 h-10 bg-navy text-white rounded-lg flex items-center justify-center"><i class="fa fa-envelope"></i></div>
              <div><label class="text-[10px] font-black uppercase text-gray-400 tracking-widest">Email Address</label><div class="font-bold text-navy truncate">${s.email || 'N/A'}</div></div>
              <button onclick="copyToClipboard('${s.email}')" class="ml-auto btn btn-icon btn-sm"><i class="fa fa-copy"></i></button>
           </div>
           <div class="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div class="w-10 h-10 bg-blue-500 text-white rounded-lg flex items-center justify-center"><i class="fa fa-phone"></i></div>
              <div><label class="text-[10px] font-black uppercase text-gray-400 tracking-widest">Phone Number</label><div class="font-bold text-navy">${s.phone_number || 'N/A'}</div></div>
              <button onclick="copyToClipboard('${s.phone_number}')" class="ml-auto btn btn-icon btn-sm"><i class="fa fa-copy"></i></button>
           </div>
           <div class="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div class="w-10 h-10 bg-orange text-white rounded-lg flex items-center justify-center"><i class="fa fa-home"></i></div>
              <div><label class="text-[10px] font-black uppercase text-gray-400 tracking-widest">Home Address</label><div class="font-bold text-navy text-xs">${s.address || 'N/A'}</div></div>
           </div>
        </div>
    `;
}

function setTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.innerText.toLowerCase().includes(tab)));
    document.getElementById('tabOverview').style.display = tab === 'overview' ? 'block' : 'none';
    document.getElementById('tabSemesters').style.display = tab === 'semesters' ? 'block' : 'none';
    document.getElementById('tabContact').style.display = tab === 'contact' ? 'block' : 'none';
}

function closeModal() {
    document.getElementById('studentModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

/**
 * HANDLERS
 */
function setStatus(el, val) {
    document.querySelectorAll('[data-status]').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    state.status = val;
    state.page = 1;
    search();
}

function setYear(el, val) {
    document.querySelectorAll('[data-year]').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    state.current_year = val;
    state.page = 1;
    search();
}

function setGender(el, val) {
    document.querySelectorAll('[data-gender]').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    state.gender = val;
    state.page = 1;
    search();
}

function clearFilters() {
    state.query = ''; state.status = ''; state.department_id = '';
    state.admission_year = ''; state.current_year = ''; state.gender = '';
    state.page = 1;
    
    document.getElementById('searchInput').value = '';
    document.getElementById('deptFilter').value = '';
    document.getElementById('admYearFilter').value = '';
    
    document.querySelectorAll('.status-pill').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-status=""]').classList.add('active');
    document.querySelector('[data-year=""]').classList.add('active');
    document.querySelector('[data-gender=""]').classList.add('active');
    
    search();
}

function quickSearch(t) {
    document.getElementById('searchInput').value = t;
    state.query = t;
    state.page = 1;
    search();
    window.scrollTo({top: 400, behavior: 'smooth'});
}

function setView(v) {
    state.view = v;
    localStorage.setItem('uni_view', v);
    document.getElementById('tableView').style.display = v === 'table' ? 'block' : 'none';
    document.getElementById('gridView').style.display = v === 'grid' ? 'block' : 'none';
    
    document.getElementById('viewTableBtn').style.background = v === 'table' ? 'var(--navy)' : '';
    document.getElementById('viewTableBtn').style.color = v === 'table' ? 'white' : '';
    document.getElementById('viewGridBtn').style.background = v === 'grid' ? 'var(--navy)' : '';
    document.getElementById('viewGridBtn').style.color = v === 'grid' ? 'white' : '';
}

/**
 * UTILS
 */
function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', (e) => {
        state.query = e.target.value;
        state.page = 1;
        clearTimeout(window.searchTimer);
        window.searchTimer = setTimeout(() => {
            search();
            handleAutocomplete(state.query);
        }, 400);
    });

    document.getElementById('deptFilter').onchange = (e) => { state.department_id = e.target.value; state.page = 1; search(); };
    document.getElementById('admYearFilter').onchange = (e) => { state.admission_year = e.target.value; state.page = 1; search(); };
}

async function handleAutocomplete(q) {
  const dd = document.getElementById('autocompleteDropdown');
  if (q.length < 2) { dd.classList.add('hidden'); return; }
  try {
     const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(q)}`);
     const data = await res.json();
     if (!data.suggestions?.length) { dd.classList.add('hidden'); return; }
     dd.innerHTML = data.suggestions.map(s => `
        <div class="autocomplete-item" onclick="quickSearch('${s}');document.getElementById('autocompleteDropdown').classList.add('hidden')">
           <i class="fa fa-search text-gray-300"></i> ${s}
        </div>
     `).join('');
     dd.classList.remove('hidden');
  } catch(e) { dd.classList.add('hidden'); }
}

function showLoading(s) {
    // Basic loading placeholder or indicator if needed. 
    // Usually immediate enough for now.
}

function showEmptyState() {
    document.getElementById('tableBody').innerHTML = `
        <tr><td colspan="8" style="text-align:center;padding:60px 20px">
           <img src="http://bamu.ac.in/images/logo.png" style="height:60px;opacity:0.15;display:block;margin:0 auto 12px">
           <div style="color:var(--text-m);font-size:0.95rem">No students found matching your search.</div>
           <button onclick="clearFilters()" class="btn btn-outline btn-sm" style="margin-top:12px">Clear Filters</button>
        </td></tr>
    `;
    document.getElementById('gridContainer').innerHTML = '';
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!', 'success'));
}

function showToast(msg, type='success') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="fa fa-${type==='success'?'check-circle':'exclamation-circle'}"></i> <span>${msg}</span>`;
    document.body.appendChild(t);
    setTimeout(() => t.style.opacity = '0', 3000);
    setTimeout(() => t.remove(), 3400);
}

function handleBackdropClick(e) { if (e.target.id === 'studentModal') closeModal(); }
