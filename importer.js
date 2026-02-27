/* ───────── IMPORT LOGIC ───────── */
let pendingImportFile = null;

// Helper to generate UUIDs safely (Polyfill for non-secure contexts)
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function handleFiles(fileList) {
  if(fileList.length === 0) return;
  const overlay = document.getElementById('loadingOverlay');
  const status = document.getElementById('loadStatus');
  const progressBar = document.getElementById('loadProgress');
  const countText = document.getElementById('loadCount');
  
  overlay.classList.remove('hidden');
  progressBar.style.width = '0%';
  
  const total = fileList.length;
  let processed = 0;
  
  for (const file of Array.from(fileList)) {
    status.innerText = `Processing: ${file.name}...`;
    countText.innerText = `${processed + 1} / ${total}`;
    
    // Update progress bar width
    const pct = ((processed) / total) * 100;
    progressBar.style.width = pct + "%";

    if(file.name.endsWith('.zip') && config.autoUnzip) {
       await handleZip(file);
    } else {
       await checkConflictAndProcess(file);
    }
    processed++;
    progressBar.style.width = ((processed / total) * 100) + "%";
    
    // Small delay to let UI breathe
    await new Promise(r => requestAnimationFrame(r));
  }
  
  setTimeout(() => {
      overlay.classList.add('hidden');
      progressBar.style.width = '0%';
      updateFilterDropdown();
      renderLibrary();
      updateStorageMeter();
  }, 300);
}

// ─────────────────────────────────────────────────────────────
// STORE INSTALLER (Uses Bottom Bar)
// ─────────────────────────────────────────────────────────────
async function installGameFromUrl(url, name, coreSet, id) {
    const bar = document.getElementById('bottomInstallBar');
    const text = document.getElementById('installText');
    const fill = document.getElementById('installFill');
    
    bar.classList.remove('hidden');
    text.innerText = `Downloading ${name}...`;
    fill.style.width = '10%';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 min timeout
        
        // Fetch with progress is tricky without Content-Length, simulating steps
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        
        fill.style.width = '50%';
        text.innerText = "Processing...";
        
        const blob = await res.blob();
        fill.style.width = '80%';
        
        // Use URL filename if possible, otherwise construct one
        const filename = url.split('/').pop() || `${name}.bin`;

        // Create Game Object
        const game = {
            id: id || generateUUID(), // Use safe UUID
            title: name,
            rawTitle: name,
            system: coreSet, // Use the coreSet from store (e.g. 'gba', 'flash')
            art: "",
            blob: blob,
            size: blob.size, 
            filename: filename,
            patches: [] 
        };
        
        await db.addGame(game);
        
        // Auto Art Check
        if(navigator.onLine && config.autoHash) {
             text.innerText = "Fetching Art...";
             await attemptAutoArt(game);
        }
        
        fill.style.width = '100%';
        text.innerText = "Installed!";
        
        setTimeout(() => {
            bar.classList.add('hidden');
            fill.style.width = '0%';
            renderLibrary();
            updateFilterDropdown();
        }, 2000);

    } catch(e) {
        text.innerText = "Error: " + e.message;
        fill.style.background = "#ff4444";
        setTimeout(() => {
            bar.classList.add('hidden');
            fill.style.width = '0%';
            fill.style.background = "var(--primary)";
        }, 3000);
    }
}

async function handleZip(file) {
    try {
        const zip = await JSZip.loadAsync(file);
        const validFiles = [];
        for(let filename of Object.keys(zip.files)) {
             const entry = zip.files[filename];
             if(entry.dir) continue;
             const ext = filename.split('.').pop().toLowerCase();
             if(ext === 'txt' || ext === 'nfo' || ext === 'xml') continue; 
             validFiles.push({ name: filename, entry: entry });
        }

        if (validFiles.length === 1) {
             const f = validFiles[0];
             const blob = await f.entry.async("blob");
             // Fix: Strip folder directories from the filename so File construction doesn't break
             const cleanName = f.name.split('/').pop();
             const newFile = new File([blob], cleanName);
             await checkConflictAndProcess(newFile);
        } else {
             await checkConflictAndProcess(file);
        }
    } catch(e) {
        console.error("Zip Error", e);
        await checkConflictAndProcess(file);
    }
}

async function checkConflictAndProcess(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (AMBIGUOUS_EXTS.includes(ext)) {
        return new Promise((resolve) => {
            pendingImportFile = { file: file, resolve: resolve };
            document.getElementById('conflictFileName').innerText = file.name;
            let guess = EXT_MAP[ext] || '';
            document.getElementById('conflictSystemSelect').value = guess;
            document.getElementById('loadingOverlay').classList.add('hidden'); 
            openModal('conflictModal');
        });
    } else {
        await processSingleFile(file, null);
    }
}

function resolveConflict() {
    const sys = document.getElementById('conflictSystemSelect').value;
    if(!sys) return alert("Please select a system.");
    
    closeModal('conflictModal');
    document.getElementById('loadingOverlay').classList.remove('hidden');
    
    if(pendingImportFile) {
        processSingleFile(pendingImportFile.file, sys).then(() => {
            pendingImportFile.resolve();
            pendingImportFile = null;
        });
    }
}

function cleanTitle(name) {
    return name
        .replace(/^\d+\s*-\s*/, "") 
        .replace(/\s*[\(\[][^)]*[\)\]]\s*/g, " ")
        .trim();
}

async function processSingleFile(file, forcedSystem) {
    const sys = forcedSystem || detectSystem(file.name);
    let rawName = file.name.replace(/\.[^/.]+$/, "");
    let title = cleanTitle(rawName);
    
    const game = {
        id: generateUUID(), // Use safe UUID
        title: title,
        rawTitle: rawName,
        system: sys,
        art: "",
        blob: file,
        size: file.size, 
        filename: file.name,
        patches: [] 
    };
    await db.addGame(game);
    library.unshift(game);

    if(navigator.onLine && config.autoHash) {
        attemptAutoArt(game);
    }
}

function calculateMD5(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const spark = new SparkMD5.ArrayBuffer();
            spark.append(e.target.result);
            resolve(spark.end());
        };
        reader.readAsArrayBuffer(file);
    });
}

function detectSystem(name) {
  const ext = name.split('.').pop().toLowerCase();
  if(EXT_MAP[ext]) return EXT_MAP[ext];
  return 'fceumm'; 
}

/* ───────── DRAG & DROP LOGIC ───────── */
function setupDragAndDrop() {
    const overlay = document.getElementById('dropOverlay');
    let dragCounter = 0;

    document.body.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        overlay.classList.add('active');
    });

    document.body.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    document.body.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if(dragCounter <= 0) overlay.classList.remove('active');
    });

    document.body.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        overlay.classList.remove('active');
        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    });
}

