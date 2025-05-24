import { createRouter, createWebHistory } from 'vue-router'
import App from '../App.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: App
  }
]

// Defines how the application's base path is calculated for the Vue Router.
// This is crucial for applications deployed under a subpath.
const calculateRouterBase = () => {
  // Get the full path from the browser's current URL (e.g., "/my-app/some/page").
  const pathname = window.location.pathname;

  // Determine the base path. This logic assumes the application's "base"
  // is the part of the path up to the last slash.
  // For example:
  // - If URL is /my-app/page, pathname is /my-app/page, base becomes /my-app/
  // - If URL is /my-app/, pathname is /my-app/, base becomes /my-app/
  // - If URL is /, pathname is /, base becomes /
  // This is a common approach for Single Page Applications (SPAs) where the web server
  // is configured to serve the main index.html file for any route belonging to the app.
  let base = pathname.substring(0, pathname.lastIndexOf('/') + 1);

  // Ensure the base path starts with a slash.
  // This is mostly a defensive check, as window.location.pathname in browsers
  // typically always starts with '/'.
  if (!base.startsWith('/')) {
      base = '/' + base;
  }

  // Ensure the base path ends with a slash for non-root paths.
  // The root path "/" is a special case and should remain as is.
  // Vue Router generally expects a base path format like "/" or "/subpath/".
  if (base !== '/' && !base.endsWith('/')) {
      base = base + '/';
  }
  
  // For debugging purposes, you can uncomment the following line:
  // console.log(`[Router] Calculated base: ${base} from pathname: ${pathname}`);
  return base;
};

const router = createRouter({
  history: createWebHistory(calculateRouterBase()), // Dynamically set router base
  routes
})

export default router 