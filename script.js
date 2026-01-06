/* ==========================================================================
   SCRIPT.JS - FINAL VERSION (UTUH)
   ========================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, push, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ⚠️ PASTE CONFIG FIREBASE KAMU DI BAWAH INI (Timpa bagian ini saja) ⚠️
const firebaseConfig = {
  apiKey: "AIzaSyC2K7xkEdGcJVXV4Fn6joT5vCAAtajehUc",
  authDomain: "project-hayalan-qc.firebaseapp.com",
  databaseURL: "https://project-hayalan-qc-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "project-hayalan-qc",
  storageBucket: "project-hayalan-qc.firebasestorage.app",
  messagingSenderId: "394997819688",
  appId: "1:394997819688:web:1f450210ff47254023881d"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const JOBS_REF = ref(db, 'jobs');

// --- VARIABEL GLOBAL ---
let globalJobsData = [];
const overlay = document.getElementById('overlay');
const modalBody = document.getElementById('modalBody');
const closeBtn = document.getElementById('closeBtn');
const saveBtn = document.getElementById('saveBtn');
const completeBtn = document.getElementById('completeBtn');
const proInput = document.getElementById('proInput');
const createBtn = document.getElementById('createBtn');
const modal = document.querySelector('.page-modal');
const minBtn = document.getElementById('minBtn');
const maxBtn = document.getElementById('maxBtn');
const dragHeader = document.getElementById('dragHeader');

let currentJobId = null;
let currentFormType = ''; 

// Input hanya angka
if(proInput) {
    proInput.addEventListener('input', (e) => e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10));
}

// --- DATABASE LISTENER (REAL-TIME) ---
onValue(JOBS_REF, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        globalJobsData = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        })).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } else {
        globalJobsData = [];
    }
    renderLists();
});

// --- NAVIGASI TAB UTAMA ---
const tabs = document.querySelectorAll('.tab');
const sections = document.querySelectorAll('.section');
function activateTab(targetId) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.target === targetId));
    sections.forEach(s => s.classList.toggle('active', s.id === targetId));
}
tabs.forEach(t => t.addEventListener('click', e => { e.preventDefault(); activateTab(t.dataset.target); }));

// --- FUNGSI UTAMA: LOAD FORM ---
async function loadFormHTML(fileName) {
    modalBody.innerHTML = '<div style="padding:40px; text-align:center;">Loading Form...</div>';
    try {
        const response = await fetch(`forms/${fileName}.html`);
        if (!response.ok) throw new Error("File form tidak ditemukan (Cek folder forms/)");
        const html = await response.text();
        modalBody.innerHTML = html;
        
        // Panggil fungsi-fungsi setup (INI YANG TADI ERROR KARENA TIDAK KETEMU)
        setupAccordion();
        setupInputValidation();
        setupRowHighlight();
        initAllSignatures();
        setupFormTabs(); // <--- Ini tersangkanya
        updateProgress();
        
        return true;
    } catch (e) {
        modalBody.innerHTML = `<div style="color:red;text-align:center;padding:20px;">Error: ${e.message}</div>`;
        console.error(e);
        return false;
    }
}

// --- EVENT LISTENER TOMBOL ---
createBtn.addEventListener('click', () => {
    const pro = proInput.value.trim();
    if(!pro) return alert("Masukkan Nomor PRO!");
    
    // Cek Duplikat
    const exists = globalJobsData.find(j => j.pro === pro);
    if(exists) {
        alert("PRO ini sudah ada! Membuka data yang sudah ada...");
        openModal('edit', exists);
        return;
    }
    openModal('create');
});

saveBtn.addEventListener('click', () => {
    const data = getFormData();
    const pro = data['pro'] || 'UNKNOWN';
    const timestamp = new Date().toISOString();
    
    const jobPayload = {
        pro: pro,
        formType: currentFormType,
        status: 'inprogress',
        formData: data,
        updatedAt: timestamp
    };

    if (currentJobId) {
        const updates = {};
        updates['/jobs/' + currentJobId] = jobPayload;
        update(ref(db), updates)
            .then(() => {
                showToast("Data Tersimpan! ☁️", "success");
                closeModal();
            })
            .catch((err) => alert("Gagal: " + err.message));
    } else {
        const newJobRef = push(JOBS_REF);
        set(newJobRef, jobPayload)
            .then(() => {
                showToast("Job Baru Dibuat! 🚀", "success");
                closeModal();
                proInput.value = '';
            });
    }
});

completeBtn.addEventListener('click', () => {
    if(!confirm("Yakin Lock data ini?")) return;
    const data = getFormData();
    const pro = data['pro'] || 'UNKNOWN';
    const timestamp = new Date().toISOString();

    const jobPayload = {
        pro: pro,
        formType: currentFormType,
        status: 'complete',
        formData: data,
        updatedAt: timestamp
    };

    if (currentJobId) {
        update(ref(db, 'jobs/' + currentJobId), jobPayload)
            .then(() => {
                showToast("Job Selesai & Terkunci! 🔒", "success");
                closeModal();
                activateTab('complete');
            });
    } else {
        const newJobRef = push(JOBS_REF);
        set(newJobRef, jobPayload).then(() => closeModal());
    }
});

// --- FUNGSI MODAL ---
async function openModal(mode, job = null) {
    overlay.style.display = 'flex';
    modal.classList.remove('minimized', 'maximized');
    
    let formName = 'circle-drive';
    if(mode === 'create') formName = document.getElementById('jobType').value;
    else if(job) formName = job.formType || 'circle-drive';
    currentFormType = formName;

    const ok = await loadFormHTML(formName);
    if(!ok) return;

    if(mode === 'create') {
        currentJobId = null;
        const p = modalBody.querySelector('input[name="pro"]');
        if(p) p.value = proInput.value;
        enableForm(true);
    } else if(job) {
        currentJobId = job.id;
        setFormData(job.formData);
        if (job.status === 'complete') enableForm(false);
        else enableForm(mode === 'edit');
    }
}

function closeModal() { overlay.style.display = 'none'; modalBody.innerHTML = ''; }
if(closeBtn) closeBtn.addEventListener('click', closeModal);

function enableForm(on) {
    saveBtn.style.display = on ? 'block' : 'none';
    completeBtn.style.display = on ? 'block' : 'none';
    modalBody.querySelectorAll('input, textarea').forEach(el => {
        if(el.name !== 'pro') el.disabled = !on;
    });
    modalBody.querySelectorAll('.sig-canvas').forEach(c => {
        c.style.pointerEvents = on ? 'auto' : 'none';
    });
}

// --- FUNGSI UTILS (SETUP, FORM DATA, DLL) ---

// 1. Setup Tab dalam Form (INI YANG HILANG DI FILE KAMU SEBELUMNYA)
function setupFormTabs() {
    const btns = modalBody.querySelectorAll('.form-tab-btn');
    const panels = modalBody.querySelectorAll('.form-tab-panel');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const target = modalBody.querySelector(`#${btn.dataset.target}`);
            if(target) target.classList.add('active');
        });
    });
}

// 2. Setup Accordion
function setupAccordion() {
    const headers = modalBody.querySelectorAll('.step-header, .section-title');
    headers.forEach(h => {
        const newH = h.cloneNode(true);
        h.parentNode.replaceChild(newH, h);
        newH.addEventListener('click', () => newH.parentElement.classList.toggle('collapsed'));
    });
}

// 3. Setup Validasi Input
function setupInputValidation() {
    modalBody.querySelectorAll('.input-torque').forEach(input => {
        input.addEventListener('input', function() {
            const val = parseFloat(this.value);
            const min = parseFloat(this.getAttribute('data-min'));
            const max = parseFloat(this.getAttribute('data-max'));
            const oldT = this.parentNode.querySelector('.error-tooltip');
            if(oldT) oldT.remove();

            if(isNaN(val) || this.value === '') {
                this.classList.remove('valid-value', 'invalid-value');
            } else if (val >= min && val <= max) {
                this.classList.add('valid-value'); this.classList.remove('invalid-value');
            } else {
                this.classList.add('invalid-value'); this.classList.remove('valid-value');
                const t = document.createElement('div');
                t.className = 'error-tooltip'; t.innerText = `Range: ${min}-${max}`;
                this.parentNode.style.position = 'relative'; this.parentNode.appendChild(t);
            }
        });
    });
}

// 4. Setup Highlight Baris
function setupRowHighlight() {
    modalBody.querySelectorAll('input[type="checkbox"]').forEach(c => {
        c.addEventListener('change', function() {
            const tr = this.closest('tr');
            if(tr) this.checked ? tr.classList.add('row-active') : tr.classList.remove('row-active');
            updateProgress();
            updateStepHeaderStatus();
        });
    });
}

// 5. Update Progress Bar
function updateProgress() {
    const checks = Array.from(modalBody.querySelectorAll('#tab-process input[type="checkbox"]'));
    const total = checks.length;
    if(total === 0) return;
    const checked = checks.filter(c => c.checked).length;
    const pct = Math.round((checked/total) * 100);
    
    const txt = document.getElementById('headerProgress');
    const bar = document.getElementById('progressBar');
    if(txt) txt.textContent = `${pct}%`;
    if(bar) bar.style.width = `${pct}%`;
}

// 6. Update Status Header Step
function updateStepHeaderStatus() {
    modalBody.querySelectorAll('.step-group').forEach(g => {
        const header = g.querySelector('.step-header');
        const checks = g.querySelectorAll('input[type="checkbox"]');
        const total = checks.length;
        if(total > 0) {
            const checked = Array.from(checks).filter(c => c.checked).length;
            if(checked < total) { header.classList.add('incomplete'); header.classList.remove('complete'); }
            else { header.classList.remove('incomplete'); header.classList.add('complete'); }
        }
    });
}

// 7. Signature Logic
function initAllSignatures() {
    modalBody.querySelectorAll('.sig-canvas').forEach(setupSignature);
}

function setupSignature(canvas) {
    const ctx = canvas.getContext('2d');
    let isDrawing = false, lastX=0, lastY=0;
    ctx.strokeStyle = '#000'; ctx.lineWidth=2;

    const getPos = (e) => {
        const r = canvas.getBoundingClientRect();
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: (cx-r.left)*(canvas.width/r.width), y: (cy-r.top)*(canvas.height/r.height) };
    }
    const start = (e) => { isDrawing=true; const p=getPos(e); lastX=p.x; lastY=p.y; };
    const move = (e) => {
        if(!isDrawing) return; if(e.type.includes('touch')) e.preventDefault();
        const p=getPos(e); ctx.beginPath(); ctx.moveTo(lastX,lastY); ctx.lineTo(p.x,p.y); ctx.stroke(); lastX=p.x; lastY=p.y;
    };
    const end = () => { 
        if(isDrawing) { 
            isDrawing=false; 
            const inp = document.getElementById(canvas.id.replace('Pad','Data'));
            if(inp) inp.value = canvas.toDataURL();
        } 
    };

    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end); canvas.addEventListener('mouseout', end);
    canvas.addEventListener('touchstart', start, {passive:false}); canvas.addEventListener('touchmove', move, {passive:false}); canvas.addEventListener('touchend', end);
}

window.clearSpecificSig = (cid, iid) => {
    const c = document.getElementById(cid); const i = document.getElementById(iid);
    if(c) { c.getContext('2d').clearRect(0,0,c.width,c.height); if(i) i.value=''; }
};

function loadSig(cid, data) {
    const c = document.getElementById(cid);
    if(c && data) {
        const img = new Image();
        img.onload = () => c.getContext('2d').drawImage(img,0,0);
        img.src = data;
    }
}

// 8. Get/Set Data Helpers
function getFormData() {
    const data = {};
    modalBody.querySelectorAll('input, select, textarea').forEach((el, i) => {
        const key = el.id || el.name || `idx_${i}`;
        if(el.type === 'checkbox') data[key] = el.checked;
        else data[key] = el.value;
    });
    return data;
}

function setFormData(data) {
    modalBody.querySelectorAll('input, select, textarea').forEach((el, i) => {
        const key = el.id || el.name || `idx_${i}`;
        if(data.hasOwnProperty(key)) {
            if(el.type === 'checkbox') {
                el.checked = data[key];
                el.dispatchEvent(new Event('change'));
            } else {
                el.value = data[key];
                if(el.classList.contains('input-torque')) el.dispatchEvent(new Event('input'));
                if(key.includes('signature_') && data[key]) {
                    const cid = key === 'signature_foreman' ? 'sigPadForeman' : 'sigPadSupervisor';
                    loadSig(cid, data[key]);
                }
            }
        }
    });
    setTimeout(() => { updateProgress(); updateStepHeaderStatus(); }, 100);
}

// 9. Window Controls
let isDragging=false, startX, startY, iL, iT;
if(dragHeader) {
    dragHeader.addEventListener('mousedown', e => {
        if(e.target.closest('button') || modal.classList.contains('maximized')) return;
        isDragging=true; startX=e.clientX; startY=e.clientY;
        const r = modal.getBoundingClientRect(); iL=r.left; iT=r.top;
        document.addEventListener('mousemove', onDrag); document.addEventListener('mouseup', stopDrag);
    });
    dragHeader.addEventListener('dblclick', e => { if(!e.target.closest('button')) toggleMax(); });
}
function onDrag(e) { if(isDragging) { modal.style.left=`${iL+(e.clientX-startX)}px`; modal.style.top=`${iT+(e.clientY-startY)}px`; } }
function stopDrag() { isDragging=false; document.removeEventListener('mousemove', onDrag); document.removeEventListener('mouseup', stopDrag); }

function toggleMax() {
    modal.classList.toggle('maximized'); 
    modal.classList.remove('minimized');
    maxBtn.innerText = modal.classList.contains('maximized') ? '❐' : '□';
}
if(maxBtn) maxBtn.addEventListener('click', toggleMax);
if(minBtn) minBtn.addEventListener('click', () => { modal.classList.remove('maximized'); modal.classList.toggle('minimized'); });

window.toggleHeader = () => {
    const c = document.getElementById('headerContent');
    const w = document.getElementById('headerWrapper');
    if(c.classList.contains('hidden')) { c.classList.remove('hidden'); w.classList.remove('header-content-hidden'); }
    else { c.classList.add('hidden'); w.classList.add('header-content-hidden'); }
};

function renderLists() {
    const listIn = document.getElementById('inprogressList');
    const listCom = document.getElementById('completeList');
    const qIn = document.getElementById('q').value.toLowerCase();
    const qCom = document.getElementById('completeQ').value.toLowerCase();

    const jobsIn = globalJobsData.filter(j => j.status === 'inprogress' && (j.pro.toLowerCase().includes(qIn)));
    const jobsCom = globalJobsData.filter(j => j.status === 'complete' && (j.pro.toLowerCase().includes(qCom)));

    listIn.innerHTML = jobsIn.length ? jobsIn.map(j => cardTemplate(j, 'edit')).join('') : '<div class="empty">Tidak ada job aktif.</div>';
    listCom.innerHTML = jobsCom.length ? jobsCom.map(j => cardTemplate(j, 'view')).join('') : '<div class="empty">Belum ada history.</div>';
}

function cardTemplate(job, mode) {
    return `<div class="job-item">
        <div>
            <div class="job-title">${job.pro} <span class="badge pro">${job.formType}</span></div>
            <div class="job-meta">Updated: ${new Date(job.updatedAt).toLocaleString()}</div>
        </div>
        <button class="btn-sm ${mode==='edit'?'btn-edit':'btn-view'}" onclick="handleEdit('${job.id}', '${mode}')">${mode==='edit'?'Open':'View'}</button>
    </div>`;
}

window.handleEdit = (id, mode) => {
    const job = globalJobsData.find(j => j.id === id);
    if(job) openModal(mode, job);
};

document.getElementById('q').addEventListener('input', renderLists);
document.getElementById('completeQ').addEventListener('input', renderLists);

function showToast(msg, type='success') {
    const b = document.getElementById('toastBox');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="toast-icon">${type==='success'?'✅':'⚠️'}</span><span class="toast-msg">${msg}</span>`;
    b.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}

/* SELESAI */