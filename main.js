/* ───────── INIT & EVENTS ───────── */

window.onload = async () => {
  loadConfig();
  if (!window.crossOriginIsolated) {
      console.warn("SharedArrayBuffer not available. Threads disabled.");
      config.enableThreads = false;
  }

  document.getElementById('loadStatus').innerText = "Loading Library from Database...";
  await db.init();
  library = await db.getAllGames();
  refreshCoreDropdowns(); 
  renderCustomCoreList(); // Initialize custom core list
  updateFilterDropdown();
  renderLibrary();
  setTimeout(()=>document.getElementById('loadingOverlay').classList.add('hidden'), 500);
  updateStorageMeter();
  
  if(navigator.onLine && config.autoHash) {
    scanForMissingArtwork();
  }
  
  setupDragAndDrop();
};

/* ───────── EVENT LISTENERS ───────── */
document.getElementById('btnHome').onclick = () => {
  document.getElementById('emulator').style.display = 'none';
  
  // HIDE STORE PROPERLY
  const store = document.getElementById('store');
  if(store) {
      store.style.display = 'none';
      store.classList.add('hidden'); 
  }
  
  document.getElementById('home').style.display = 'block';
  
  document.querySelectorAll('.tb-item').forEach(e => e.classList.remove('active'));
  document.getElementById('btnHome').classList.add('active');
  
  document.getElementById('topbar').classList.remove('dimmed');
  
  const gameDiv = document.getElementById('game');
  
  // FIX: Force Termination of EJS
  if (window.EJS_emulator && window.EJS_emulator.destroy) window.EJS_emulator.destroy();
  if (window.EJS_terminate) window.EJS_terminate();
  window.EJS_emulator = null;
  window.EJS_onGameExit = null;

  gameDiv.innerHTML = ''; // Force clear DOM

  renderLibrary();
};

document.getElementById('btnStore').onclick = () => {
    document.getElementById('emulator').style.display = 'none';
    document.getElementById('home').style.display = 'none';
    
    // SHOW STORE PROPERLY
    const store = document.getElementById('store');
    if(store) {
        store.classList.remove('hidden'); // This overrides the CSS !important
        store.style.display = 'block';
    }
    
    document.querySelectorAll('.tb-item').forEach(e => e.classList.remove('active'));
    document.getElementById('btnStore').classList.add('active');
    
    document.getElementById('topbar').classList.remove('dimmed');
    
    
    // RENDER
    if(typeof renderStore === 'function') {
        renderStore();
    } else {
        console.error("renderStore function missing from ui.js");
    }
};

document.getElementById('fileInput').onchange = (e) => handleFiles(e.target.files);

document.getElementById('filterSearch').oninput = renderLibrary;

document.getElementById('btnSettings').onclick = async () => {
  // Populate Appearance
  document.getElementById('optTheme').value = config.theme;
  document.getElementById('optDimReady').checked = config.dimReady;
  
  // Populate General
  document.getElementById('optSaveInterval').value = config.saveInterval;
  document.getElementById('optAutoUnzip').checked = config.autoUnzip;
  document.getElementById('optAutoHash').checked = config.autoHash;
  document.getElementById('optMetadataSource').value = config.metadataSource || 'libretro';
  document.getElementById('optStoreUrl').value = config.storeUrl || '';

  // Populate Emulation
  document.getElementById('optEmuDebug').checked = config.enableDebug;
  document.getElementById('optEmuThreads').checked = config.enableThreads;
  if (!window.crossOriginIsolated) document.getElementById('optEmuThreads').disabled = true;
  document.getElementById('optEmuVersion').value = config.emuVersion;
  document.getElementById('optFullscreen').checked = config.fullscreenOnLoad;
  document.getElementById('optNetplayUrl').value = config.netplayUrl;
  document.getElementById('optDontExtractBios').checked = config.dontExtractBios;
  document.getElementById('optLegacyCores').checked = config.forceLegacyCores;
  document.getElementById('optResScale').value = config.resScale || 1.0;
  
  // New: Loader & Paths
  document.getElementById('optCustomPaths').value = config.customPaths || '';
  document.getElementById('optLoaderPath').value = config.loaderPath || '';
  
  renderCustomCoreList();

  // Populate Video
  if(config.videoFilters) {
      document.getElementById('vidHue').value = config.videoFilters.hue;
      document.getElementById('vidSaturation').value = config.videoFilters.saturation;
      document.getElementById('vidBrightness').value = config.videoFilters.brightness;
      document.getElementById('vidContrast').value = config.videoFilters.contrast;
      document.getElementById('vidSepia').value = config.videoFilters.sepia;
      document.getElementById('vidBlur').value = config.videoFilters.blur;
      document.getElementById('vidBlendMode').value = config.videoFilters.blendMode || 'normal';
      updateVideoPreview();
  }

  // --- CSS EDITOR INITIALIZATION ---
  const cssTextarea = document.getElementById('optCustomCss');
  let startVal = config.customCss || '';
  
  // If no custom CSS, try to fetch the default style.css for the user to edit
  if(!startVal) {
      try {
          const res = await fetch('css/style.css');
          if(res.ok) {
              startVal = await res.text();
              startVal = "" + startVal;
          }
      } catch(e) { console.log("Could not load default css", e); }
  }

  cssTextarea.value = startVal;

  if(!window.cssEditor && window.CodeMirror) {
      window.cssEditor = CodeMirror.fromTextArea(cssTextarea, {
          mode: 'css',
          theme: 'default',
          lineNumbers: true,
          lineWrapping: true
      });
  } else if(window.cssEditor) {
      window.cssEditor.setValue(startVal);
      // Refresh needed because modal was hidden
      setTimeout(() => window.cssEditor.refresh(), 200);
  }
  // ---------------------------------

  document.getElementById('optAutoLoad').checked = config.autoLoadSave;
  document.getElementById('optSaveExit').checked = config.saveOnExit;

  // Populate Data/Drive
  document.getElementById('gDriveClientId').value = config.gDriveClientId || '';
  document.getElementById('gDriveApiKey').value = config.gDriveApiKey || '';
  
  document.getElementById('biosSystemSelect').value = ""; 
  document.getElementById('biosListContainer').innerHTML = "";
  
  updateStorageMeter();
  
  switchTab('tabGeneral');
  openModal('settingsModal');
  
  // Refresh editor again after tab switch ensures it renders correctly
  if(window.cssEditor) setTimeout(() => window.cssEditor.refresh(), 100);
};

document.getElementById('biosInput').onchange = async (e) => {
    const file = e.target.files[0];
    const sys = document.getElementById('biosSystemSelect').value;
    if(!file || !sys) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
        await db.addBios(sys, new Blob([evt.target.result]), file.name);
        renderBiosList();
    };
    reader.readAsArrayBuffer(file);
};

document.getElementById('patchInput').onchange = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const id = document.getElementById('patchGameId').value;
    const g = library.find(x => x.id === id);
    if(!g.patches) g.patches = [];
    g.patches.push({ id: crypto.randomUUID(), name: file.name, blob: file });
    await db.addGame(g);
    renderPatchList(g);
    renderLibrary(); 
};