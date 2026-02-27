/* ───────── ARTWORK & METADATA ───────── */

async function scanForMissingArtwork() {
    if (!navigator.onLine) return;
    const missing = library.filter(g => !g.art || (config.metadataSource === 'hasheous' && !g.manual));
    if(missing.length === 0) return;
    for (const game of missing) {
        await attemptAutoArt(game);
        await new Promise(r => setTimeout(r, 800)); 
    }
}

async function attemptAutoArt(game) {
    if (!navigator.onLine) return;
    const source = config.metadataSource || 'libretro'; 
    let changed = false;

    if(source === 'hasheous' && game.size < 200 * 1024 * 1024) { 
        try {
            const hashData = await fetchHasheousData(game.blob);
            if (hashData) {
                if(hashData.name && !game.title) {
                    game.title = cleanTitle(hashData.name);
                    game.rawTitle = hashData.name;
                    changed = true;
                }
                if(hashData.box_art_url && !game.art) {
                    game.art = hashData.box_art_url;
                    changed = true;
                }
                if(hashData.manual_url && !game.manual) {
                    game.manual = hashData.manual_url;
                    changed = true;
                }
            }
        } catch(e) { console.log("Hash Fail", e); }
    }
    
    if(!game.art) {
        let res = await tryFetchLibretro(game.rawTitle || game.title, game.system);
        if(!res.art) res = await tryFetchLibretro(game.title, game.system);
        if(res.art) {
            game.art = res.art;
            changed = true;
        }
    }

    if(changed) {
        await db.addGame(game);
        refreshGameCard(game.id);
    }
}

async function tryFetchLibretro(title, systemKey) {
   if (!LIBRETRO_MAP[systemKey]) return { art: "" };
   const systemName = LIBRETRO_MAP[systemKey];
   const formattedTitle = encodeURIComponent(title).replace(/'/g, "%27");
   const url = `https://raw.githubusercontent.com/libretro-thumbnails/${systemName}/refs/heads/master/Named_Boxarts/${formattedTitle}.png`;
   try {
       const res = await fetch(url, { method: 'HEAD' });
       if(res.ok) return { art: url };
   } catch(e) {}
   return { art: "" };
}

async function calculateHash(blob, algo) {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest(algo, buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function fetchHasheousData(blob) {
   // Try MD5 first
   let hash = await calculateMD5(blob);
   let method = 'md5';
   let result = await queryHasheous(method, hash);
   
   if(!result) {
       // Try SHA1
       hash = await calculateHash(blob, 'SHA-1');
       method = 'sha1';
       result = await queryHasheous(method, hash);
   }

   if(!result) {
       // Try SHA256
       hash = await calculateHash(blob, 'SHA-256');
       method = 'sha256';
       result = await queryHasheous(method, hash);
   }

   return result;
}

async function queryHasheous(method, hash) {
    const apiUrl = `https://hasheous.org/api/v1/Lookup/ByHash/${method}/${hash}`;
    const proxies = ["https://api.allorigins.win/raw?url=", "https://corsproxy.io/?"];
    
    for (const proxy of proxies) {
       try {
           const controller = new AbortController();
           const timeoutId = setTimeout(() => controller.abort(), 8000);
           const response = await fetch(proxy + encodeURIComponent(apiUrl), { signal: controller.signal });
           clearTimeout(timeoutId);
           
           if(response.ok) {
               const data = await response.json();
               let artworkUrl = null;
               let manualUrl = null;
               
               if(data.attributes) {
                   // Artwork
                   const artAttrs = ['Logo', 'Box Art', 'Boxart', 'Cover'];
                   for (const attrName of artAttrs) {
                       const attr = data.attributes.find(a => a.attributeName === attrName);
                       if(attr && attr.value) {
                           const imageUrl = `https://hasheous.org/api/v1/images/${attr.value}`;
                           artworkUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}`;
                           break;
                       }
                   }
                   // Manuals
                   const manAttrs = ['Manual', 'Instruction Manual', 'Booklet'];
                   const vimmAttr = data.attributes.find(a => a.attributeName === 'VIMMManualId');
                   
                   if(vimmAttr && vimmAttr.value) {
                       manualUrl = `https://vimm.net/manual/${vimmAttr.value}`;
                   } else {
                       for(const attrName of manAttrs) {
                            const attr = data.attributes.find(a => a.attributeName === attrName);
                            if(attr && attr.value) {
                                manualUrl = attr.value; 
                                if(!manualUrl.startsWith('http')) {
                                    manualUrl = `https://hasheous.org/api/v1/files/${manualUrl}`; 
                                }
                                break;
                            }
                       }
                   }
               }
               return { name: data.name, box_art_url: artworkUrl, manual_url: manualUrl };
           }
       } catch(e) { continue; }
   }
   return null;
}

async function manualHasheous() {
   if (!navigator.onLine) { alert("You are offline."); return; }
   const id = document.getElementById('editId').value;
   const g = library.find(x => x.id === id);
   if(!g) return;
   const btn = document.getElementById('btnHash');
   const originalText = btn.innerText;
   btn.innerText = "Searching...";
   try {
       const data = await fetchHasheousData(g.blob);
       if(data) {
           if(data.name) document.getElementById('editTitle').value = cleanTitle(data.name);
           if(data.box_art_url) document.getElementById('editArtUrl').value = data.box_art_url;
           if(data.manual_url) document.getElementById('editManual').value = data.manual_url;
           alert(`Found match: ${data.name}`);
       } else {
           alert("No Hasheous match found.");
       }
   } catch(e) {
       alert("Error contacting Hasheous.");
   } finally {
       btn.innerText = originalText;
   }
}

async function fetchArtwork() {
  if (!navigator.onLine) { alert("You are offline."); return; }
  const title = document.getElementById('editTitle').value.trim();
  const sys = document.getElementById('editSystem').value;
  const btn = document.getElementById('btnFetch');
  const out = document.getElementById('editArtUrl');

  btn.innerText = "Searching...";
  const res = await tryFetchLibretro(title, sys);
  btn.innerText = "Fetch LibretroDB Artwork";
  
  if(res.art) {
      out.value = res.art;
      out.style.borderColor = "var(--primary)";
  } else {
      alert("No match found.");
  }
}

/* ───────── GOOGLE DRIVE ───────── */
let gDriveReady = false;
let pickerApiLoaded = false;
function initGoogleDrive() {
    if(!config.gDriveApiKey || !config.gDriveClientId) {
        alert("Enter Drive Credentials in Settings.");
        document.getElementById('btnSettings').click();
        return;
    }
    if(!gDriveReady) {
       const script = document.createElement('script');
       script.src = "https://apis.google.com/js/api.js";
       script.onload = () => gapi.load('picker', { 'callback': () => { pickerApiLoaded = true; } });
       document.body.appendChild(script);
       const script2 = document.createElement('script');
       script2.src = "https://accounts.google.com/gsi/client";
       script2.onload = () => {
           window.tokenClient = google.accounts.oauth2.initTokenClient({
               client_id: config.gDriveClientId,
               scope: 'https://www.googleapis.com/auth/drive.readonly',
               callback: '',
           });
           gDriveReady = true;
           createPicker();
       }
       document.body.appendChild(script2);
    } else {
        createPicker();
    }
}
function createPicker() {
    if(!gDriveReady || !pickerApiLoaded) return;
    window.tokenClient.callback = async (response) => {
        if (response.error !== undefined) throw (response);
        const accessToken = response.access_token;
        const view = new google.picker.View(google.picker.ViewId.DOCS);
        view.setMimeTypes("application/zip,application/x-zip-compressed,application/octet-stream");
        const picker = new google.picker.PickerBuilder()
            .setDeveloperKey(config.gDriveApiKey)
            .setAppId(config.gDriveClientId)
            .setOAuthToken(accessToken)
            .addView(view)
            .setCallback(pickerCallback)
            .build();
        picker.setVisible(true);
    };
    window.tokenClient.requestAccessToken({prompt: ''});
}
async function pickerCallback(data) {
    if (data[google.picker.Response.ACTION] == google.picker.Action.PICKED) {
        const doc = data[google.picker.Response.DOCUMENTS][0];
        const fileId = doc[google.picker.Document.ID];
        const fileName = doc[google.picker.Document.NAME];
        const token = gapi.client.getToken().access_token;
        document.getElementById('loadingOverlay').classList.remove('hidden');
        try {
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            const blob = await res.blob();
            await handleFiles([new File([blob], fileName)]);
        } catch(e) {
            alert("Download failed.");
            document.getElementById('loadingOverlay').classList.add('hidden');
        }
    }
}