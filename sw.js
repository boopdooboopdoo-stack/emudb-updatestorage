const CACHE_NAME = 'EMUDB-v3'; 
const VFS_CACHE_NAME = 'EMUDB-VFS';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/sw.js',
  '/css/style.css',
  '/js/config.js',
  '/js/db.js',
  '/js/api.js',
  '/js/emulator.js',
  '/js/importer.js',
  '/js/ui.js',
  '/js/main.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/spark-md5/3.0.2/spark-md5.min.js'
];

// Helper to determine mime type
function getContentType(path) {
    const cleanPath = path.toLowerCase();
    if (cleanPath.endsWith('.html') || cleanPath.endsWith('.htm')) return 'text/html';
    if (cleanPath.endsWith('.js')) return 'text/javascript';
    if (cleanPath.endsWith('.wasm')) return 'application/wasm';
    if (cleanPath.endsWith('.css')) return 'text/css';
    if (cleanPath.endsWith('.json')) return 'application/json';
    if (cleanPath.endsWith('.png')) return 'image/png';
    if (cleanPath.endsWith('.jpg') || cleanPath.endsWith('.jpeg')) return 'image/jpeg';
    if (cleanPath.endsWith('.gif')) return 'image/gif';
    if (cleanPath.endsWith('.svg')) return 'image/svg+xml';
    if (cleanPath.endsWith('.mp3')) return 'audio/mpeg';
    if (cleanPath.endsWith('.wav')) return 'audio/wav';
    if (cleanPath.endsWith('.ogg')) return 'audio/ogg';
    if (cleanPath.endsWith('.mp4')) return 'video/mp4';
    if (cleanPath.endsWith('.webm')) return 'video/webm';
    if (cleanPath.endsWith('.zip') || cleanPath.endsWith('.7z')) return 'application/zip';
    return 'application/octet-stream';
}

self.addEventListener("install", (event) => {
    self.skipWaiting(); 
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
    if (event.data.type === 'REGISTER_FILES') {
        event.waitUntil((async () => {
            const cache = await caches.open(VFS_CACHE_NAME);
            
            // Clear out the old game's VFS files to prevent storage bloat
            const keys = await cache.keys();
            await Promise.all(keys.map(k => cache.delete(k)));

            // Store the new game's files directly into the Cache API
            const putPromises = event.data.files.map(f => {
                const path = `/vfs/${event.data.id}/${f.path}`;
                const lowerPath = path.toLowerCase(); 
                
                const response = new Response(f.blob, {
                    status: 200,
                    headers: { 
                        'Content-Type': getContentType(f.path),
                        'Content-Length': f.blob.size,
                        'Accept-Ranges': 'bytes', 
                        'Cross-Origin-Embedder-Policy': 'require-corp',
                        'Cross-Origin-Opener-Policy': 'same-origin',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                        'Access-Control-Allow-Headers': '*'
                    }
                });

                // Cache exact path
                let p1 = cache.put(path, response.clone());
                
                // Cache lowercase path to prevent case-sensitive 404 errors from game engines
                let p2 = (path !== lowerPath) ? cache.put(lowerPath, response) : Promise.resolve();
                
                return Promise.all([p1, p2]);
            });

            await Promise.all(putPromises);

            if(event.ports && event.ports[0]) {
                event.ports[0].postMessage({ success: true });
            }
        })());
    }
    
    if (event.data.type === 'CLEAR_FILES') {
        event.waitUntil(caches.delete(VFS_CACHE_NAME));
    }
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // --- VIRTUAL FILE SYSTEM (VFS) HANDLER ---
    if (url.pathname.startsWith('/vfs/')) {
        event.respondWith((async () => {
            const cache = await caches.open(VFS_CACHE_NAME);
            const cleanPath = url.pathname.replace(/\/\//g, '/');
            const decodedPath = decodeURIComponent(cleanPath);

            // 1. Try exact match
            let response = await cache.match(cleanPath);
            
            // 2. Try decoded URI match
            if (!response) response = await cache.match(decodedPath);
            
            // 3. Try case-insensitive fallbacks
            if (!response) response = await cache.match(cleanPath.toLowerCase());
            if (!response) response = await cache.match(decodedPath.toLowerCase());

            if (response) {
                return response;
            } else {
                return new Response(`File not found: ${cleanPath}`, { status: 404 });
            }
        })());
        return;
    }

    // --- APP SHELL & NETWORK HANDLER ---
    event.respondWith(
        (async () => {
            const isAppShell = APP_SHELL.some(asset => url.pathname === asset || url.pathname + '/' === asset);

            let response;
            if (isAppShell) {
                response = await caches.match(request);
                if (!response) {
                    try { response = await fetch(request); } catch(e) {}
                }
            } else {
                try {
                    response = await fetch(request);
                } catch (e) {
                    response = await caches.match(request);
                }
            }
            return addHeaders(response);
        })()
    );
});

function addHeaders(response) {
    if (!response || response.type === 'opaque' || response.status === 0) return response;

    const newHeaders = new Headers(response.headers);
    
    if (!newHeaders.has("Cross-Origin-Embedder-Policy")) {
        newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
    }
    if (!newHeaders.has("Cross-Origin-Opener-Policy")) {
        newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
    }
    
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    newHeaders.set("Access-Control-Allow-Headers", "*");

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
    });
}