import { createRouter, createWebHistory } from 'vue-router'
import App from '../App.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: App
  }
]

const router = createRouter({
  // Dynamically determine base path from window.location.pathname
  // This assumes the application is served from a path ending with a slash,
  // or that index.html is at a certain depth.
  // E.g., if URL is /my/app/ Renders index.html, pathname is /my/app/, base is /my/app/
  // If URL is /my/app/page1, pathname is /my/app/page1, this logic makes base /my/app/
  const calculateRouterBase = () => {
    const pathname = window.location.pathname;
    // A common scenario: if the path contains a known segment like 'index.html'
    // or if the server always serves index.html for SPA paths.
    // A simpler, more general approach for SPAs where assets are relative
    // and server handles fallback to index.html:
    // We need to find the path that corresponds to the directory where index.html is located.
    // If index.html is at /foo/bar/index.html, base should be /foo/bar/
    // If accessing /foo/bar/ (which serves index.html), base should be /foo/bar/
    // If accessing /foo/bar/some/route (which serves index.html), base should be /foo/bar/
    // This requires a bit of care. A common robust way for SPAs served from subdirectories
    // is to let the server handle serving index.html and use relative paths for assets.
    // For the router, if all assets are relative (base: './' in vite),
    // the router often "just works" if no base is specified, or if base is '/'.
    // However, to be explicit for subpaths:
    // Let's assume the path up to the last '/' is the base directory.
    // This might need adjustment based on how the server is configured for SPA fallbacks.
    // For example, if deployed at /my-app/, and accessing /my-app/user/profile,
    // pathname is /my-app/user/profile. We want router base to be /my-app/.
    // A common way to get this is if there's a <base href="/my-app/"> tag,
    // which Vue router can use. But we are avoiding build-time base path.

    // Let's try a simple approach: path up to the last slash.
    // This assumes that if you are at /deep/path/page, the "app" is at /deep/path/
    // This might not be perfect for all server configurations.
    // A more robust way if the server is properly configured for SPA (serving index.html for sub-routes):
    // The router base should correspond to the publicPath where the app is served.
    // If vite base is './', assets are relative. The router then needs to know what the "logical" base is.
    // Consider document.baseURI which could be influenced by a <base> tag.
    // If no <base> tag is set by us, it's the document's location.
    
    // Let's use a simple substring logic and document it.
    // This means if your app's index.html is in /foo/bar/, then any access
    // like /foo/bar/ or /foo/bar/settings should have router base /foo/bar/
    let base = pathname.substring(0, pathname.lastIndexOf('/') + 1);
    // Ensure it starts and ends with a slash, and is not just '//' if at root.
    if (!base.startsWith('/')) {
        base = '/' + base;
    }
    if (base !== '/' && !base.endsWith('/')) {
        base = base + '/';
    }
    // console.log('Router base calculated as:', base); // For debugging
    return base;
  };

  history: createWebHistory(calculateRouterBase()), // Dynamically set router base
  routes
})

export default router 