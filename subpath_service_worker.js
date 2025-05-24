// NO DB-related functions or variables here

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

function longestCommonPrefix(str1, str2) {
    if (str1 === str2) return str1;
    let minLength = Math.min(str1.length, str2.length);
    let prefix = [];
    for (let i = 0; i < minLength; i++) {
        if (str1[i] === str2[i]) prefix.push(str1[i]);
        else break;
    }
    return prefix.join('');
}

self.addEventListener('fetch', event => {
    event.respondWith(
        (async () => {
            const requestUrl = new URL(event.request.url);

            if (requestUrl.host !== self.location.host) {
                return fetch(event.request); // Bypass cross-origin requests
            }

            let effectivePathPrefix = new URL(self.registration.scope).pathname;
            // Normalize effectivePathPrefix: ensure it starts with '/' (usually true for scope)
            // and ends with '/' if it's not the root.
            if (!effectivePathPrefix.startsWith('/')) { // Should not happen with valid scope URLs
                effectivePathPrefix = '/' + effectivePathPrefix;
            }
            if (effectivePathPrefix !== '/' && !effectivePathPrefix.endsWith('/')) {
                effectivePathPrefix = effectivePathPrefix + '/';
            }
            // Handle cases where scope might be just 'http://host', making pathname effectively '/'
            // or if pathname was somehow empty, default to root.
            if (effectivePathPrefix === '//' || effectivePathPrefix === '') effectivePathPrefix = '/';


            // If the request path doesn't start with this effectivePathPrefix,
            // and the effectivePathPrefix is not simply root '/',
            // it means it's likely a root-relative path that needs rewriting.
            if (effectivePathPrefix !== '/' && !requestUrl.pathname.startsWith(effectivePathPrefix)) {
                // Check if the request is truly root-relative (starts with / but not with the prefix)
                if (requestUrl.pathname.startsWith('/')) {
                    // Calculate lcp against the path part of effectivePathPrefix only if requestUrl.pathname is also absolute
                    // This logic is to handle cases like:
                    // scope = /foo/bar/, request = /module.js -> /foo/bar/module.js
                    // scope = /foo/bar/, request = /assets/img.png -> /foo/bar/assets/img.png
                    // We assume Vite generates root-relative paths like /@vite/client, /src/main.js, /node_modules/...
                    
                    // The LCP part from the original script was intended to strip a common part if the
                    // request path *already* partially matched the subpath but was wrong.
                    // E.g. subpath /app/, request /app-beta/resource. LCP /app. New path /app/beta/resource.
                    // This is complex. A simpler model if Vite always makes root-relative paths:
                    // just prepend subpath if request is root-relative.
                    
                    // Simpler rewrite: if request starts with '/' but not effectivePathPrefix, prepend effectivePathPrefix.
                    // Ensure no double slashes if effectivePathPrefix is '/'
                    const newPathname = (effectivePathPrefix.endsWith('/') ? effectivePathPrefix.slice(0, -1) : effectivePathPrefix) + requestUrl.pathname;
                    
                    const newUrl = new URL(requestUrl.href); // Use requestUrl.href to maintain other parts like search params
                    newUrl.pathname = newPathname.replace(/\/\//g, '/'); // Clean up double slashes

                    // self.console.log(`SW: Rewriting URL from ${requestUrl.pathname} to ${newUrl.pathname} (scope: ${self.registration.scope})`);
                    
                    if (event.request.method === 'GET') {
                        return Response.redirect(newUrl.href, 302);
                    } else {
                        const newRequest = new Request(newUrl.href, event.request.clone());
                        return fetch(newRequest);
                    }
                }
            }
            
            return fetch(event.request);
        })()
    );
});
