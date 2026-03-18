/**
 * UniSearch BAMU Edition - Admin Dashboard JS
 */

const adminState = {
  token: localStorage.getItem('uni_admin_token'),
  activeNav: 'overview',
  activeStudent: null
};

document.addEventListener('DOMContentLoaded', () => {
    if (!adminState.token) { window.location.href = '/admin'; return; }
    
    loadDashboardStats();
    setupUploadZone();
    setupAcademicSearch();
    
    // Auto-load section from URL or default
    const hash = window.location.hash.replace('#', '');
    if (hash) switchSection(hash);
});

function logout() {
    localStorage.removeItem('uni_admin_token');
    window.location.href = '/admin';
}

/**
 * SECTION NAVIGATION
 */
function switchSection(id) {
    adminState.activeNav = id;
    document.querySelectorAll('.section-content').forEach(s => s.classList.add('hidden'));
    document.getElementById(`section_${id}`).classList.remove('hidden');
    
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.toggle('active', link.onclick.toString().includes(id));
    });

    const title = { overview: 'System Overview', import: 'Bulk Student Import', academic: 'Academic Records' }[id];
    document.getElementById('sectionTitle').textContent = title;
    
    const icon = { overview: 'fa-chart-line', import: 'fa-file-import', academic: 'fa-graduation-cap' }[id];
    document.getElementById('sectionTitleIcon').innerHTML = `<i class="fa ${icon}"></i>`;
}

/**
 * DASHBOARD OVERVIEW
 */
async function loadDashboardStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        
        document.getElementById('statTotalStudents').textContent = data.total_students || 0;
        document.getElementById('statActiveStudents').textContent = data.active_students || 0;
        document.getElementById('statDepartments').textContent = data.total_departments || 0;
        document.getElementById('statAvgCGPA').textContent = data.avg_cgpa || '0.00';
        
        renderBatchDistribution(data.batch_breakdown);
    } catch (e) {
        console.error('Stats failed', e);
        showToast('Failed to load dashboard statistics', 'error');
    }
}

function renderBatchDistribution(batches) {
    const container = document.getElementById('batchChart');
    if (!batches || Object.keys(batches).length === 0) {
        container.innerHTML = '<div class="text-center text-xs text-gray-400 py-10 font-bold uppercase tracking-widest">No data available</div>';
        return;
    }
    
    const max = Math.max(...Object.values(batches));
    let html = '';
    
    Object.entries(batches).forEach(([year, count]) => {
        const width = (count / max) * 100;
        html += `
            <div class="space-y-1 group">
                <div class="flex justify-between items-end">
                    <span class="text-[10px] font-black text-navy uppercase tracking-widest">${year} Batch</span>
                    <span class="text-[10px] font-bold text-gray-400 group-hover:text-orange transition-colors">${count} Students</span>
                </div>
                <div class="h-2 bg-gray-50 rounded-full border border-gray-100 overflow-hidden">
                    <div class="h-full bg-navy group-hover:bg-orange transition-all duration-500 rounded-full" style="width: ${width}%"></div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

/**
 * IMPORT / UPLOAD
 */
function setupUploadZone() {
    const zone = document.getElementById('dropZone');
    const input = document.getElementById('fileInput');

    input.onchange = (e) => handleFileSelection(e.target.files[0]);

    zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('drag-over'); };
    zone.ondragleave = () => zone.classList.remove('drag-over');
    zone.ondrop = (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        handleFileSelection(e.dataTransfer.files[0]);
    };
}

let activeImportFile = null;

function handleFileSelection(file) {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
        showToast('Only CSV files are supported.', 'error');
        return;
    }
    
    activeImportFile = file;
    document.getElementById('filePreview').classList.remove('hidden');
    document.getElementById('previewFileName').textContent = file.name;
    document.getElementById('previewFileSize').textContent = `${(file.size / 1024).toFixed(1)} KB`;
    document.getElementById('importProgress').classList.add('hidden');
    document.getElementById('progressFill').style.width = '0%';
}

async function doImport() {
    if (!activeImportFile) return;
    
    const btn = document.getElementById('importBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin mr-2"></i> Initializing...';
    
    document.getElementById('importProgress').classList.remove('hidden');
    const fill = document.getElementById('progressFill');
    const label = document.getElementById('progressLabel');

    const fd = new FormData();
    fd.append('file', activeImportFile);

    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminState.token}` },
            body: fd
        });
        
        const data = await res.json();
        if (res.ok && data.success) {
            fill.style.width = '100%';
            label.textContent = `Completed! ${data.imported} Students Imported Successfully.`;
            showToast(`${data.imported} records processed.`, 'success');
            setTimeout(() => { if(confirm('Refresh dashboard to see stats?')) location.reload(); }, 2000);
        } else {
            throw new Error(data.error || 'Import failed');
        }
    } catch (e) {
        showToast(e.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa fa-play mr-2"></i> Start Importing Now';
    }
}

function downloadTemplate() {
    const csvContent = "data:text/csv;charset=utf-8,full_name,student_id,email,phone_number,department_name,admission_year,graduation_year,current_year,current_semester,enrollment_status,gender,blood_group,date_of_birth,address,account_number,guardian_name,guardian_phone\r\n"
        + "Ganesh Shinde,CS2021001,ganesh.s@bamu.ac.in,9876543210,Computer Science,2021,,4,7,active,Male,A+,2003-05-15,\"Chhatrapati Sambhajinagar\",ACC12345,Mahesh Shinde,9988776655\r\n"
        + "Anjali Jadhav,MBA2023015,anjali.j@bamu.ac.in,9000011111,MBA,2023,,2,3,active,Female,B+,2002-11-20,\"Aurangabad\",ACC67890,Rahul Jadhav,9123456789";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "bamu_unisearch_template.csv");
    document.body.appendChild(link);
    link.click();
}

/**
 * ACADEMIC RECORDS
 */
function setupAcademicSearch() {
    const input = document.getElementById('studentSearchInput');
    const dd = document.getElementById('adminAutocomplete');
    
    input.oninput = async (e) => {
        const q = e.target.value.trim();
        if (q.length < 2) { dd.classList.add('hidden'); return; }
        
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`);
        const data = await res.json();
        
        if (!data.data?.length) { dd.classList.add('hidden'); return; }
        
        dd.innerHTML = data.data.map(s => `
           <div class="autocomplete-item flex items-center gap-3" onclick="loadStudentForAcademic('${s.id}')">
              <div class="w-8 h-8 rounded bg-gray-100 flex items-center justify-center font-bold text-xs">${s.full_name[0]}</div>
              <div>
                 <p class="font-bold text-navy h-4 overflow-hidden">${s.full_name}</p>
                 <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest">${s.student_id}</p>
              </div>
           </div>
        `).join('');
        dd.classList.remove('hidden');
    };
}

async function loadStudentForAcademic(id) {
    document.getElementById('adminAutocomplete').classList.add('hidden');
    document.getElementById('studentSearchInput').value = '';
    
    try {
        const res = await fetch(`/api/student?id=${id}`);
        const s = await res.json();
        adminState.activeStudent = s;
        
        document.getElementById('manageStudentArea').classList.remove('hidden');
        document.getElementById('asName').textContent = s.full_name;
        document.getElementById('asID').textContent = s.student_id;
        document.getElementById('asAvatar').textContent = s.full_name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
        
        renderAcademicSems(s.semesters);
    } catch (e) { showToast('Load failed', 'error'); }
}

function renderAcademicSems(sems) {
    const grid = document.getElementById('asSemsGrid');
    if (!sems || sems.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-10 text-center text-gray-300 font-bold uppercase tracking-widest text-xs">No results recorded yet.</div>`;
        return;
    }
    
    grid.innerHTML = sems.map(sem => `
        <div class="sem-block bg-white border border-gray-100 p-6 flex flex-col justify-between ${sem.result}">
           <div class="flex justify-between items-start mb-4">
              <span class="text-[10px] font-black text-gray-300 uppercase tracking-widest">Sem ${sem.semester_number}</span>
              <span class="text-[9px] font-bold text-navy bg-gray-50 px-2 py-0.5 rounded border border-gray-100 uppercase">${sem.result}</span>
           </div>
           <div class="grid grid-cols-2 gap-4 h-12">
              <div><p class="text-[9px] font-black text-gray-400 uppercase">SGPA</p><p class="text-sm font-black text-navy">${sem.sgpa}</p></div>
              <div><p class="text-[9px] font-black text-gray-400 uppercase">CGPA</p><p class="text-sm font-black text-orange">${sem.cgpa}</p></div>
           </div>
           <div class="mt-4 pt-3 border-t border-gray-50 text-[9px] text-gray-400 font-bold uppercase flex justify-between">
              <span>${sem.academic_year} AY</span>
              <span>${sem.attendance_pct}% ATT.</span>
           </div>
        </div>
    `).join('');
}

function openAddSemModal() {
    document.getElementById('semModal').classList.remove('hidden');
}

document.getElementById('semForm').onsubmit = async (e) => {
    e.preventDefault();
    if (!adminState.activeStudent) return;
    
    const fd = new FormData(e.target);
    const body = {
        action: 'upsert_semester',
        data: {
            student_id: adminState.activeStudent.id,
            semester_number: parseInt(fd.get('semester_number')),
            academic_year: fd.get('academic_year'),
            sgpa: parseFloat(fd.get('sgpa')),
            cgpa: parseFloat(fd.get('cgpa')),
            attendance_pct: parseFloat(fd.get('attendance_pct')),
            result: fd.get('result')
        }
    };
    
    showToast('Saving result...', 'info');
    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${adminState.token}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(body)
        });
        if (res.ok) {
            showToast('Semester added successfully!', 'success');
            document.getElementById('semModal').classList.add('hidden');
            loadStudentForAcademic(adminState.activeStudent.id);
        } else throw new Error('Failed to save');
    } catch (e) { showToast(e.message, 'error'); }
};

/**
 * UI UTILS
 */
function showToast(msg, type='success') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="fa fa-${type==='success'?'check-circle':'exclamation-circle'}"></i> <span>${msg}</span>`;
    document.body.appendChild(t);
    setTimeout(() => t.style.opacity = '0', 3000);
    setTimeout(() => t.remove(), 3400);
}
