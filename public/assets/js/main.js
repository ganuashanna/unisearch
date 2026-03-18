/**
 * UniSearch Main JS
 * Search, Filters, Modal, Theme, Rendering
 */

const state = {
    query: '', 
    status: '', 
    department_id: '',
    admission_year: '', 
    graduation_year: '',
    current_year: '', 
    current_semester: '',
    gender: '', 
    page: 1, 
    limit: 10,
    sort_by: 'full_name', 
    sort_dir: 'asc',
    total: 0, 
    totalPages: 0,
    view: localStorage.getItem('uni_view') || 'table',
    theme: localStorage.getItem('uni_theme') || 'dark'
};

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadDepartments();
    loadStats();
    search();
    setupEventListeners();
});

function initTheme() {
    if (state.theme === 'light') {
        document.documentElement.classList.add('light');
    } else {
        document.documentElement.classList.remove('light');
    }
}

function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
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
        const select = document.getElementById('filterDept');
        data.departments.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = d.name;
            select.appendChild(opt);
        });
    } catch (err) { console.error('Error loading departments', err); }
}

async function loadStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        
        // Use CountUp if available
        if (window.countUp) {
            new countUp.CountUp('statTotal', data.total_students).start();
            new countUp.CountUp('statBatches', data.batches.length).start();
            new countUp.CountUp('statDepts', data.departments_count).start();
            new countUp.CountUp('statActive', data.active_students).start();
        } else {
            document.getElementById('statTotal').textContent = data.total_students;
            document.getElementById('statBatches').textContent = data.batches.length;
            document.getElementById('statDepts').textContent = data.departments_count;
            document.getElementById('statActive').textContent = data.active_students;
        }
    } catch (err) { console.error('Error loading stats', err); }
}

async function search() {
    showLoading(true);
    const params = new URLSearchParams({
        q: state.query,
        enrollment_status: state.status,
        department_id: state.department_id,
        admission_year: state.admission_year,
        graduation_year: state.graduation_year,
        current_year: state.current_year,
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
        updateShowingText();
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
    const list = document.getElementById('studentList');
    const grid = document.getElementById('gridView');
    const empty = document.getElementById('emptyState');
    
    list.innerHTML = '';
    grid.innerHTML = '';
    
    if (!students || students.length === 0) {
        empty.classList.remove('hidden');
        document.getElementById('resultsContent').classList.add('hidden');
        return;
    }
    
    empty.classList.add('hidden');
    document.getElementById('resultsContent').classList.remove('hidden');

    students.forEach((s, idx) => {
        const row = buildStudentRow(s, (state.page - 1) * state.limit + idx + 1);
        list.appendChild(row);

        const card = buildStudentCard(s);
        grid.appendChild(card);
    });
}

function buildStudentRow(s, num) {
    const tr = document.createElement('tr');
    tr.className = 'cursor-pointer';
    tr.onclick = () => openModal(s.id);
    
    tr.innerHTML = `
        <td class="text-gray-500 font-bold text-xs">${num}</td>
        <td>
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-indigo-600/10 flex items-center justify-center text-indigo-400 font-bold text-xs border border-indigo-500/10">
                    ${s.full_name.split(' ').map(n=>n[0]).join('')}
                </div>
                <div>
                    <h5 class="font-bold text-sm leading-tight">${s.full_name}</h5>
                    <p class="text-[10px] text-gray-500 font-medium uppercase tracking-wider">${s.email || 'No email'}</p>
                </div>
            </div>
        </td>
        <td><span class="font-mono text-[11px] bg-gray-800/50 px-2 py-1 rounded text-gray-400 border border-gray-700/50">${s.student_id}</span></td>
        <td><span class="text-xs font-semibold text-indigo-200/50 capitalize">${s.department_name}</span></td>
        <td>
            <div class="flex flex-col gap-1">
                <span class="text-xs font-bold text-gray-300">Year ${s.current_year} · Sem ${s.current_semester}</span>
                <span class="batch-badge w-fit">${s.batch}</span>
            </div>
        </td>
        <td><span class="status-pill status-${s.enrollment_status}">${s.enrollment_status}</span></td>
        <td class="text-right px-6">
            <button class="w-8 h-8 rounded-lg hover:bg-indigo-600/20 text-indigo-400 transition-colors"><i class="far fa-eye"></i></button>
        </td>
    `;
    return tr;
}

function buildStudentCard(s) {
    const div = document.createElement('div');
    div.className = 'student-card glass';
    div.onclick = () => openModal(s.id);
    
    div.innerHTML = `
        <div class="flex items-start justify-between mb-6">
             <div class="w-14 h-14 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-400 font-black text-xl border border-indigo-500/10">
                ${s.full_name.split(' ').map(n=>n[0]).join('')}
             </div>
             <span class="status-pill status-${s.enrollment_status}">${s.enrollment_status}</span>
        </div>
        <h4 class="font-bold text-lg mb-1">${s.full_name}</h4>
        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-[0.15em] mb-4">${s.student_id}</p>
        
        <div class="space-y-4 pt-4 border-t border-indigo-500/10">
            <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold text-gray-500 uppercase">Department</span>
                <span class="text-xs font-bold text-indigo-300">${s.department_name}</span>
            </div>
            <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold text-gray-500 uppercase">Academic Year</span>
                <span class="text-xs font-bold text-gray-200">${s.batch}</span>
            </div>
            <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold text-gray-500 uppercase">Latest Performance</span>
                <span class="text-xs font-bold text-emerald-400">${s.cgpa_latest || 'N/A'} CGPA</span>
            </div>
        </div>
        
        <div class="cgpa-bar-track mt-6">
            <div class="cgpa-bar-fill" style="width: ${(s.cgpa_latest || 0) * 10}%"></div>
        </div>
    `;
    return div;
}

function renderPagination() {
    const container = document.getElementById('pagination');
    container.innerHTML = '';
    
    if (state.totalPages <= 1) return;

    // Prev
    const prev = buildPageBtn('<i class="fas fa-chevron-left"></i>', state.page - 1, state.page === 1);
    container.appendChild(prev);

    // Dynamic pages (simplified)
    for (let i = 1; i <= state.totalPages; i++) {
        if (i === 1 || i === state.totalPages || (i >= state.page - 1 && i <= state.page + 1)) {
            container.appendChild(buildPageBtn(i, i, false, i === state.page));
        } else if (i === state.page - 2 || i === state.page + 2) {
            const dot = document.createElement('span');
            dot.className = 'px-3 py-1.5 text-gray-600';
            dot.textContent = '...';
            container.appendChild(dot);
        }
    }

    // Next
    const next = buildPageBtn('<i class="fas fa-chevron-right"></i>', state.page + 1, state.page === state.totalPages);
    container.appendChild(next);
}

function buildPageBtn(label, target, disabled, active = false) {
    const btn = document.createElement('button');
    btn.className = `w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold transition-all 
                    ${disabled ? 'opacity-20 cursor-not-allowed' : 'hover:bg-indigo-600/20'} 
                    ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-gray-400 border border-indigo-500/10 bg-indigo-600/5'}`;
    btn.innerHTML = label;
    if (!disabled) btn.onclick = () => { state.page = target; search(); window.scrollTo({top: 0, behavior: 'smooth'}); };
    return btn;
}

function updateShowingText() {
    const from = (state.page - 1) * state.limit + 1;
    const to = Math.min(from + state.limit - 1, state.total);
    document.getElementById('showingText').textContent = state.total > 0 
        ? `Showing ${from}-${to} of ${state.total} students`
        : `Showing 0 students`;
}

/**
 * MODAL HANDLING
 */
async function openModal(id) {
    const modal = document.getElementById('studentModal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Set tabs to overview
    setActiveTab('overview');
    
    try {
        const res = await fetch(`/api/student?id=${id}`);
        const s = await res.json();
        
        // Populate header
        document.getElementById('modalAvatar').textContent = s.full_name.split(' ').map(n=>n[0]).join('');
        document.getElementById('modalName').textContent = s.full_name;
        const statusEl = document.getElementById('modalStatus');
        statusEl.className = `status-pill status-${s.enrollment_status}`;
        statusEl.textContent = s.enrollment_status;
        document.getElementById('modalID').textContent = s.student_id;
        document.getElementById('modalDept').innerHTML = `<i class="fas fa-building mr-2"></i> ${s.department_name}`;

        // Overview
        document.getElementById('mDetailedName').textContent = s.full_name;
        document.getElementById('mDetailedInfo').textContent = `${s.gender || 'N/A'} / ${s.blood_group || 'N/A'}`;
        document.getElementById('mDetailedStatus').textContent = s.enrollment_status;
        document.getElementById('mDetailedBatch').textContent = s.batch;
        document.getElementById('mDetailedCurrent').textContent = `Year ${s.current_year} · Sem ${s.current_semester}`;
        document.getElementById('mDetailedYears').textContent = `${s.admission_year} → ${s.graduation_year || 'Enrolled'}`;
        
        // Contact
        document.getElementById('mDetailedEmail').textContent = s.email || 'N/A';
        document.getElementById('mDetailedPhone').textContent = s.phone_number || 'N/A';
        document.getElementById('mDetailedAccount').textContent = s.account_number || 'N/A';
        document.getElementById('mDetailedAddress').textContent = s.address || 'N/A';
        
        // Semesters
        renderSemestersTimeline(s.semesters);
        
    } catch (err) {
        showToast('Failed to load student details.', 'error');
        closeModal();
    }
}

function renderSemestersTimeline(sems) {
    const container = document.getElementById('semTimeline');
    container.innerHTML = '';
    
    let totalCGPA = 0;

    if (!sems || sems.length === 0) {
        container.innerHTML = '<div class="col-span-full py-10 text-center text-gray-500 font-medium">No semester data recorded yet.</div>';
        document.getElementById('mCGPA').textContent = 'N/A';
        return;
    }

    sems.forEach(sem => {
        const block = document.createElement('div');
        block.className = `sem-block ${sem.result}`;
        block.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Sem ${sem.semester_number}</span>
                <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-gray-800 text-gray-400">${sem.academic_year}</span>
            </div>
            <div class="flex items-end justify-between">
                <div>
                    <p class="text-[11px] text-gray-400">Attendance</p>
                    <p class="text-sm font-bold text-white">${sem.attendance_pct}%</p>
                </div>
                <div class="text-right">
                    <p class="text-[11px] text-gray-400">SGPA</p>
                    <p class="text-sm font-bold text-indigo-400">${sem.sgpa}</p>
                </div>
            </div>
            <div class="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                 <span class="text-[9px] font-black uppercase text-${sem.result === 'pass' ? 'emerald' : 'rose'}-500">${sem.result}</span>
                 <span class="text-[10px] font-bold text-gray-500">CGPA: ${sem.cgpa}</span>
            </div>
        `;
        container.appendChild(block);
        totalCGPA = sem.cgpa; // Latest CGPA recorded
    });
    
    document.getElementById('mCGPA').textContent = totalCGPA;
}

function setActiveTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.toggle('hidden', p.id !== `${tab}Tab`);
    });
}

function closeModal() {
    document.getElementById('studentModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

/**
 * EVENT LISTENERS
 */
function setupEventListeners() {
    // Theme
    document.getElementById('themeToggle').onclick = toggleTheme;
    
    // View Switch
    document.getElementById('viewTable').onclick = () => setView('table');
    document.getElementById('viewGrid').onclick = () => setView('grid');
    
    // Search with debounce
    let searchTimeout;
    const searchInput = document.getElementById('mainSearch');
    searchInput.oninput = (e) => {
        state.query = e.target.value;
        state.page = 1;
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            search();
            handleAutocomplete(state.query);
        }, 300);
    };

    // Filter selects
    document.getElementById('filterDept').onchange = (e) => { state.department_id = e.target.value; state.page = 1; search(); };
    document.getElementById('filterBatch').onchange = (e) => { state.admission_year = e.target.value; state.page = 1; search(); };
    document.getElementById('filterGrad').onchange = (e) => { state.graduation_year = e.target.value; state.page = 1; search(); };
    document.getElementById('sortBy').onchange = (e) => { state.sort_by = e.target.value; search(); };

    // Status Pills
    document.querySelectorAll('.status-pill-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.status-pill-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.status = btn.dataset.status;
            state.page = 1;
            search();
        };
    });

    // Year Pills
    document.querySelectorAll('.year-pill').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.year-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.current_year = btn.dataset.year;
            state.page = 1;
            search();
        };
    });

    // Modal tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => setActiveTab(btn.dataset.tab);
    });

    // Close modal
    document.getElementById('closeModal').onclick = closeModal;
    window.onclick = (e) => { if (e.target.id === 'studentModal') closeModal(); };

    // Exports
    document.getElementById('exportPDF').onclick = () => window.exportManager.pdf();
    document.getElementById('exportExcel').onclick = () => window.exportManager.excel();
    document.getElementById('exportCSV').onclick = () => window.location.href = `/api/export?format=csv&${new URLSearchParams(state).toString()}`;
}

async function handleAutocomplete(q) {
    const dropdown = document.getElementById('autocompleteDropdown');
    if (q.length < 2) { dropdown.classList.add('hidden'); return; }
    
    try {
        const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        
        if (!data.suggestions || data.suggestions.length === 0) {
            dropdown.classList.add('hidden');
            return;
        }
        
        dropdown.innerHTML = '';
        data.suggestions.forEach(s => {
            const item = document.createElement('div');
            item.className = 'px-4 py-3 hover:bg-indigo-600/10 cursor-pointer text-sm transition-colors rounded-xl flex items-center gap-3';
            item.innerHTML = `<i class="fas fa-search text-gray-600 text-xs"></i> <span>${s}</span>`;
            item.onclick = () => {
                document.getElementById('mainSearch').value = s;
                state.query = s;
                dropdown.classList.add('hidden');
                search();
            };
            dropdown.appendChild(item);
        });
        dropdown.classList.remove('hidden');
    } catch (err) { dropdown.classList.add('hidden'); }
}

function setView(v) {
    state.view = v;
    localStorage.setItem('uni_view', v);
    document.getElementById('viewTable').classList.toggle('active-view', v === 'table');
    document.getElementById('viewGrid').classList.toggle('active-view', v === 'grid');
    
    document.getElementById('tableView').classList.toggle('hidden', v !== 'table');
    document.getElementById('gridView').classList.toggle('hidden', v !== 'grid');
}

function setSort(col) {
    if (state.sort_by === col) {
        state.sort_dir = state.sort_dir === 'asc' ? 'desc' : 'asc';
    } else {
        state.sort_by = col;
        state.sort_dir = 'asc';
    }
    search();
}

function showLoading(show) {
    document.getElementById('loading').classList.toggle('hidden', !show);
    document.getElementById('resultsContent').classList.toggle('hidden', show);
}

function clearFilters() {
    state.query = '';
    state.status = '';
    state.department_id = '';
    state.admission_year = '';
    state.graduation_year = '';
    state.current_year = '';
    state.page = 1;
    
    document.getElementById('mainSearch').value = '';
    document.getElementById('filterDept').value = '';
    document.getElementById('filterBatch').value = '';
    document.getElementById('filterGrad').value = '';
    document.querySelectorAll('.status-pill-btn').forEach((b,i) => b.classList.toggle('active', i===0));
    document.querySelectorAll('.year-pill').forEach((b,i) => b.classList.toggle('active', i===0));
    
    search();
}

// Global toast exposed via window in index.html, but let's redefine here safely
const showToast = window.showToast || ((msg) => console.log(msg));
