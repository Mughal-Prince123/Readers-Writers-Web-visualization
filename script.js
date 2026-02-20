// --- GLOBAL CONFIGURATION ---
let mode = "PROBLEM";
let activeReaders = 0;
let activeWriters = 0;
let dbVersion = 0.0;    
let hasBeenWritten = false; 

const READ_TIME = 4000;
const WRITE_TIME = 3000;
const ATOMIC_OP_DELAY = 600; 

let mutex = 1;
let rw_mutex = 1;
let mutex_logic_gate = false;

// --- UNIVERSAL ALERT SYSTEM ---

function updateAlertDisplay() {
    const alertBox = document.getElementById('universal-alert');
    const alertMsg = document.getElementById('alert-msg');
    const collision = (activeWriters > 1) || (activeWriters > 0 && activeReaders > 0);

    if (collision) {
        alertBox.style.display = "block";
        alertBox.classList.remove('alert-warning');
        alertMsg.innerText = "⚠️ DATA CORRUPTION";
        document.getElementById('db-card').style.borderColor = "#ef4444";
    } else if (!alertBox.classList.contains('alert-warning')) {
        alertBox.style.display = "none";
        document.getElementById('db-card').style.borderColor = "#1e293b";
    }
}

function triggerTempAlert(msg) {
    const alertBox = document.getElementById('universal-alert');
    const alertMsg = document.getElementById('alert-msg');
    alertBox.style.display = "block";
    alertBox.classList.add('alert-warning');
    alertMsg.innerText = `⚠️ ${msg}`;
    setTimeout(() => {
        alertBox.classList.remove('alert-warning');
        updateAlertDisplay();
    }, 2500);
}

// --- UI & LOGGING ---

function addLog(msg, color = "#cbd5e1") {
    const logBox = document.getElementById('log-box');
    const entry = document.createElement('div');
    entry.style.color = color;
    entry.style.marginBottom = "8px";
    entry.innerHTML = `<span style="color:#4ade80">▶</span> ${msg}`;
    logBox.appendChild(entry);
    logBox.scrollTop = logBox.scrollHeight;
}

function updateUI() {
    // Update numeric values
    document.getElementById('s-mutex').innerText     = mutex;
    document.getElementById('s-rw').innerText        = rw_mutex;
    document.getElementById('db-text').innerText     = `DB_v${dbVersion.toFixed(1)}`;
    document.getElementById('active-readers').innerText = activeReaders;
    document.getElementById('active-writers').innerText = activeWriters;

    const lockTag = document.getElementById('lock-tag');

    if (mode === "SOLUTION") {
        lockTag.innerText = rw_mutex === 0 ? "🔒 RW_LOCK: ACTIVE" : "🔓 RW_LOCK: FREE";
        lockTag.style.color = rw_mutex === 0 ? "#f59e0b" : "#10b981";

        // Show the semaphore rows
        document.getElementById('sem-mutex').style.display   = 'block';
        document.getElementById('sem-rwlock').style.display  = 'block';

        // ─── Apply color classes to MUTEX and RW_LOCK ───
        const mutexSem  = document.getElementById('sem-mutex');
        const rwSem     = document.getElementById('sem-rwlock');

        // MUTEX
        if (mutex === 0) {
            mutexSem.classList.add('sem-locked');
            mutexSem.classList.remove('sem-free');
        } else {
            mutexSem.classList.add('sem-free');
            mutexSem.classList.remove('sem-locked');
        }

        // RW_LOCK
        if (rw_mutex === 0) {
            rwSem.classList.add('sem-locked');
            rwSem.classList.remove('sem-free');
        } else {
            rwSem.classList.add('sem-free');
            rwSem.classList.remove('sem-locked');
        }
        // ────────────────────────────────────────────────
    } else {
        lockTag.innerText = "⚠️ UNPROTECTED ACCESS";
        lockTag.style.color = "#ef4444";

        document.getElementById('sem-mutex').style.display  = 'none';
        document.getElementById('sem-rwlock').style.display = 'none';
    }

    updateAlertDisplay();
}

// --- HELPER FUNCTIONS ---

async function wait(ms = 100) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function createActorRow(name, fillClass) {
    const div = document.createElement('div');
    div.className = 'actor-row';
    div.innerHTML = `
        <div class="actor-info"><span>${name}</span><span class="pct">0%</span></div>
        <div class="p-bar-bg"><div class="p-bar-fill ${fillClass}"></div></div>
    `;
    return div;
}

async function animateActor(element, duration) {
    const fill = element.querySelector('.p-bar-fill');
    const pct = element.querySelector('.pct');
    const start = Date.now();
    return new Promise(resolve => {
        const timer = setInterval(() => {
            const elapsed = Date.now() - start;
            const progress = Math.min((elapsed / duration) * 100, 100);
            fill.style.width = progress + '%';
            pct.innerText = Math.floor(progress) + '%';
            if (progress >= 100) { clearInterval(timer); resolve(); }
        }, 50);
    });
}

// --- CORE LOGIC ---

window.addReader = async function() {
    if (dbVersion === 0.0) {
        triggerTempAlert("CANNOT READ: DB IS EMPTY");
        addLog("READER BLOCKED: DB version 0", "#ef4444");
        return;
    }

    const id = Math.floor(Math.random() * 900 + 100);
    const row = createActorRow(`READER R-${id}`, 'reader-fill');
    document.getElementById('readers-list').appendChild(row);

    if (mode === "SOLUTION") {
        // --- ENTRY SECTION ---
        // 1. Wait for Entry Gate (Mutex)
        while(mutex_logic_gate || mutex <= 0) await wait(50);
        mutex_logic_gate = true; mutex = 0; 
        updateUI();
        await wait(ATOMIC_OP_DELAY);

        // 2. First Reader handles the RW_LOCK
        if (activeReaders === 0) {
            if (rw_mutex <= 0) {
                addLog(`R-${id}: Writer active. Queuing at gate...`, "#f59e0b");
                while (rw_mutex <= 0) await wait(100);
            }
            rw_mutex = 0; // Secure DB
            addLog(`R-${id}: Secured RW_LOCK.`, "#10b981");
            updateUI();
            await wait(ATOMIC_OP_DELAY);
        }

        // 3. Increment active count and release gate IMMEDIATELY
        activeReaders++;
        addLog(`R-${id}: Entered critical section.`, "#3b82f6");
        
        mutex = 1; mutex_logic_gate = false; 
        updateUI();
        // Delay before reading so they don't overlap logs too much
        await wait(200); 
    } else {
        activeReaders++;
        updateUI();
    }

    // --- READING PHASE ---
    addLog(`R-${id}: Reading DB_v${dbVersion.toFixed(1)}...`, "#3b82f6");
    await animateActor(row, READ_TIME);

    if (mode === "SOLUTION") {
        // --- EXIT SECTION ---
        while(mutex_logic_gate || mutex <= 0) await wait(50);
        mutex_logic_gate = true; mutex = 0; updateUI();
        await wait(ATOMIC_OP_DELAY);

        activeReaders--;
        addLog(`R-${id}: Finished reading.`, "#cbd5e1");

        if (activeReaders === 0) {
            rw_mutex = 1; 
            addLog(`R-${id}: Last reader out. Released RW_LOCK.`, "#10b981");
            updateUI();
            await wait(ATOMIC_OP_DELAY);
        }

        mutex = 1; mutex_logic_gate = false; updateUI();
    } else {
        activeReaders--;
        updateUI();
    }
    row.remove();
};

window.addWriter = async function() {
    const id = Math.floor(Math.random() * 900 + 100);
    const row = createActorRow(`WRITER W-${id}`, 'writer-fill');
    document.getElementById('writers-list').appendChild(row);

    if (mode === "SOLUTION") {
        addLog(`W-${id}: Requesting RW_LOCK...`, "#f59e0b");
        while(rw_mutex <= 0) await wait(300);
        rw_mutex = 0; 
        updateUI();
        await wait(ATOMIC_OP_DELAY);
    }

    activeWriters++;
    updateUI();
    addLog(`W-${id}: Writing update...`, "#f43f5e");
    
    await animateActor(row, WRITE_TIME);
    
    dbVersion += 0.1;
    activeWriters--;
    updateUI();

    if (mode === "SOLUTION") {
        rw_mutex = 1; 
        updateUI();
        addLog(`W-${id}: Released RW_LOCK.`, "#10b981");
        await wait(ATOMIC_OP_DELAY);
    }
    
    row.remove();
};

// --- CONTROLS ---

document.getElementById('btn-prob').onclick = (e) => {
    mode = "PROBLEM";
    document.getElementById('btn-sol').classList.remove('active');
    e.target.classList.add('active');
    addLog("MODE: UNPROTECTED", "#ef4444");
    updateUI();
};

document.getElementById('btn-sol').onclick = (e) => {
    mode = "SOLUTION";
    document.getElementById('btn-prob').classList.remove('active');
    e.target.classList.add('active');
    addLog("MODE: SEMAPHORE SYNC", "#10b981");
    updateUI();
};

updateUI();