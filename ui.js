/* ───────── UI LOGIC ───────── */

/* --- HELPER: Close Modal --- */
function closeModal(id) { 
    document.getElementById(id).classList.remove('active'); 
    toggleBlur(false);
    
    if(id === 'manualModal') {
        const frame = document.getElementById('manualFrame');
        frame.src = 'about:blank';
        frame.removeAttribute('srcdoc');
    }
}

/* --- HELPER: Open Modal --- */
function openModal(id) { 
    document.getElementById(id).classList.add('active'); 
    toggleBlur(true);
}

/* --- HELPER: Blur Background --- */
function toggleBlur(isBlur) {
    const el = ['home', 'topbar', 'emulator', 'store'];
    el.forEach(x => {
        const d = document.getElementById(x);
        if(d) {
            if(isBlur) d.classList.add('blur-content');
            else d.classList.remove('blur-content');
        }
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).style.display = 'block';
    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(btn => {
        if(btn.getAttribute('onclick').includes(tabId)) btn.classList.add('active');
    });
    if(tabId === 'tabVideo') updateVideoPreview();
    
    if(tabId === 'tabAppearance' && window.cssEditor) {
        setTimeout(() => window.cssEditor.refresh(), 100);
    }
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${['B', 'KB', 'MB', 'GB'][i]}`;
}

function getSystemDisplayName(systemCode) {
    for(let group in coreGroups) {
        if(coreGroups[group][systemCode]) return coreGroups[group][systemCode];
    }
    if(config.customCores) {
        const custom = config.customCores.find(c => c.id === systemCode);
        if(custom) return `${custom.name} (User Made)`;
    }
    return systemCode;
}

async function updateStorageMeter() {
    if(navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        const usedMB = (est.usage / 1024 / 1024).toFixed(2);
        const quotaMB = (est.quota / 1024 / 1024).toFixed(0);
        const percent = (est.usage / est.quota) * 100;
        
        document.getElementById('storageFill').style.width = percent + "%";
        document.getElementById('storageUsed').innerText = `${usedMB} MB Used`;
        document.getElementById('storageTotal').innerText = `${quotaMB} MB Total`;
    }
}

function refreshCoreDropdowns() {
  const sysSel = document.getElementById('editSystem');
  const biosSel = document.getElementById('biosSystemSelect');
  const confSel = document.getElementById('conflictSystemSelect');
  sysSel.innerHTML = '';
  biosSel.innerHTML = '<option value="" disabled selected>Select System</option>';
  confSel.innerHTML = '<option value="" disabled selected>Select System</option>';

  for(let group in coreGroups) {
    let grp = document.createElement('optgroup'); grp.label = group;
    let bioGrp = document.createElement('optgroup'); bioGrp.label = group;
    let confGrp = document.createElement('optgroup'); confGrp.label = group;
    for(let key in coreGroups[group]) {
      let opt = new Option(coreGroups[group][key], key);
      grp.appendChild(opt);
      let bioOpt = new Option(coreGroups[group][key], key);
      bioGrp.appendChild(bioOpt);
      let confOpt = new Option(coreGroups[group][key], key);
      confGrp.appendChild(confOpt);
    }
    sysSel.appendChild(grp);
    biosSel.appendChild(bioGrp);
    confSel.appendChild(confGrp);
  }

  if(config.customCores && config.customCores.length > 0) {
      let cGrp = document.createElement('optgroup'); cGrp.label = "Custom Cores";
      let cBioGrp = document.createElement('optgroup'); cBioGrp.label = "Custom Cores";
      let cConfGrp = document.createElement('optgroup'); cConfGrp.label = "Custom Cores";
      
      config.customCores.forEach(c => {
          let name = `${c.name} (User Made)`;
          let opt = new Option(name, c.id);
          cGrp.appendChild(opt);
          let bioOpt = new Option(name, c.id);
          cBioGrp.appendChild(bioOpt);
          let confOpt = new Option(name, c.id);
          cConfGrp.appendChild(confOpt);
      });
      sysSel.appendChild(cGrp);
      biosSel.appendChild(cBioGrp);
      confSel.appendChild(cConfGrp);
  }
}

function updateFilterDropdown() {
    const filter = document.getElementById('filterSystem');
    const current = filter.value;
    filter.innerHTML = '<option value="all">All Systems</option>';
    const systems = [...new Set(library.map(g => g.system))].sort();
    systems.forEach(sys => {
        let name = getSystemDisplayName(sys);
        if(name.length > 20) name = name.substring(0, 18) + '...';
        let opt = new Option(name, sys);
        filter.appendChild(opt);
    });
    if(current) filter.value = current;
    if(filter.value === "") filter.value = "all";
}

/* ───────── LIBRARY RENDER & SELECTION ───────── */
let isSelectMode = false;
let selectedGames = new Set();

function toggleSelectMode() {
    isSelectMode = !isSelectMode;
    selectedGames.clear();
    document.getElementById('btnSelectMode').classList.toggle('active', isSelectMode);
    document.getElementById('btnMultiDelete').classList.toggle('hidden', !isSelectMode);
    document.getElementById('btnMultiDelete').innerHTML = `<svg class="icon"><use href="#icon-delete"></use></svg>`;
    renderLibrary();
}

function toggleGameSelection(id) {
    if(selectedGames.has(id)) selectedGames.delete(id);
    else selectedGames.add(id);
    document.getElementById('btnMultiDelete').innerHTML = `<svg class="icon"><use href="#icon-delete"></use></svg> (${selectedGames.size})`;
    renderLibrary();
}

async function deleteSelected() {
    if(selectedGames.size === 0) return;
    if(!confirm(`Delete ${selectedGames.size} games?`)) return;
    
    for (let id of selectedGames) {
        await db.deleteGame(id);
        library = library.filter(g => g.id !== id);
    }
    toggleSelectMode();
    updateFilterDropdown();
    updateStorageMeter();
}

async function nukeLibrary() {
    if(confirm("WARNING: This will delete ALL games from your library. This cannot be undone.")) {
        if(confirm("Are you absolutely sure?")) {
            await Promise.all(library.map(g => db.deleteGame(g.id)));
            library = [];
            renderLibrary();
            updateStorageMeter();
            closeModal('settingsModal');
        }
    }
}

// Icon helper
function getIcon(name) {
    return `<svg class="icon"><use href="#icon-${name}"></use></svg>`;
}

function renderLibrary() {
  const container = document.getElementById('games');
  container.innerHTML = '';
  const filterSearch = document.getElementById('filterSearch');
  
  const txt = filterSearch.value.toLowerCase();
  const filterSys = document.getElementById('filterSystem').value;
  
  const presentSystems = [...new Set(library.map(g => g.system))].sort();
  const fragment = document.createDocumentFragment();

  presentSystems.forEach(sys => {
    if (filterSys !== "all" && filterSys !== sys) return;

    const sysGames = library.filter(g => g.system === sys && g.title.toLowerCase().includes(txt));
    if(sysGames.length === 0) return;

    let displayName = getSystemDisplayName(sys);
    const folder = document.createElement('div');
    folder.className = 'system-folder';
    folder.innerHTML = `<div class="folder-header">${displayName}</div>`;
    const grid = document.createElement('div');
    grid.className = 'folder-grid';

    sysGames.forEach(g => {
      const card = document.createElement('div');
      card.className = `game-card ${selectedGames.has(g.id) ? 'selected' : ''}`;
      
      card.onclick = (e) => {
        if(e.target.closest('.card-actions')) return;
        if(isSelectMode) {
            toggleGameSelection(g.id);
        } else {
            prepareLaunch(g);
        }
      };
      
      const artHtml = g.art ? `<img src="${g.art}" alt="${g.title}" loading="lazy" decoding="async">` : `<div style="height:230px; background:#333; display:flex; align-items:center; justify-content:center; color:#555;">No Art</div>`;

      const manualBtn = g.manual ? `<div class="action-btn" onclick="openManual('${g.manual}')" title="Manual">${getIcon('book')}</div>` : '';

      card.innerHTML = `
        <div class="game-art">
            ${artHtml}
            <div class="card-actions">
                ${manualBtn}
                <div class="action-btn" onclick="openExplorer('${g.id}')" title="Explore Files">${getIcon('folder')}</div>
                <div class="action-btn" onclick="openEdit('${g.id}')" title="Edit">${getIcon('edit')}</div>
                <div class="action-btn del" onclick="deleteGame('${g.id}')" title="Delete">${getIcon('delete')}</div>
            </div>
            ${selectedGames.has(g.id) ? '<div style="position:absolute;top:5px;left:5px;background:var(--primary);color:#000;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;">•</div>' : ''}
        </div>
        <div class="game-info">
            <div class="game-title-wrapper"><span class="game-title">${g.title}</span></div>
            <div class="game-meta">
                <div class="meta-sys-wrapper"><span>${displayName}</span></div>
                <span>${formatBytes(g.size || 0)}</span>
            </div>
        </div>
      `;
      grid.appendChild(card);
    });
    folder.appendChild(grid);
    fragment.appendChild(folder);
  });
  
  container.appendChild(fragment);
}

function refreshGameCard(id) {
    if(document.getElementById('home').style.display !== 'none') {
        renderLibrary();
    }
}

async function deleteGame(id) {
  if(confirm('Delete this game?')) {
    await db.deleteGame(id);
    library = library.filter(g => g.id !== id);
    updateFilterDropdown();
    renderLibrary();
    updateStorageMeter();
  }
}

function openEdit(id) {
  const g = library.find(x => x.id === id);
  if(!g) return;
  document.getElementById('editId').value = id;
  document.getElementById('editTitle').value = g.title;
  refreshCoreDropdowns(); 
  document.getElementById('editSystem').value = g.system;
  document.getElementById('editManual').value = g.manual || '';
  document.getElementById('editArtUrl').value = (g.art && g.art.startsWith('data')) ? '' : g.art;
  document.getElementById('editArtFileInput').value = "";
  openModal('editModal');
}

async function saveGameEdit() {
  const id = document.getElementById('editId').value;
  const g = library.find(x => x.id === id);
  if (!g) return;

  g.title = document.getElementById('editTitle').value;
  g.system = document.getElementById('editSystem').value;
  g.manual = document.getElementById('editManual').value;
  const urlArt = document.getElementById('editArtUrl').value;
  const fileInput = document.getElementById('editArtFileInput');
  
  if (fileInput.files[0]) {
    g.art = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(fileInput.files[0]);
    });
  } else if (urlArt) {
    g.art = urlArt;
  }

  await db.addGame(g);
  renderLibrary();
  closeModal('editModal');
}

/* ───────── FILE EXPLORER ───────── */
let explorerGame = null; // If null, we are at root
let explorerFiles = []; 
let explorerCurrentPath = ""; // Inside a game. Root is empty string
let explorerEditor = null;
let explorerActiveFile = null;

// Draggable Resizer Logic
let isResizingExplorer = false;

document.addEventListener('mouseup', () => {
    isResizingExplorer = false;
    document.body.style.cursor = 'default';
});

document.addEventListener('mousemove', (e) => {
    if (!isResizingExplorer) return;
    
    const layout = document.querySelector('.explorer-layout');
    const preview = document.querySelector('.explorer-preview');
    if(!layout || !preview) return;
    
    // Calculate new width from right edge
    const newWidth = layout.getBoundingClientRect().right - e.clientX;
    
    // Constraints (Min 200px, Max 80% of screen)
    if (newWidth > 200 && newWidth < (layout.clientWidth * 0.8)) {
        preview.style.width = newWidth + 'px';
    }
});

function initExplorerResizer() {
    const handle = document.getElementById('explorerResizer');
    if(handle) {
        handle.addEventListener('mousedown', (e) => {
            isResizingExplorer = true;
            document.body.style.cursor = 'col-resize';
            e.preventDefault(); // Prevent text selection
        });
    }
}

// Global entry point
function openGlobalExplorer() {
    openExplorer(null);
}

async function openExplorer(id) {
    explorerCurrentPath = "";
    document.getElementById('explorerList').innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Loading files...</td></tr>';
    openModal('explorerModal');
    initExplorerResizer();

    // Reset preview
    document.getElementById('explorerPreviewContent').innerHTML = '<div style="color:#666; text-align:center; margin-top:50px;">Select a file to view properties</div>';
    document.getElementById('previewActions').style.display = 'none';

    if (id === null) {
        // GLOBAL ROOT
        explorerGame = null;
        document.getElementById('explorerTitle').innerText = "/";
        explorerFiles = []; // Not used for root render, but cleared
        renderExplorerList();
        return;
    }

    // INSIDE A GAME
    explorerGame = library.find(g => g.id === id);
    if (!explorerGame) return;

    document.getElementById('explorerTitle').innerText = explorerGame.title;
    
    try {
        if(explorerGame.filename.endsWith('.zip') || explorerGame.filename.endsWith('.7z')) {
            const zip = await JSZip.loadAsync(explorerGame.blob);
            explorerFiles = [];
            
            // Convert ZipObject to manageable array
            for (let filename of Object.keys(zip.files)) {
                if(zip.files[filename].dir) continue;
                explorerFiles.push({
                    name: filename.split('/').pop(),
                    path: filename, // Full path
                    folderPath: filename.includes('/') ? filename.substring(0, filename.lastIndexOf('/')) : "",
                    size: zip.files[filename]._data.uncompressedSize || 0,
                    data: zip.files[filename]
                });
            }
        } else {
            // Single File treatment
            explorerFiles = [{
                name: explorerGame.filename,
                path: explorerGame.filename,
                folderPath: "",
                size: explorerGame.size,
                data: null, // Indicate plain blob
                blob: explorerGame.blob
            }];
        }
        renderExplorerList();
    } catch(e) {
        document.getElementById('explorerList').innerHTML = `<tr><td colspan="4" style="color:red; text-align:center;">Error reading file structure: ${e.message}</td></tr>`;
    }
}

function renderExplorerList() {
    const list = document.getElementById('explorerList');
    const search = document.getElementById('explorerSearch').value.toLowerCase();
    const pathElem = document.getElementById('explorerPath');
    
    list.innerHTML = '';
    
    // --- MODE 1: GLOBAL ROOT ---
    if (explorerGame === null) {
        pathElem.innerText = "/";
        // List all games from Library
        
        library.sort((a,b) => a.title.localeCompare(b.title)).forEach(g => {
            if(search && !g.title.toLowerCase().includes(search)) return;
            
            const isArchive = g.filename.endsWith('.zip');
            const icon = isArchive ? getIcon('folder') : getIcon('file');
            const type = isArchive ? 'ARCHIVE/FOLDER' : g.system.toUpperCase();
            
            const row = document.createElement('tr');
            row.className = 'explorer-row';
            row.innerHTML = `
                <td style="text-align:center; ${isArchive ? 'color:var(--primary);' : 'opacity:0.7'}">${icon}</td>
                <td>${g.title}</td>
                <td style="color:#888;">${formatBytes(g.size)}</td>
                <td style="color:#666;">${type}</td>
            `;
            
            row.onclick = () => {
                 if(!isArchive) selectGlobalFile(g, row); 
            };
            
            row.ondblclick = () => {
                if(isArchive) openExplorer(g.id);
            }
            
            list.appendChild(row);
        });
        return;
    }

    // --- MODE 2: INSIDE GAME ---
    pathElem.innerText = explorerGame.title + "/" + explorerCurrentPath;
    
    let visibleItems = [];
    
    if(search) {
        // Flat search inside archive
        visibleItems = explorerFiles.filter(f => f.name.toLowerCase().includes(search));
        pathElem.innerText = "Search: " + search;
    } else {
        // Folder View Logic
        
        // "Go Up" Logic
        const upRow = document.createElement('tr');
        upRow.className = 'explorer-row';
        upRow.innerHTML = `
            <td style="text-align:center;">${getIcon('folder')}</td>
            <td>Back</td>
            <td></td><td></td>
        `;
        upRow.onclick = () => {
            if(explorerCurrentPath === "") {
                // Return to Global Root
                openExplorer(null);
            } else {
                // Go up one dir
                if(explorerCurrentPath.includes('/')) {
                    explorerCurrentPath = explorerCurrentPath.substring(0, explorerCurrentPath.lastIndexOf('/'));
                } else {
                    explorerCurrentPath = "";
                }
                renderExplorerList();
            }
        };
        list.appendChild(upRow);

        // Filter files in current path
        const relevantFiles = explorerFiles.filter(f => {
            if (explorerCurrentPath === "") return true;
            return f.path.startsWith(explorerCurrentPath + "/");
        });

        const distinctFolders = new Set();
        const filesInCurrentDir = [];

        relevantFiles.forEach(f => {
            let relative = f.path;
            if (explorerCurrentPath !== "") {
                relative = f.path.substring(explorerCurrentPath.length + 1);
            }
            
            if (relative.includes('/')) {
                const folderName = relative.split('/')[0];
                distinctFolders.add(folderName);
            } else {
                filesInCurrentDir.push(f);
            }
        });

        // Render Sub-Folders
        [...distinctFolders].sort().forEach(folder => {
            const row = document.createElement('tr');
            row.className = 'explorer-row';
            row.innerHTML = `
                <td style="text-align:center; color:var(--primary);">${getIcon('folder')}</td>
                <td>${folder}</td>
                <td>-</td>
                <td>FOLDER</td>
            `;
            row.ondblclick = () => {
                explorerCurrentPath = explorerCurrentPath ? (explorerCurrentPath + "/" + folder) : folder;
                renderExplorerList();
            };
            list.appendChild(row);
        });

        visibleItems = filesInCurrentDir;
    }

    // Render Files
    visibleItems.sort((a,b) => a.name.localeCompare(b.name)).forEach(f => {
        if(f.name === '.keep' || f.name === '.folder') return; // Hide system files

        const row = document.createElement('tr');
        row.className = 'explorer-row';
        if(explorerActiveFile === f) row.classList.add('active-row');
        
        // Icon based on type
        let icon = getIcon('file');
        const ext = f.name.split('.').pop().toLowerCase();
        if(['mp4','webm','ogv'].includes(ext)) icon = getIcon('video');
        if(['mp3','wav','ogg','flac'].includes(ext)) icon = getIcon('audio');
        if(['js','html','css','xml','json','txt'].includes(ext)) icon = getIcon('code');
        if(ext === 'zip' || ext === '7z' || ext === 'rar') icon = getIcon('upload');

        row.innerHTML = `
            <td style="text-align:center; opacity:0.7">${icon}</td>
            <td title="${f.name}">${f.name}</td>
            <td style="color:#888;">${formatBytes(f.size)}</td>
            <td style="color:#666;">${ext.toUpperCase()}</td>
        `;
        row.onclick = () => selectExplorerFile(f, row);
        list.appendChild(row);
    });
}

// Select a game from the global root (view only)
async function selectGlobalFile(game, rowElem) {
    document.querySelectorAll('.explorer-row').forEach(e => e.classList.remove('active-row'));
    rowElem.classList.add('active-row');

    const preview = document.getElementById('explorerPreviewContent');
    const actions = document.getElementById('previewActions');
    actions.style.display = 'none'; 

    let contentHtml = '';
    contentHtml += `<div class="preview-info-row"><span>Name</span> <span>${game.title}</span></div>`;
    contentHtml += `<div class="preview-info-row"><span>Size</span> <span>${formatBytes(game.size)}</span></div>`;
    contentHtml += `<div class="preview-info-row"><span>System</span> <span>${game.system}</span></div>`;
    
    contentHtml += `<div style="margin-top:20px; color:#888; text-align:center; padding:20px; border:1px dashed #444;">
        Single File Game<br>
        (Not an archive)
    </div>`;
    
    preview.innerHTML = contentHtml;
}

async function selectExplorerFile(file, rowElem) {
    document.querySelectorAll('.explorer-row').forEach(e => e.classList.remove('active-row'));
    if(rowElem) rowElem.classList.add('active-row');
    
    explorerActiveFile = file;
    const preview = document.getElementById('explorerPreviewContent');
    const actions = document.getElementById('previewActions');
    
    preview.innerHTML = '<div class="loader-spinner"></div>';
    actions.style.display = 'flex';

    try {
        // Get Content
        let blob;
        if(file.data) { // From Zip
            blob = await file.data.async('blob');
        } else {
            blob = file.blob;
        }
        
        const type = blob.type || getMimeFromExt(file.name);
        const ext = file.name.split('.').pop().toLowerCase();

        const isImg = type.startsWith('image/');
        const isVideo = type.startsWith('video/') || ['mp4','webm','ogv'].includes(ext);
        const isAudio = type.startsWith('audio/') || ['mp3','wav','ogg','flac'].includes(ext);
        const isText = type.startsWith('text/') || type.includes('javascript') || type.includes('json') || type.includes('xml') || ['js','css','html','xml','json','yaml','ini'].includes(ext);
        const isZip = ext === 'zip';

        let contentHtml = '';
        
        contentHtml += `<div class="preview-info-row"><span>Name</span> <span>${file.name}</span></div>`;
        contentHtml += `<div class="preview-info-row"><span>Size</span> <span>${formatBytes(file.size)}</span></div>`;
        contentHtml += `<div class="preview-info-row"><span>Type</span> <span>${type || ext}</span></div>`;
        
        if(isImg) {
            const url = URL.createObjectURL(blob);
            contentHtml += `<div style="margin-top:20px; text-align:center;"><img src="${url}" style="max-width:100%; max-height:200px; border:1px solid #333;"></div>`;
        } 
        else if (isVideo) {
             const url = URL.createObjectURL(blob);
             contentHtml += `<div style="margin-top:20px; text-align:center;">
                <video controls src="${url}" style="max-width:100%; max-height:200px; border:1px solid #333;"></video>
             </div>`;
        }
        else if (isAudio) {
             const url = URL.createObjectURL(blob);
             contentHtml += `<div style="margin-top:20px; text-align:center;">
                <audio controls src="${url}" style="width:100%; margin-top:10px;"></audio>
             </div>`;
        }
        else if (isZip) {
             contentHtml += `<div style="margin-top:20px; text-align:center; padding:10px; border:1px dashed var(--primary); color:var(--primary);">
                <div style="margin-bottom:10px; font-weight:bold;">This file can be extracted</div>
                <button class="btn-primary" onclick="explorerExtractZip()">Extract</button>
             </div>`;
        }
        else if(isText) {
            const text = await blob.text();
            contentHtml += `<div style="margin-top:10px; flex:1; display:flex; flex-direction:column; min-height:0;">
                <div style="font-size:11px; margin-bottom:5px; color:#aaa;">Editor</div>
                <div id="codeEditorContainer" style="flex:1; border:1px solid #333; overflow:hidden;"></div>
            </div>`;
            
            preview.innerHTML = contentHtml;
            
            // Initialize CodeMirror
            setTimeout(() => {
                const container = document.getElementById('codeEditorContainer');
                if(container) {
                    explorerEditor = CodeMirror(container, {
                        value: text,
                        mode: getCodeMirrorMode(file.name),
                        theme: 'default',
                        lineNumbers: true,
                        lineWrapping: true
                    });
                    explorerEditor.setSize("100%", "100%");
                }
            }, 100);
            return; 
        } else {
            contentHtml += `<div style="margin-top:20px; color:#888; text-align:center; padding:20px; border:1px dashed #444;">Binary File<br>Preview not available</div>`;
        }
        
        preview.innerHTML = contentHtml;
        explorerEditor = null; // No editor for binary

    } catch(e) {
        preview.innerHTML = `<div style="color:red">Error loading preview: ${e.message}</div>`;
    }
}

async function explorerExtractZip() {
    if(!explorerActiveFile) return;
    
    const btn = event.target;
    const oldText = btn.innerText;
    btn.innerText = "Extracting...";
    btn.disabled = true;

    try {
        let blob = explorerActiveFile.blob;
        if(!blob && explorerActiveFile.data) {
            blob = await explorerActiveFile.data.async('blob');
        }
        
        const zip = await JSZip.loadAsync(blob);
        const folderName = explorerActiveFile.name.replace(/\.(zip|7z|rar)$/i, "");
        const targetBase = explorerCurrentPath ? (explorerCurrentPath + "/" + folderName) : folderName;

        for (let filename of Object.keys(zip.files)) {
            const entry = zip.files[filename];
            if(entry.dir) continue;
            
            // Construct full internal path
            const fullPath = targetBase + "/" + filename;
            
            explorerFiles.push({
                name: filename.split('/').pop(),
                path: fullPath,
                folderPath: fullPath.includes('/') ? fullPath.substring(0, fullPath.lastIndexOf('/')) : "",
                size: entry._data.uncompressedSize || 0,
                blob: await entry.async('blob'), 
                data: null
            });
        }
        
        alert("Extraction complete.");
        renderExplorerList();
        
        // Reset preview
        document.getElementById('explorerPreviewContent').innerHTML = '<div style="color:#666; text-align:center; margin-top:50px;">Select a file to view properties</div>';
        document.getElementById('previewActions').style.display = 'none';

    } catch(e) {
        alert("Extraction failed: " + e.message);
        btn.innerText = oldText;
        btn.disabled = false;
    }
}

function getMimeFromExt(name) {
    const ext = name.split('.').pop().toLowerCase();
    const map = {
        'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'gif': 'image/gif',
        'html': 'text/html', 'css': 'text/css', 'js': 'text/javascript', 'json': 'application/json',
        'txt': 'text/plain', 'md': 'text/markdown',
        'mp4': 'video/mp4', 'webm': 'video/webm', 'ogv': 'video/ogg',
        'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg', 'flac': 'audio/flac',
        'xml': 'text/xml', 'yaml': 'text/yaml', 'ini': 'text/plain', 'zip': 'application/zip'
    };
    return map[ext] || 'application/octet-stream';
}

function getCodeMirrorMode(name) {
    const ext = name.split('.').pop().toLowerCase();
    if(ext === 'html') return 'htmlmixed';
    if(ext === 'js') return 'javascript';
    if(ext === 'css') return 'css';
    if(ext === 'json') return 'javascript';
    if(ext === 'xml') return 'xml';
    return 'null';
}

function explorerUpload() {
    if(explorerGame === null) {
        alert("You are at the Library Root. Please select 'Add Game' in the main menu to add files here.");
        return;
    }

    const input = document.getElementById('explorerFileInput');
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        
        // Calculate path based on current folder
        let newPath = file.name;
        if(explorerCurrentPath !== "") {
            newPath = explorerCurrentPath + "/" + file.name;
        }

        // Add to array
        const exists = explorerFiles.find(f => f.path === newPath);
        if(exists) {
            if(!confirm(`Overwrite ${file.name}?`)) return;
            // Update
            exists.size = file.size;
            exists.blob = file;
            exists.data = null; // Clear zip ref
        } else {
            explorerFiles.push({
                name: file.name,
                path: newPath,
                folderPath: explorerCurrentPath,
                size: file.size,
                blob: file,
                data: null
            });
        }
        renderExplorerList();
        input.value = '';
    };
    input.click();
}

function explorerCreateFile() {
    if(explorerGame === null) return alert("Cannot create files in Root.");

    const name = prompt("Enter filename (e.g. script.js):");
    if(!name) return;
    
    let newPath = name;
    if(explorerCurrentPath !== "") {
        newPath = explorerCurrentPath + "/" + name;
    }

    if(explorerFiles.some(f => f.path === newPath)) return alert("File exists.");
    
    explorerFiles.push({
        name: name,
        path: newPath,
        folderPath: explorerCurrentPath,
        size: 0,
        blob: new Blob([""], {type:'text/plain'}),
        data: null
    });
    renderExplorerList();
}

function explorerCreateFolder() {
    if(explorerGame === null) return alert("Cannot create folders in Root.");
    const name = prompt("Enter folder name:");
    if(!name) return;
    
    const cleanName = name.replace(/[^a-zA-Z0-9_\-\. ]/g, "");
    if(!cleanName) return;

    let newPath = cleanName;
    if(explorerCurrentPath !== "") newPath = explorerCurrentPath + "/" + cleanName;
    
    // Add a placeholder file to hold the folder structure
    explorerFiles.push({
        name: ".keep",
        path: newPath + "/.keep",
        folderPath: newPath,
        size: 0,
        blob: new Blob([""], {type:'text/plain'}),
        data: null
    });
    renderExplorerList();
}

function explorerDeleteFile() {
    if(!explorerActiveFile) return;
    if(!confirm(`Delete ${explorerActiveFile.name}?`)) return;
    
    explorerFiles = explorerFiles.filter(f => f !== explorerActiveFile);
    explorerActiveFile = null;
    document.getElementById('explorerPreviewContent').innerHTML = '<div style="color:#666; text-align:center; margin-top:50px;">Select a file to view properties</div>';
    document.getElementById('previewActions').style.display = 'none';
    renderExplorerList();
}

async function explorerSaveFile() {
    if(!explorerActiveFile) return;
    
    if(explorerEditor) {
        const txt = explorerEditor.getValue();
        
        // --- ENFORCE HTML5 TITLE LOGIC HERE FOR EDITS ---
        let finalTxt = txt;
        if(explorerActiveFile.name.endsWith('.html') || explorerActiveFile.name.endsWith('.htm')) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(txt, 'text/html');
            const titleTag = doc.querySelector('title');
            
            if(titleTag) {
                if(titleTag.innerText !== 'EMUDB') {
                     finalTxt = txt.replace(/<title>.*?<\/title>/i, '<title>EMUDB</title>');
                }
            } else {
                 if(finalTxt.includes('<head>')) {
                     finalTxt = finalTxt.replace('<head>', '<head>\n    <title>EMUDB</title>');
                 } else {
                     finalTxt = `<!DOCTYPE html>\n<html>\n<head><title>EMUDB</title></head>\n<body>${finalTxt}</body>\n</html>`;
                 }
            }
        }

        const newBlob = new Blob([finalTxt], { type: getMimeFromExt(explorerActiveFile.name) });
        explorerActiveFile.blob = newBlob;
        explorerActiveFile.size = newBlob.size;
        explorerActiveFile.data = null; 
        alert("File Updated in Memory. Click 'Save to Library' to persist.");
        
        renderExplorerList();
        selectExplorerFile(explorerActiveFile, document.querySelector('.active-row'));
    }
}
window.explorerPersist = async function(event) {
    if(explorerGame === null) return;
    
    // Safely handle the button state
    const btn = event ? event.target : document.querySelector('.modal-footer .btn-primary');
    let oldText = "Save to Library";
    if(btn) {
        oldText = btn.innerText;
        btn.innerText = "Packing... (Please Wait)";
        btn.disabled = true;
    }

    try {
        if(explorerFiles.length === 1 && !explorerFiles[0].name.endsWith('.zip')) {
            // Single file game
            const f = explorerFiles[0];
            const blob = f.blob ? f.blob : await f.data.async('blob');
            explorerGame.blob = blob;
            explorerGame.size = blob.size;
            
            if(f.name.endsWith('.html')) {
                const txt = await blob.text();
                 if(!txt.includes('<title>EMUDB</title>')) {
                      const fixed = txt.includes('<title>') 
                          ? txt.replace(/<title>.*?<\/title>/i, '<title>EMUDB</title>')
                          : txt.replace('<head>', '<head><title>EMUDB</title>');
                      explorerGame.blob = new Blob([fixed], {type:'text/html'});
                 }
            }
        } else {
            // Zip packaging
            const JSZip = window.JSZip;
            const zip = new JSZip();
            
            for(const f of explorerFiles) {
                if(f.name === '.keep') continue; // Skip placeholder folders
                const content = f.blob ? f.blob : await f.data.async('blob');
                zip.file(f.path, content); 
            }
            
            // MEMORY FIX: Use "STORE" to prevent compression OOM crashes
            const zipBlob = await zip.generateAsync({
                type: "blob",
                compression: "STORE" 
            });
            
            explorerGame.blob = zipBlob;
            explorerGame.size = zipBlob.size;
        }
        
        await db.addGame(explorerGame);
        alert("Library Updated Successfully!");
        closeModal('explorerModal');
        renderLibrary();

    } catch(e) {
        alert("Error saving: " + e.message + "\n\nIf this was a very large file, your browser may not have enough memory to repackage it.");
    } finally {
        if(btn) {
            btn.innerText = oldText;
            btn.disabled = false;
        }
    }
};

/* ───────── STORE RENDERER ───────── */
async function renderStore() {
    const grid = document.getElementById('storeGrid');
    grid.innerHTML = '<div class="loading-spinner">Loading Store...</div>';
    
    try {
        const response = await fetch(config.storeUrl);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        grid.innerHTML = ''; 

        if (!data.length) {
            grid.innerHTML = '<div>No items found in store.</div>';
            return;
        }

        data.forEach(game => {
            const card = document.createElement('div');
            card.className = 'store-card'; 
            
            const rawCore = game.coreSet || game.coresSet || game.system || game.core || 'Unknown';
            const displayCore = getSystemDisplayName(rawCore) || rawCore;

            card.innerHTML = `
                <div class="store-info">
                    <div class="store-title" title="${game.name}">${game.name}</div>
                    <div class="store-core">${displayCore}</div>
                </div>
                <button class="store-install-btn" onclick="handleStoreInstall('${game.url}', '${game.name}', '${rawCore}')">
                    Install
                </button>
            `;
            grid.appendChild(card);
        });

    } catch (error) {
        console.error('Store Error:', error);
        grid.innerHTML = `<div style="color:#ff5555">Error loading store: ${error.message}</div>`;
    }
}

async function handleStoreInstall(url, name, system) {
    if(!confirm(`Install ${name}?`)) return;
    
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "Installing...";
    btn.disabled = true;

    try {
        const res = await fetch(url);
        const blob = await res.blob();
        let filename = url.split('/').pop();
        if(filename.includes('?')) filename = filename.split('?')[0];
        if(!filename || filename.length < 2) filename = name + ".bin";

        await handleFiles([new File([blob], filename)]); 
        
        btn.innerText = "Installed!";
        setTimeout(() => {
            btn.innerText = originalText;
            btn.disabled = false;
        }, 2000);
    } catch(e) {
        alert("Install failed: " + e.message);
        btn.innerText = "Error";
        setTimeout(() => {
            btn.innerText = originalText;
            btn.disabled = false;
        }, 2000);
    }
}

/* ───────── MANUAL VIEWER ───────── */
function openManual(url) {
    if (!url) return;
    openModal('manualModal');

    const frame = document.getElementById('manualFrame');
    const btn = document.getElementById('btnManualFloating');
    const msgContainer = document.querySelector('.manual-fallback-msg');

    frame.src = "about:blank";
    frame.style.display = 'none'; 
    btn.onclick = () => window.open(url, '_blank');

    const lower = url.toLowerCase();
    const isPdf = lower.endsWith('.pdf');
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/.test(lower);

    if (isPdf) {
        frame.style.display = 'block';
        frame.src = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
        updateFallbackMessage("Loading PDF...");
    } 
    else if (isImage) {
        frame.style.display = 'block';
        frame.src = url;
        updateFallbackMessage("Loading Image...");
    } 
    else {
        frame.style.display = 'none';
        updateFallbackMessage("oh noes", "This site cannot be embedded. Thats pretty sad.");
    }
}

function updateFallbackMessage(title, subtitle) {
    const el = document.querySelector('.manual-fallback-msg');
    if(!el) return;
    if(!subtitle) subtitle = "If this doesn't load, use the button below.";
    el.innerHTML = `
        <div class="loader-spinner" style="font-size:40px; margin-bottom:10px;">>:3</div>
        <div style="font-weight:bold; font-size:18px;">${title}</div>
        <div style="font-size:12px; color:#888; margin-top:5px; max-width:300px;">${subtitle}</div>
    `;
}

/* ───────── SETTINGS MANAGER ───────── */
function saveSettings() {
  let customCssVal = document.getElementById('optCustomCss').value;
  if(window.cssEditor) {
      customCssVal = window.cssEditor.getValue();
  }

  const newConfig = {
    theme: document.getElementById('optTheme').value,
    saveInterval: parseInt(document.getElementById('optSaveInterval').value),
    dimReady: document.getElementById('optDimReady').checked,
    enableDebug: document.getElementById('optEmuDebug').checked,
    enableThreads: document.getElementById('optEmuThreads').checked,
    emuVersion: document.getElementById('optEmuVersion').value,
    autoUnzip: document.getElementById('optAutoUnzip').checked,
    autoHash: document.getElementById('optAutoHash').checked,
    resScale: parseFloat(document.getElementById('optResScale').value),
    metadataSource: document.getElementById('optMetadataSource').value,
    gDriveClientId: document.getElementById('gDriveClientId').value,
    gDriveApiKey: document.getElementById('gDriveApiKey').value,
    fullscreenOnLoad: document.getElementById('optFullscreen').checked,
    netplayUrl: document.getElementById('optNetplayUrl').value,
    dontExtractBios: document.getElementById('optDontExtractBios').checked,
    forceLegacyCores: document.getElementById('optLegacyCores').checked,
    customPaths: document.getElementById('optCustomPaths').value,
    loaderPath: document.getElementById('optLoaderPath').value,
    autoLoadSave: document.getElementById('optAutoLoad').checked,
    saveOnExit: document.getElementById('optSaveExit').checked,
    storeUrl: document.getElementById('optStoreUrl').value,
    videoFilters: {
        hue: document.getElementById('vidHue').value,
        saturation: document.getElementById('vidSaturation').value,
        brightness: document.getElementById('vidBrightness').value,
        contrast: document.getElementById('vidContrast').value,
        sepia: document.getElementById('vidSepia').value,
        blur: document.getElementById('vidBlur').value,
        blendMode: document.getElementById('vidBlendMode').value
    },
    customCss: customCssVal
  };

  config = { ...config, ...newConfig };
  localStorage.setItem('emu_config', JSON.stringify(config));
  
  applyTheme();
  applyVideoFilters();
  applyCustomCss();
  refreshCoreDropdowns(); 
  closeModal('settingsModal');
}

function loadConfig() {
  const s = localStorage.getItem('emu_config');
  if(s) {
      const loaded = JSON.parse(s);
      config = { ...config, ...loaded };
      if(loaded.videoFilters) {
          config.videoFilters = { ...config.videoFilters, ...loaded.videoFilters };
      }
      if(loaded.customCores) {
          config.customCores = loaded.customCores;
      }
  }
  applyTheme();
  applyVideoFilters(); 
  applyCustomCss();
}

function applyTheme() {
  document.documentElement.style.setProperty('--primary', config.theme);
}

function applyCustomCss() {
    document.getElementById('custom-css-injector').innerHTML = config.customCss || '';
}

/* ───────── VIDEO FILTERS ───────── */
function updateVideoPreview() {
    const h = document.getElementById('vidHue').value;
    const s = document.getElementById('vidSaturation').value;
    const b = document.getElementById('vidBrightness').value;
    const c = document.getElementById('vidContrast').value;
    const sep = document.getElementById('vidSepia').value;
    const bl = document.getElementById('vidBlur').value;
    const blend = document.getElementById('vidBlendMode').value;

    document.getElementById('valHue').innerText = h + 'deg';
    document.getElementById('valSat').innerText = s + '%';
    document.getElementById('valBright').innerText = b + '%';
    document.getElementById('valContrast').innerText = c + '%';
    document.getElementById('valSepia').innerText = sep + '%';
    document.getElementById('valBlur').innerText = bl + 'px';

    const filterString = `hue-rotate(${h}deg) saturate(${s}%) brightness(${b}%) contrast(${c}%) sepia(${sep}%) blur(${bl}px)`;
    
    const box = document.getElementById('videoPreviewBox');
    box.style.filter = filterString;
    box.style.mixBlendMode = blend;
    
    const emuGame = document.getElementById('game');
    if(emuGame) {
        emuGame.style.filter = filterString;
        emuGame.style.mixBlendMode = blend;
    }
}

function applyVideoFilters() {
    if(!config.videoFilters) return;
    const f = config.videoFilters;
    const filterString = `hue-rotate(${f.hue}deg) saturate(${f.saturation}%) brightness(${f.brightness}%) contrast(${f.contrast}%) sepia(${f.sepia}%) blur(${f.blur}px)`;
    
    const game = document.getElementById('game');
    if(game) {
        game.style.filter = filterString;
        game.style.mixBlendMode = f.blendMode || 'normal';
    }
}

function resetVideoSettings() {
    document.getElementById('vidHue').value = 0;
    document.getElementById('vidSaturation').value = 100;
    document.getElementById('vidBrightness').value = 100;
    document.getElementById('vidContrast').value = 100;
    document.getElementById('vidSepia').value = 0;
    document.getElementById('vidBlur').value = 0;
    document.getElementById('vidBlendMode').value = 'normal';
    updateVideoPreview();
}

/* ───────── CONTROL MAPPING UI ───────── */
const BUTTON_LABELS = {
    0: 'B', 1: 'A', 2: 'Y', 3: 'X', 4: 'L', 5: 'R', 6: 'L2', 7: 'R2',
    8: 'Select', 9: 'Start', 10: 'L3', 11: 'R3', 12: 'Up', 13: 'Down', 14: 'Left', 15: 'Right'
};

let currentControls = {};

function openControlsModal() {
    try {
        currentControls = config.controlMapping ? JSON.parse(config.controlMapping) : {};
    } catch(e) { currentControls = {}; }
    
    document.getElementById('controlPlayerSelect').value = "0";
    renderControlList();
    openModal('controlsModal');
}

function renderControlList() {
    const p = document.getElementById('controlPlayerSelect').value;
    const list = document.getElementById('controlList');
    list.innerHTML = '';

    if(!currentControls[p]) currentControls[p] = {};

    Object.keys(BUTTON_LABELS).forEach(btnId => {
        const row = document.createElement('div');
        row.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#222; padding:5px; border:1px solid #333;";
        
        const keyVal = currentControls[p][btnId] || '';
        
        row.innerHTML = `
            <span style="font-size:14px; width:80px;">${BUTTON_LABELS[btnId]}</span>
            <input type="text" class="form-control" style="margin:0; width:150px; text-align:center;" value="${keyVal}" readonly placeholder="Press Key..." id="ctrl-${p}-${btnId}">
            <button class="btn-small" onclick="clearControl('${p}', '${btnId}')">${getIcon('close')}</button>
        `;
        
        const input = row.querySelector('input');
        input.onkeydown = (e) => {
            e.preventDefault();
            input.value = e.key;
            currentControls[p][btnId] = e.key;
        };
        
        list.appendChild(row);
    });
}

function clearControl(p, btnId) {
    if(currentControls[p]) delete currentControls[p][btnId];
    renderControlList();
}

function saveControlsFromUI() {
    config.controlMapping = JSON.stringify(currentControls);
    saveSettings(); 
    closeModal('controlsModal');
}

/* ───────── CUSTOM CORE UI ───────── */
function renderCustomCoreList() {
    const list = document.getElementById('customCoreList');
    list.innerHTML = '';
    if(!config.customCores || config.customCores.length === 0) {
        list.innerHTML = '<div style="font-size:12px; color:#888;">No custom cores defined.</div>';
        return;
    }
    config.customCores.forEach((c, idx) => {
        const div = document.createElement('div');
        div.className = 'bios-list-item';
        div.innerHTML = `<span>${c.name} (${c.id})</span><span style="color:#ff4444;cursor:pointer" onclick="removeCustomCore(${idx})">${getIcon('close')}</span>`;
        list.appendChild(div);
    });
}

function addCustomCore() {
    const name = document.getElementById('newCoreName').value.trim();
    const id = document.getElementById('newCoreId').value.trim();
    if(!name || !id) return alert("Enter both Name and Core ID.");
    
    if(!config.customCores) config.customCores = [];
    config.customCores.push({ name: name, id: id });
    document.getElementById('newCoreName').value = '';
    document.getElementById('newCoreId').value = '';
    renderCustomCoreList();
}

function removeCustomCore(index) {
    if(!confirm("Remove this core mapping?")) return;
    config.customCores.splice(index, 1);
    renderCustomCoreList();
}

/* ───────── BIOS MANAGER ───────── */
async function renderBiosList() {
    const sys = document.getElementById('biosSystemSelect').value;
    const container = document.getElementById('biosListContainer');
    container.innerHTML = '<div style="color:#666; font-size:11px; padding:5px; text-align:center;">Loading...</div>';
    
    if(!sys) return;
    const data = await db.getBiosEntry(sys);
    container.innerHTML = '';
    
    if(!data || !data.files || data.files.length === 0) {
        container.innerHTML = '<div style="color:#666; font-size:11px; padding:5px; text-align:center;">No BIOS files found for this system.</div>';
        return;
    }

    data.files.forEach(f => {
        const div = document.createElement('div');
        div.className = 'bios-list-item';
        div.innerHTML = `<span>${f.name}</span><span style="color:#ff4444; cursor:pointer;" onclick="removeBios('${sys}', '${f.name}')">${getIcon('delete')}</span>`;
        container.appendChild(div);
    });
}

function triggerBiosUpload() {
    const sys = document.getElementById('biosSystemSelect').value;
    if(!sys) return alert("Select a system first.");
    document.getElementById('biosInput').click();
}

async function removeBios(sys, name) {
    if(confirm(`Delete BIOS: ${name}?`)) {
        await db.removeBiosFile(sys, name);
        renderBiosList();
    }
}

/* ───────── PATCH MANAGER UI ───────── */
function renderPatchList(game) {
    const list = document.getElementById('patchList');
    list.innerHTML = '';
    if(!game.patches || game.patches.length === 0) {
        list.innerHTML = '<div style="color:#666; font-size:12px;">No patches.</div>';
        return;
    }
    game.patches.forEach(p => {
        const div = document.createElement('div');
        div.className = 'bios-list-item';
        div.innerHTML = `<span>${p.name}</span><span style="color:#ff4444;cursor:pointer" onclick="deletePatch('${game.id}', '${p.id}')">${getIcon('delete')}</span>`;
        list.appendChild(div);
    });
}
async function deletePatch(gameId, patchId) {
    const g = library.find(x => x.id === gameId);
    g.patches = g.patches.filter(x => x.id !== patchId);
    await db.addGame(g);
    renderPatchList(g);
}

/* ───────── SAVE MANAGER UI ───────── */
async function openSaveManager() {
    const list = document.getElementById('savesList');
    list.innerHTML = 'Loading...';
    
    const dbSaves = await db.getAllSaves();
    
    list.innerHTML = '';
    
    if(dbSaves.length === 0) {
        list.innerHTML = '<div style="color:#888; text-align:center;">No save states found in database.</div>';
        return;
    }

    dbSaves.forEach(s => {
        const game = library.find(g => g.id === s.gameId);
        const title = game ? game.title : s.gameId;
        const date = new Date(s.date).toLocaleString();
        
        const div = document.createElement('div');
        div.className = 'save-item';
        div.innerHTML = `
            <div>
               <div style="font-weight:bold; color:#fff;">${title}</div>
               <div class="save-meta">${date}</div>
            </div>
            <button class="btn-danger" onclick="deleteDbSave('${s.gameId}')">${getIcon('delete')}</button>
        `;
        list.appendChild(div);
    });

    closeModal('settingsModal');
    openModal('savesModal');
}

async function deleteDbSave(gameId) {
    if(confirm("Delete this save state?")) {
        await db.deleteSaveState(gameId);
        openSaveManager(); 
        updateStorageMeter();
    }
}