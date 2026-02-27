/* ───────── LAUNCHER & EMULATOR ───────── */
let pendingLaunchGame = null;
let pendingLaunchPatch = null;
let activeBlobs = []; 

const CORE_FALLBACKS = {
    'segaMD': ['picodrive', 'genesis_plus_gx'],
    'snes': ['snes9x', 'snes9x2010'],
    'nes': ['fceumm', 'nestopia'],
    'gb': ['gambatte', 'mgba'],
    'gba': ['mgba', 'vba-m'],
    'n64': ['mupen64plus_next', 'parallel_n64'],
    'psx': ['pcsx_rearmed', 'mednafen_psx_hw'],
    'nds': ['melonds', 'desmume']
};

const MODERN_ENGINES = ['unity', 'godot', 'clickteam', 'emscripten', 'flash'];

async function prepareLaunch(game) {
    if(!game.blob && !game.url) {
        alert("Error: Game file (Blob) is missing. Try deleting and re-importing the game.");
        return;
    }

    if (MODERN_ENGINES.includes(game.system)) {
        if(game.system === 'flash') {
            launchFlashGame(game); 
        } else {
            launchModernWebGame(game);
        }
        return;
    }

    const hasPatches = game.patches && game.patches.length > 0;
    const biosData = await db.getBiosEntry(game.system);
    const hasMultiBios = biosData && biosData.files && biosData.files.length > 0; 

    if(!hasPatches && !hasMultiBios) {
        launchGame(game, null, null);
        return;
    }
    
    pendingLaunchGame = game;
    pendingLaunchPatch = null;
    openModal('launchModal');
    
    const verDiv = document.getElementById('launchVersions');
    verDiv.innerHTML = '';
    
    const btnV = document.createElement('div');
    btnV.className = 'bios-list-item'; 
    btnV.style.cursor = 'pointer';
    btnV.style.justifyContent = 'center';
    btnV.innerText = "Play Original (No Patch)";
    btnV.onclick = () => selectVersion(null);
    verDiv.appendChild(btnV);

    if(hasPatches) {
        game.patches.forEach(p => {
             const btn = document.createElement('div');
             btn.className = 'bios-list-item';
             btn.style.cursor = 'pointer';
             btn.style.justifyContent = 'center';
             btn.innerText = `Play Patch: ${p.name}`;
             btn.onclick = () => selectVersion(p);
             verDiv.appendChild(btn);
        });
    }

    document.getElementById('launchStep1').classList.remove('hidden');
    document.getElementById('launchStep2').classList.add('hidden');
    
    if(!hasPatches) selectVersion(null); 
}

async function selectVersion(patchObj) {
    pendingLaunchPatch = patchObj;
    const game = pendingLaunchGame;
    const biosData = await db.getBiosEntry(game.system);
    
    if(biosData && biosData.files && biosData.files.length > 0) {
        document.getElementById('launchStep1').classList.add('hidden');
        document.getElementById('launchStep2').classList.remove('hidden');
        
        const bList = document.getElementById('launchBiosList');
        bList.innerHTML = '';
        
        const noBiosBtn = document.createElement('div');
        noBiosBtn.className = 'bios-list-item';
        noBiosBtn.style.cursor = 'pointer';
        noBiosBtn.style.justifyContent = 'center';
        noBiosBtn.style.color = '#aaa';
        noBiosBtn.innerText = "Start without BIOS";
        noBiosBtn.onclick = () => {
             closeModal('launchModal');
             launchGame(pendingLaunchGame, pendingLaunchPatch, null);
        };
        bList.appendChild(noBiosBtn);
        
        biosData.files.forEach(b => {
             const btn = document.createElement('div');
             btn.className = 'bios-list-item';
             btn.style.cursor = 'pointer';
             btn.style.justifyContent = 'center';
             btn.innerText = b.name;
             btn.onclick = () => {
                 closeModal('launchModal');
                 launchGame(pendingLaunchGame, pendingLaunchPatch, b);
             };
             bList.appendChild(btn);
        });
    } else {
        closeModal('launchModal');
        launchGame(pendingLaunchGame, pendingLaunchPatch, null);
    }
}

// ─────────────────────────────────────────────────────────────
// FLASH / RUFFLE LAUNCHER
// ─────────────────────────────────────────────────────────────
async function launchFlashGame(game) {
    const home = document.getElementById('home');
    const store = document.getElementById('store');
    const emu = document.getElementById('emulator');
    const container = document.getElementById('game');

    home.style.display = 'none';
    if(store) store.style.display = 'none';
    emu.style.display = 'flex';
    document.getElementById('btnHome').classList.remove('active');
    
    container.innerHTML = `<div id="ruffle-container" style="width:100%;height:100%;"></div>`;
    
    if (!window.RufflePlayer) {
        const script = document.createElement("script");
        script.src = "https://unpkg.com/@ruffle-rs/ruffle";
        script.onload = () => {
            startRuffle(game);
        };
        document.body.appendChild(script);
    } else {
        startRuffle(game);
    }
}

function startRuffle(game) {
    const ruffle = window.RufflePlayer.newest();
    const player = ruffle.createPlayer();
    const container = document.getElementById('ruffle-container');
    container.appendChild(player);
    
    const blobUrl = URL.createObjectURL(game.blob);
    activeBlobs.push(blobUrl);

    player.load({
        url: blobUrl,
        backgroundColor: "#000000",
        allowScriptAccess: true
    });
    
    player.style.width = "100%";
    player.style.height = "100%";
    
    if(config.dimReady) {
        setTimeout(() => { document.getElementById('topbar').classList.add('dimmed'); }, 2000);
    }
}

// ─────────────────────────────────────────────────────────────
// MODERN WEB GAME LAUNCHER (Unity, Godot, etc.)
// ─────────────────────────────────────────────────────────────
async function launchModernWebGame(game) {
    const home = document.getElementById('home');
    const store = document.getElementById('store');
    const emu = document.getElementById('emulator');
    const loader = document.getElementById('loadingOverlay');
    const status = document.getElementById('loadStatus');
    
    home.style.display = 'none';
    if(store) store.style.display = 'none';
    loader.classList.remove('hidden');
    status.innerText = "Extracting Package...";

    let files = [];
    let entryFile = null;
    let htmlFiles = []; // Track all HTML files found
    
try {
    const zip = await JSZip.loadAsync(game.blob);
    const fileKeys = Object.keys(zip.files);

    const firstFile = fileKeys[0];
    const rootDir = firstFile.includes('/') ? firstFile.split('/')[0] + '/' : '';
    const isRooted = fileKeys.every(k => k.startsWith(rootDir));

    for (const filename of fileKeys) {
        const entry = zip.files[filename];
        if(entry.dir) continue;
        
        let relativePath = filename;
        if(isRooted && rootDir) {
            relativePath = filename.substring(rootDir.length);
        }

        relativePath = relativePath.replace(/^\//, ''); 

        const blob = await entry.async('blob');
        
        // --- ENFORCE HTML5 TITLE & TRACK HTML FILES ---
        if(relativePath.toLowerCase().endsWith('.html') || relativePath.toLowerCase().endsWith('.htm')) {
            htmlFiles.push(relativePath);
            
            if(relativePath.toLowerCase().endsWith('index.html')) {
                entryFile = relativePath;
            }

            let txt = await blob.text();
            let modified = false;

            if(txt.includes('<title>')) {
                txt = txt.replace(/<title>.*?<\/title>/i, '<title>EMUDB</title>');
                modified = true;
            } else {
                if(txt.includes('<head>')) {
                    txt = txt.replace('<head>', '<head>\n<title>EMUDB</title>');
                    modified = true;
                } else {
                    txt = `<!DOCTYPE html><html><head><title>EMUDB</title></head><body>${txt}</body></html>`;
                    modified = true;
                }
            }
            
            if(modified) {
                files.push({ path: relativePath, blob: new Blob([txt], {type: 'text/html'}) });
                continue; 
            }
        }

        files.push({ path: relativePath, blob: blob });
    }

        // --- HTML ENTRY FILE SELECTION (IF NO INDEX.HTML) ---
        if (!entryFile && htmlFiles.length > 0) {
            if (htmlFiles.length === 1) {
                entryFile = htmlFiles[0]; // Auto-select if only 1 HTML file exists
            } else {
                // Wait for user to select the correct HTML file
                entryFile = await new Promise((resolve) => {
                    const list = document.getElementById('htmlSelectList');
                    if(!list) return resolve(htmlFiles[0]); // Fallback if UI is missing
                    
                    list.innerHTML = '';
                    htmlFiles.forEach(hf => {
                        const btn = document.createElement('button');
                        btn.className = 'btn-primary';
                        btn.style.width = '100%';
                        btn.style.textAlign = 'left';
                        btn.style.marginBottom = '5px';
                        btn.innerText = hf;
                        btn.onclick = () => {
                            closeModal('htmlSelectModal');
                            resolve(hf);
                        };
                        list.appendChild(btn);
                    });
                    
                    // Pause loader to let user select
                    loader.classList.add('hidden');
                    openModal('htmlSelectModal');
                });
                // Resume loader
                loader.classList.remove('hidden');
                status.innerText = "Applying configuration...";
            }
        }

        // --- AUTO-GENERATION LOGIC FOR UNITY ---
        if (!entryFile && game.system === 'unity') {
            console.log("No index.html found. Attempting to auto-generate Unity launcher...");
            status.innerText = "Generating Unity Launcher...";

            const loaderFile = files.find(f => f.path.endsWith('.loader.js'));
            const dataFile = files.find(f => f.path.endsWith('.data.unityweb'));
            const wasmFile = files.find(f => f.path.endsWith('.wasm.unityweb'));
            const jsFile = files.find(f => f.path.endsWith('.js.unityweb') && !f.path.endsWith('.loader.js'));

            if (loaderFile && dataFile && wasmFile) {
                const generatedHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>EMUDB</title> <style>
        body { margin: 0; background: #000; overflow: hidden; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
        canvas { width: 100%; height: 100%; }
        #loading-cover { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #222; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; font-family: sans-serif; }
        .spinner { border: 4px solid rgba(255,255,255,0.1); border-left-color: #fff; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        #progress-bar { width: 200px; height: 10px; background: #000; margin-top: 20px; border-radius: 5px; overflow: hidden; }
        #progress-fill { width: 0%; height: 100%; background: #f76426; transition: width 0.2s; }
    </style>
</head>
<body>
    <canvas id="unity-canvas"></canvas>
    <div id="loading-cover">
        <div class="spinner"></div>
        <div id="progress-bar"><div id="progress-fill"></div></div>
        <p id="status-text">Loading...</p>
    </div>
    <script>
        const config = {
            dataUrl: "${dataFile.path}",
            frameworkUrl: "${jsFile ? jsFile.path : wasmFile.path.replace('.wasm.', '.framework.js.')}",
            codeUrl: "${wasmFile.path}",
            streamingAssetsUrl: "StreamingAssets",
            companyName: "EmulatorJS",
            productName: "${game.title || 'Unity Game'}",
            productVersion: "1.0",
        };

        const script = document.createElement("script");
        script.src = "${loaderFile.path}";
        script.onload = () => {
            createUnityInstance(document.querySelector("#unity-canvas"), config, (progress) => {
                document.querySelector("#progress-fill").style.width = (100 * progress) + "%";
            }).then((instance) => {
                document.querySelector("#loading-cover").style.display = "none";
            }).catch(alert);
        };
        document.body.appendChild(script);
    </script>
</body>
</html>`;
                entryFile = "index.html";
                files.push({ path: entryFile, blob: new Blob([generatedHtml], { type: 'text/html' }) });
            } else {
                throw new Error("Could not find Unity Build files (.loader.js, .data, .wasm) in zip.");
            }
        }

        if (!entryFile) throw new Error("No launchable HTML file found in archive and auto-generation failed.");

    } catch(e) {
        alert(`Launch Error: ${e.message}`);
        loader.classList.add('hidden');
        home.style.display = 'block';
        return;
    }

    // --- INJECT SAVE SHIM ---
    const existingSave = await db.readSaveState(game.id);
    let storageData = "{}";
    if(existingSave) try { storageData = await existingSave.text(); } catch(e) {}
    if (!storageData || typeof storageData !== 'string') storageData = "{}";
    const safeStorageData = JSON.stringify(storageData).replace(/<\/script/gi, '<\\/script');

    const indexIdx = files.findIndex(f => f.path === entryFile);
    let htmlContent = await files[indexIdx].blob.text();
    
    const shim = `
    <script>
        (function() {
        window.onerror = function(msg, url, line, col, error) {
            const errString = msg || (error && error.message) || "Unknown Error";
            window.parent.postMessage({ type: 'EMUDB_IFRAME_ERROR', message: errString }, '*');
            return false;
        };
        window.addEventListener('error', function(e) {
            if(e.target && (e.target.tagName === 'IMG' || e.target.tagName === 'SCRIPT')) {
                 const src = e.target.src || e.target.href;
                 if(src && !src.startsWith('blob:')) {
                    window.parent.postMessage({ type: 'EMUDB_IFRAME_ERROR', message: "Failed to load: " + src }, '*');
                 }
            }
        }, true);

            try {
                var payload = ${safeStorageData};
                var data = JSON.parse(payload);
                for (var k in data) { localStorage.setItem(k, data[k]); }
            } catch(e) { console.warn("EmuDB: Failed to inject save data", e); }

            var oldSet = localStorage.setItem;
            localStorage.setItem = function(k, v) {
                oldSet.apply(this, arguments);
                if(window.svT) clearTimeout(window.svT);
                window.svT = setTimeout(function() {
                    window.parent.postMessage({ type: 'EMUDB_SAVE_DATA', payload: JSON.stringify(localStorage) }, '*');
                }, 1000);
            };
        })();
    </script>`;
    
    htmlContent = htmlContent.replace('<head>', '<head>' + shim);
    files[indexIdx].blob = new Blob([htmlContent], {type: 'text/html'});

    // REGISTER WITH SERVICE WORKER - FIXED
    await waitForServiceWorker();

    const channel = new MessageChannel();
    channel.port1.onmessage = (e) => {
        if (e.data.success) finalizeModernLaunch(game, entryFile);
        else alert("VFS Registration Failed");
    };
    
    // Safety check for controller
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'REGISTER_FILES',
            id: game.id,
            files: files
        }, [channel.port2]);
    } else {
        alert("Service Worker not active. Reload the page.");
    }
}

// HELPER: Wait for Service Worker
async function waitForServiceWorker() {
    if (!('serviceWorker' in navigator)) throw new Error('Service Worker not supported');
    
    if (navigator.serviceWorker.controller) return;

    return new Promise(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
             resolve();
        }, {once: true});
        // Check if registration exists but not controlling
        navigator.serviceWorker.ready.then(() => {
             // Sometimes ready fires but controller is null if hard reload happened
             // This usually requires a reload claim
        });
    });
}

function finalizeModernLaunch(game, entryPath) {
    const container = document.getElementById('game');
    const emu = document.getElementById('emulator');
    const loader = document.getElementById('loadingOverlay');

    container.innerHTML = '';
    
    // Listener for Save Data
    if(!window.modernSaveListener) {
        window.modernSaveListener = async (e) => {
             if (e.data && e.data.type === 'EMUDB_SAVE_DATA') {
                const blob = new Blob([e.data.payload], {type: 'application/json'});
                if(window.EJS_gameID) await db.writeSaveState(window.EJS_gameID, blob);
            }
        };
        window.addEventListener('message', window.modernSaveListener);
    }

    window.EJS_gameID = game.id; 

    const iframe = document.createElement('iframe');
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.style.background = "#ffffff";
    iframe.allow = "autoplay; fullscreen; gamepad; accelerometer; gyroscope; cross-origin-isolated";
    iframe.src = `/vfs/${game.id}/${entryPath}`;
    
    container.appendChild(iframe);
    
    emu.style.display = 'flex';
    document.getElementById('btnHome').classList.remove('active');
    loader.classList.add('hidden');
    
    if(config.dimReady) {
        setTimeout(() => { document.getElementById('topbar').classList.add('dimmed'); }, 2000);
    }

if(!window.iframeErrorListener) {
    window.iframeErrorListener = (e) => {
        if(e.data && e.data.type === 'EMUDB_IFRAME_ERROR') {
            showErrorToast(e.data.message);
        }
    };
    window.addEventListener('message', window.iframeErrorListener);
}

}



function showErrorToast(msg) {
    let container = document.getElementById('error-toast-container');
    if(!container) {
        container = document.createElement('div');
        container.id = 'error-toast-container';
        container.style.cssText = "position:fixed; bottom:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:10px; max-width:300px;";
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.cssText = "background:rgba(255, 68, 68, 0.9); color:white; padding:12px; border-radius:4px; font-size:12px; font-family:sans-serif; box-shadow:0 4px 6px rgba(0,0,0,0.3); animation: fadeIn 0.3s ease;";
    toast.innerText = msg;
    
    const close = document.createElement('span');
    close.innerText = " ✕";
    close.style.cursor = "pointer";
    close.style.fontWeight = "bold";
    close.style.marginLeft = "10px";
    close.onclick = () => toast.remove();
    toast.appendChild(close);

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

const styleSheet = document.createElement("style");
styleSheet.innerText = "@keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }";
document.head.appendChild(styleSheet);

// ─────────────────────────────────────────────────────────────
// STANDARD EMULATOR LAUNCHER 
// ─────────────────────────────────────────────────────────────
async function launchGame(game, patchObj, biosObj) {
  if(game.system === 'webretro') {
      launchWebRetro(game);
      return;
  }

  const home = document.getElementById('home');
  const store = document.getElementById('store');
  const emu = document.getElementById('emulator');
  const container = document.getElementById('game');
  
  if (window.EJS_terminate) {
      try { window.EJS_terminate(); } catch(e) { console.warn("Termination skipped", e); }
  }
  if (window.EJS_emulator && window.EJS_emulator.destroy) {
      try { window.EJS_emulator.destroy(); } catch(e) {}
  }
  container.innerHTML = ''; 
  window.EJS_emulator = null;

  activeBlobs.forEach(url => URL.revokeObjectURL(url));
  activeBlobs = [];

  const oldScript = document.getElementById('ejs-loader-script');
  if (oldScript) oldScript.remove();
  
  home.style.display = 'none';
  if(store) store.style.display = 'none';
  emu.style.display = 'flex';
  document.getElementById('btnHome').classList.remove('active');
  if (document.activeElement) document.activeElement.blur();
  
  applyVideoFilters();

  // FIX: Register files directly to the VFS. This provides EmulatorJS with a REAL url ending in the proper 
  // extension (.zip, .iso, etc.) instead of a blank blob: url.
  let filesToRegister = [ { path: game.filename, blob: game.blob } ];
  if(biosObj) filesToRegister.push({ path: biosObj.name, blob: biosObj.blob });
  if(patchObj) filesToRegister.push({ path: patchObj.name, blob: patchObj.blob });

  try {
      await waitForServiceWorker();
      const channel = new MessageChannel();
      const registrationPromise = new Promise((resolve, reject) => {
          channel.port1.onmessage = (e) => {
              if (e.data.success) resolve();
              else reject("VFS Failed");
          };
      });

      if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
              type: 'REGISTER_FILES',
              id: game.id,
              files: filesToRegister
          }, [channel.port2]);
          await registrationPromise;
      } else {
          throw new Error("Service worker not active");
      }

     window.EJS_gameUrl = `/vfs/${game.id}/${game.filename}`;
     if (biosObj) window.EJS_biosUrl = `/vfs/${game.id}/${biosObj.name}`;
     if (patchObj) window.EJS_gamePatchUrl = `/vfs/${game.id}/${patchObj.name}#${patchObj.name}`;
  
} catch (e) {
      console.warn("VFS Registration Failed, falling back to standard Blob URLs", e);
      const romUrl = URL.createObjectURL(game.blob);
      activeBlobs.push(romUrl);
      window.EJS_gameUrl = romUrl;
      if (biosObj) {
          const bUrl = URL.createObjectURL(biosObj.blob);
          activeBlobs.push(bUrl);
          window.EJS_biosUrl = bUrl;
      }
      if (patchObj) {
          const pUrl = URL.createObjectURL(patchObj.blob);
          activeBlobs.push(pUrl);
          window.EJS_gamePatchUrl = pUrl + "#" + patchObj.name;
      }
  }

  window.EJS_player = "#game";
  window.EJS_gameID = game.id;
  window.EJS_threads = (config.enableThreads === true);
  
  if (ALIAS_MAP[game.system]) window.EJS_core = ALIAS_MAP[game.system];
  else window.EJS_core = game.system;
  
  // FIX: STOP stripping extensions! Cores need this metadata to unpack archives properly.
  if(game.filename) {
      window.EJS_gameName = game.filename;
  }
  
  window.EJS_fullscreenOnLoaded = (config.fullscreenOnLoad === true);
  if(config.netplayUrl) window.EJS_netplayServer = config.netplayUrl;
  
  window.EJS_netplayICEServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' }
  ];

  window.EJS_dontExtractBIOS = (config.dontExtractBios === true);
  window.EJS_forceLegacyCores = (config.forceLegacyCores === true);
  window.EJS_hideSettings = (config.hideSettings === true);
  
  window.EJS_cachingOptions = {
      expiryDays: 3650, 
      cacheROMFiles: true,
      cacheCores: true,
      cacheBios: true,
      cacheOthers: true 
  };

  window.EJS_defaultOptions = {
    'save-state-location': 'browser'
  };
  
  const ver = config.emuVersion || 'stable';
  
  if(config.customPaths && config.customPaths.length > 5) {
      window.EJS_pathtodata = config.customPaths;
  } else {
      window.EJS_pathtodata = `https://cdn.emulatorjs.org/${ver}/data/`;
  }

  window.EJS_coreConfig = { fetchContext: { mode: 'cors', credentials: 'omit' } };
  window.EJS_DEBUG_XX = (config.enableDebug === true);
  window.EJS_startOnLoaded = true;
  window.EJS_fixedSaveInterval = config.saveInterval;
  window.EJS_color = config.theme;
  window.EJS_backgroundColor = "#000000"; 
  
  window.EJS_gameConfig = { override_controls: true };
  if(config.controlMapping) {
      try {
          const mapping = JSON.parse(config.controlMapping);
          window.EJS_gameConfig = { ...window.EJS_gameConfig, ...mapping };
      } catch(e) { console.warn("Invalid Control Mapping JSON"); }
  }

  if(config.autoLoadSave) {
     const saveBlob = await db.readSaveState(game.id);
     if(saveBlob) {
         console.log("Loading save from IndexedDB...");
         const saveUrl = URL.createObjectURL(saveBlob);
         activeBlobs.push(saveUrl);
         window.EJS_loadStateURL = saveUrl;
     } else {
         console.log("No save state found.");
     }
  }

  if (game.system === 'segaMD' || game.system === 'segaCD') {
        window.EJS_MD_CORE_SETTING = "6_button_pad"; 
  }

  window.EJS_buttons = {
      quickSave: true,
      quickLoad: true,
      screenshot: true,
      cacheManager: true,
      volume: true
  };
  
  window.EJS_onGameExit = async function() {
      if(config.saveOnExit && window.EJS_emulator && window.EJS_emulator.gameManager) {
          try { 
             console.log("Attempting to save state on exit...");
             const stateData = await window.EJS_emulator.gameManager.getState();
             if(stateData) {
                 const blob = new Blob([stateData]);
                 await db.writeSaveState(game.id, blob);
                 console.log("Save state written to DB.");
             }
          } catch(e) { console.warn("Save on exit failed", e); }
      }
      
      setTimeout(() => {
          document.getElementById('btnHome').click();
      }, 100);
  };

  const scale = parseFloat(config.resScale) || 1.0;
  
  container.style.width = '100%';
  container.style.height = '100%';
  emu.classList.remove('optimized-mode');

  home.style.display = 'none';
  if(store) store.style.display = 'none';
  emu.style.display = 'flex';

  if(scale < 1.0) {
      container.style.width = (100 * scale) + '%';
      container.style.height = (100 * scale) + '%';
      emu.classList.add('optimized-mode');
  }

  const script = document.createElement('script');
  script.id = 'ejs-loader-script'; 
  script.crossOrigin = "anonymous";
  script.src = (config.loaderPath && config.loaderPath.length > 5) ? config.loaderPath : (window.EJS_pathtodata + 'loader.js');
  document.body.appendChild(script);
  
  if(config.dimReady) {
    setTimeout(() => { document.getElementById('topbar').classList.add('dimmed'); }, 2000);
  }
}

async function launchWebRetro(game) {
    const home = document.getElementById('home');
    const store = document.getElementById('store');
    const emu = document.getElementById('emulator');
    const container = document.getElementById('game');

    home.style.display = 'none';
    if(store) store.style.display = 'none';
    emu.style.display = 'flex';
    document.getElementById('btnHome').classList.remove('active');
    
    container.innerHTML = `<iframe src="/webretro/index.html" style="width:100%; height:100%; border:none;"></iframe>`;
    alert("WebRetro Loaded. Please drag and drop your ROM file into the frame or use the menu.");
}

async function tryFetchCore(ver, coreName) {
    console.log(`Attempting to fetch core: ${coreName}...`);
    const base = `https://cdn.emulatorjs.org/${ver}/data/cores`;
    
    const fileSuffixes = [
        '.js', '.data', '-wasm.js', '-wasm.data',
        '-thread-wasm.js', '-thread-wasm.data'
    ];

    let downloadedCount = 0;

    const results = await Promise.allSettled(
        fileSuffixes.map(suffix => 
            fetch(`${base}/${coreName}${suffix}`, { mode: 'cors' })
            .then(res => {
                if (res.ok) { downloadedCount++; return `${coreName}${suffix}`; }
                throw new Error(`404: ${suffix}`);
            })
        )
    );

    if (downloadedCount >= 2) return true;
    else throw new Error(`Core ${coreName} failed: Insufficient files found.`);
}

async function cacheLibraryCores() {
    if (!navigator.onLine) { alert("You are offline"); return; }
    
    const btn = document.getElementById('btnOfflineCache');
    const originalText = btn.innerText;
    btn.innerText = "Downloading Loader...";
    btn.disabled = true;

    const uniqueSystems = [...new Set(library.map(g => {
        return ALIAS_MAP[g.system] || g.system;
    }))];

    const ver = config.emuVersion || 'stable';

    try {
        await fetch(`https://cdn.emulatorjs.org/${ver}/data/loader.js`);
        
        let count = 0;
        for (let core of uniqueSystems) {
            btn.innerText = `Caching ${core}... (${count+1}/${uniqueSystems.length})`;
            
            let success = false;
            let attemptList = [core];
            if (CORE_FALLBACKS[core]) attemptList = attemptList.concat(CORE_FALLBACKS[core]);

            for (let candidate of attemptList) {
                try {
                    await tryFetchCore(ver, candidate);
                    success = true; break; 
                } catch(e) { console.warn(`Failed ${candidate}, trying next...`); }
            }

            if (!success) console.error(`All attempts failed for: ${core}`);
            count++;
        }
        alert("Download Process Complete");
    } catch(e) {
        alert("Error during download"); console.error(e);
    } finally {
        btn.innerText = originalText; btn.disabled = false;
    }
}