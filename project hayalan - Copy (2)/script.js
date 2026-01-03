/* ==========================================================================
   BAGIAN 1: DATABASE & NAVIGASI TAB
   ========================================================================== */
const STORAGE_KEY = 'qc_integrated_jobs';

// Load Data dari LocalStorage
const loadJobs = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch(e){ return []; } };
const saveJobs = (jobs) => { localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs)); };

// Pindah Tab Menu
const tabs = document.querySelectorAll('.tab');
const sections = document.querySelectorAll('.section');

function activateTab(targetId) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.target === targetId));
    sections.forEach(s => s.classList.toggle('active', s.id === targetId));
}
tabs.forEach(t => t.addEventListener('click', e => { e.preventDefault(); activateTab(t.dataset.target); }));

/* ==========================================================================
   BAGIAN 2: LOGIKA LOAD FORM & FORMATTING
   ========================================================================== */
const overlay = document.getElementById('overlay');
const modalBody = document.getElementById('modalBody');
const closeBtn = document.getElementById('closeBtn');
const cancelBtn = document.getElementById('cancelBtn');
const saveBtn = document.getElementById('saveBtn');
const completeBtn = document.getElementById('completeBtn');

const proInput = document.getElementById('proInput');
const createBtn = document.getElementById('createBtn');

let currentJobId = null;
let currentFormType = ''; 

// Input PRO hanya angka
proInput.addEventListener('input', (e) => e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10));

// Formatter: Ubah "/" jadi Enter di tabel
function stackCellText(td) {
    if (!td) return;
    const raw = (td.textContent || '').trim();
    if (raw.includes('/') && !td.querySelector('input')) {
        td.innerHTML = raw.split('/').map(s => s.trim()).filter(Boolean).join('<br>');
    }
}

function runFormatting() {
    document.querySelectorAll('.process-card .parts-table tbody td:first-child').forEach(stackCellText);
    document.querySelectorAll('.process-card .parts-table tbody tr').forEach(tr => {
        if(tr.cells[1]) stackCellText(tr.cells[1]);
        if(tr.cells[2]) stackCellText(tr.cells[2]);
        if(tr.cells[3]) stackCellText(tr.cells[3]);
    });
}

// Fetch file HTML
async function loadFormHTML(fileName) {
    modalBody.innerHTML = '<div style="padding:40px; text-align:center; color:#666;">Sedang memuat formulir...</div>';
    try {
        const response = await fetch(`forms/${fileName}.html`);
        if (!response.ok) throw new Error("File form tidak ditemukan!");
        const htmlContent = await response.text();
        modalBody.innerHTML = htmlContent;
        runFormatting();
        return true; 
    } catch (error) {
        console.error(error);
        modalBody.innerHTML = `<div style="padding:20px; color:red; text-align:center;"><b>Error:</b> ${error.message}</div>`;
        return false; 
    }
}

/* ==========================================================================
   BAGIAN 3: GET & SET DATA FORM
   ========================================================================== */
function getFormData() {
    const inputs = modalBody.querySelectorAll('input, textarea, select');
    const data = {};
    inputs.forEach((el, index) => {
        let keyBase = el.name || el.id || ('idx_' + index);
        let key = keyBase.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_\-]/g, '');
        if(el.type === 'checkbox') data[key] = el.checked;
        else data[key] = el.value;
    });
    return data;
}

function setFormData(data) {
    if(!data) return;
    const inputs = modalBody.querySelectorAll('input, textarea, select');
    inputs.forEach((el, index) => {
        let keyBase = el.name || el.id || ('idx_' + index);
        let key = keyBase.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_\-]/g, '');
        if (data.hasOwnProperty(key)) {
            if(el.type === 'checkbox') el.checked = data[key];
            else el.value = data[key];
        }
    });
}

function resetForm() {
    const inputs = modalBody.querySelectorAll('input, textarea, select');
    inputs.forEach(el => {
        if(el.type === 'checkbox') el.checked = false;
        else el.value = '';
    });
}

/* ==========================================================================
   BAGIAN 4: LOGIKA BUKA TUTUP MODAL
   ========================================================================== */
const modal = document.querySelector('.page-modal');
const minBtn = document.getElementById('minBtn');
const maxBtn = document.getElementById('maxBtn');

async function openModal(mode, job = null) {
    overlay.style.display = 'flex';
    
    // Reset Posisi & Status Jendela
    modal.classList.remove('minimized');
    modal.classList.remove('maximized');
    modal.style.top = '60px'; // Turun dikit biar pas
    modal.style.left = '50px';
    maxBtn.innerText = '□'; 

    let namaFileForm = 'circle-drive'; 
    if (mode === 'create') {
        namaFileForm = document.getElementById('jobType').value; 
    } else if (job) {
        namaFileForm = job.formType || 'circle-drive';
    }
    currentFormType = namaFileForm;

    const sukses = await loadFormHTML(namaFileForm);
    if (!sukses) return;

    const formProInput = modalBody.querySelector('input[name="pro"]');

    if (mode === 'create') {
        resetForm();
        if(formProInput) formProInput.value = proInput.value;
        currentJobId = null;
        enableForm(true);
    } else if (mode === 'edit' && job) {
        currentJobId = job.id;
        setFormData(job.formData);
        if(formProInput) formProInput.value = job.pro; 
        enableForm(true);
    } else if (mode === 'view' && job) {
        currentJobId = job.id;
        setFormData(job.formData);
        enableForm(false); 
    }
}

function closeModal() {
    overlay.style.display = 'none';
    currentJobId = null;
    modalBody.innerHTML = ""; 
    if (document.fullscreenElement) document.exitFullscreen();
}

function enableForm(enabled) {
    const inputs = modalBody.querySelectorAll('input, textarea, select');
    inputs.forEach(el => {
        if (el.name !== 'pro') el.disabled = !enabled;
    });
    saveBtn.style.display = enabled ? 'block' : 'none';
    completeBtn.style.display = enabled ? 'block' : 'none';
}

/* ==========================================================================
   BAGIAN 5: VALIDASI, TOAST & AKSI TOMBOL
   ========================================================================== */

// Fungsi Toast Notification (Popup Cantik)
function showToast(message, type = 'error') {
    const toastBox = document.getElementById('toastBox');
    const toast = document.createElement('div');
    
    let icon = '⚠️';
    if (type === 'success') icon = '✅';
    
    toast.classList.add('toast', type);
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${message}</span>`;
    
    toastBox.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300); 
    }, 4000);
}

// LOGIKA CREATE DENGAN CEK DUPLIKASI
createBtn.addEventListener('click', () => {
    const inputVal = proInput.value.trim();

    // 1. Cek Kosong
    if (!inputVal) return showToast("Mohon masukkan nomor PRO!", "error");

    // 2. Cek Duplikasi di Database
    const jobs = loadJobs();
    const isDuplicate = jobs.some(job => job.pro === inputVal);

    if (isDuplicate) {
        return showToast(`Gagal: PRO ${inputVal} sudah terdaftar!`, "error");
    }

    // 3. Jika Aman, Buka Form
    openModal('create');
});

// LOGIKA SIMPAN
saveBtn.addEventListener('click', () => {
    const formProInput = modalBody.querySelector('input[name="pro"]');
    const pro = formProInput ? formProInput.value : "UNKNOWN"; 
    const formData = getFormData();
    const jobs = loadJobs();

    let jobName = "Circle Drive";
    let jobDesc = "117-2100 (24H)";
    if (currentFormType === 'transmission') { jobName = "Transmission"; jobDesc = "16H Unit"; }

    const jobData = {
        id: currentJobId || Date.now(),
        pro: pro,
        name: jobName, desc: jobDesc, formType: currentFormType,
        status: 'inprogress', formData: formData, updatedAt: new Date().toISOString()
    };

    if (currentJobId) {
        const idx = jobs.findIndex(j => j.id === currentJobId);
        if (idx > -1) jobs[idx] = jobData;
    } else {
        jobs.unshift(jobData);
    }
    
    saveJobs(jobs);
    closeModal();
    renderLists();
    activateTab('inprogress');
    proInput.value = ''; 
    showToast("Data berhasil disimpan!", "success");
});

// LOGIKA COMPLETE
completeBtn.addEventListener('click', () => {
    if(!confirm("Yakin job ini sudah selesai? Data akan dikunci.")) return;
    
    const formProInput = modalBody.querySelector('input[name="pro"]');
    const formData = getFormData();
    const jobs = loadJobs();
    
    let jobName = "Circle Drive";
    if (currentFormType === 'transmission') jobName = "Transmission";

    const jobData = {
        id: currentJobId || Date.now(),
        pro: formProInput ? formProInput.value : "UNKNOWN",
        name: jobName, desc: "COMPLETE", formType: currentFormType,
        status: 'complete', formData: formData, updatedAt: new Date().toISOString()
    };
    if (currentJobId) {
        const idx = jobs.findIndex(j => j.id === currentJobId);
        if (idx > -1) jobs[idx] = jobData;
    } else {
        jobs.unshift(jobData);
    }
    saveJobs(jobs);
    closeModal();
    renderLists();
    activateTab('complete'); 
    showToast("Job selesai & dikunci.", "success");
});

/* ==========================================================================
   BAGIAN 6: RENDER LIST
   ========================================================================== */
const inprogressList = document.getElementById('inprogressList');
const completeList = document.getElementById('completeList');

function renderLists() {
    const jobs = loadJobs();
    const termIn = document.getElementById('q').value.toLowerCase();
    const termComp = document.getElementById('completeQ').value.toLowerCase();

    const inPro = jobs.filter(j => j.status === 'inprogress' && (j.pro.includes(termIn) || j.name.toLowerCase().includes(termIn)));
    inprogressList.innerHTML = inPro.length ? inPro.map(j => cardTemplate(j, 'edit')).join('') : '<div class="empty">Tidak ada job yang sedang berjalan.</div>';

    const comp = jobs.filter(j => j.status === 'complete' && (j.pro.includes(termComp)));
    completeList.innerHTML = comp.length ? comp.map(j => cardTemplate(j, 'view')).join('') : '<div class="empty">Belum ada job selesai.</div>';
}

function cardTemplate(job, mode) {
    return `
    <div class="job-item">
        <div class="job-title">${job.name} <span class="badge pro">PRO: ${job.pro}</span></div>
        <div class="job-meta">
            <span>${job.desc}</span>
            <span>• ${new Date(job.updatedAt).toLocaleDateString()}</span>
        </div>
        <div class="job-actions">
            <button class="btn-sm ${mode==='edit'?'btn-edit':'btn-view'}" onclick="handleEdit(${job.id}, '${mode}')">
                ${mode==='edit' ? 'Open Window' : 'View Details'}
            </button>
        </div>
    </div>`;
}

window.handleEdit = (id, mode) => {
    const jobs = loadJobs();
    const job = jobs.find(j => j.id === id); 
    if (job) openModal(mode, job); 
};

document.getElementById('searchForm').addEventListener('submit', e => { e.preventDefault(); renderLists(); });
document.getElementById('q').addEventListener('input', renderLists);
document.getElementById('completeSearchForm').addEventListener('submit', e => { e.preventDefault(); renderLists(); });
document.getElementById('completeQ').addEventListener('input', renderLists);
renderLists();

/* ==========================================================================
   BAGIAN 7: FLOATING WINDOW LOGIC (DRAG & FULLSCREEN)
   ========================================================================== */
const dragHeader = document.getElementById('dragHeader');
closeBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

let isDragging = false;
let startX, startY, initialLeft, initialTop;

// LOGIKA DRAG MOUSE
dragHeader.addEventListener('mousedown', (e) => {
    if(e.target.tagName === 'BUTTON') return;
    if(modal.classList.contains('maximized')) return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = modal.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
});

function onMouseMove(e) {
    if (!isDragging) return;
    
    let dx = e.clientX - startX;
    let dy = e.clientY - startY;
    let newLeft = initialLeft + dx;
    let newTop = initialTop + dy;

    // BATAS AGAR JENDELA TIDAK HILANG (OFFSIDE)
    if (newTop < 0) newTop = 0; // Mentok Atas
    if (newLeft < 0) newLeft = 0; // Mentok Kiri
    if (newLeft > window.innerWidth - 50) newLeft = window.innerWidth - 50; // Mentok Kanan
    if (newTop > window.innerHeight - 50) newTop = window.innerHeight - 50; // Mentok Bawah

    modal.style.left = `${newLeft}px`;
    modal.style.top = `${newTop}px`;
}

function onMouseUp() {
    isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
}

// LOGIKA TRUE FULLSCREEN (F11 MODE)
maxBtn.addEventListener('click', () => {
    if (modal.classList.contains('minimized')) modal.classList.remove('minimized');

    if (!document.fullscreenElement) {
        // Masuk Fullscreen
        document.documentElement.requestFullscreen().catch((err) => { console.log(err); });
        modal.classList.add('maximized');
        maxBtn.innerText = '❐';
    } else {
        // Keluar Fullscreen
        document.exitFullscreen();
        modal.classList.remove('maximized');
        maxBtn.innerText = '□';
    }
});

// Deteksi jika user tekan tombol ESC
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        modal.classList.remove('maximized');
        maxBtn.innerText = '□';
    }
});

// LOGIKA MINIMIZE
minBtn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    modal.classList.remove('maximized');
    modal.classList.toggle('minimized');
});

// Double Click Restore
dragHeader.addEventListener('dblclick', () => {
    if (modal.classList.contains('minimized')) {
        modal.classList.remove('minimized');
    } else {
        maxBtn.click();
    }
});