// public/sw_loader.js
// This script handles Service Worker registration and dynamic loading of the main application script.

const swFilePath = './subpath_service_worker.js'; // Relative path to the Service Worker file

// Calculate window.SUBPATH for app use (router, api); SW uses default scope from its location.
let L_pathname = window.location.pathname;
let L_subpath = '/'; // Default to root

// Check if L_pathname contains a slash, implying it's not just a filename or empty
if (L_pathname.includes('/')) {
    // Standard case: /foo/bar/page.html -> /foo/bar/
    // Or: /foo/bar/ -> /foo/bar/
    L_subpath = L_pathname.slice(0, L_pathname.lastIndexOf('/') + 1);
} else if (L_pathname.length > 0) {
    // Pathname is like "file.html" or some segment without slashes, assumed to be served from root.
    L_subpath = '/';
}
// Normalize L_subpath to ensure it starts and ends with a slash, unless it's just "/"
if (!L_subpath.startsWith('/')) { 
    L_subpath = '/' + L_subpath; // Should not happen with window.location.pathname
}
if (L_subpath !== '/' && !L_subpath.endsWith('/')) {
    L_subpath = L_subpath + '/';
}
if (L_subpath === '//') { // Avoids issues if pathname was somehow empty or just '/' initially
    L_subpath = '/';
}
window.SUBPATH = L_subpath;
// console.log('[SW Loader] window.SUBPATH set to:', window.SUBPATH);

const mainScriptTag = document.createElement('script');
mainScriptTag.type = 'module';
// This path /src/main.js assumes Vite dev server is serving from project root.
// The Service Worker is expected to intercept this path and rewrite it if necessary
// based on its own scope (which should align with window.SUBPATH).
mainScriptTag.src = '/src/main.js';

function loadApp() {
    document.head.appendChild(mainScriptTag);
    // console.log('[SW Loader] Appended main.js. src=' + mainScriptTag.src);
}

if ('serviceWorker' in navigator) {
    // console.log(`[SW Loader] Registering SW: ${swFilePath}`);
    // Register with relative path. Scope will default to the SW file's directory.
    // If index.html is at /subpath/, and sw_loader.js is loaded from /subpath/sw_loader.js,
    // and subpath_service_worker.js is at /subpath/subpath_service_worker.js,
    // then the default scope will be /subpath/.
    navigator.serviceWorker.register(swFilePath) 
        .then(registration => {
            // console.log('[SW Loader] SW registration successful. Scope: ' + registration.scope);
            // Wait for an active SW to control the page.
            return navigator.serviceWorker.ready; 
        })
        .then(readyRegistration => {
            // console.log('[SW Loader] SW ready and active.');
            loadApp();
        })
        .catch(error => {
            console.error('[SW Loader] SW registration failed: ', error);
            // console.log('[SW Loader] Fallback: loading app directly after SW registration failure.');
            loadApp(); // Fallback: load app directly if SW fails
        });
} else {
    // console.log('[SW Loader] Service Worker not supported. Loading app directly.');
    loadApp(); // Fallback: load app directly if SW not supported
}
