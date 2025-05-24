# Project Overview: AIStudioDataset

## 1. Architecture

*   **Frontend**: Vue.js (version 3) single-page application (SPA).
    *   **Build Tool**: Vite.js, configured for dynamic base path deployment.
    *   **Routing**: Vue Router, handling client-side navigation.
    *   **State Management**: Pinia.
    *   **UI Components**: ElementPlus.
    *   **Internationalization**: vue-i18n.
*   **Backend**: Node.js with Express.js.
    *   Serves RESTful APIs under the `/api` prefix.
    *   Handles file uploads and interacts with dataset management logic.
    *   Integrates with AI Studio services (as suggested by `aiStudioService.js` and `aistudio-api.yaml`).
*   **Server**: `server.js` acts as the main entry point, running the Express server and integrating Vite middleware for development.

## 2. Key Libraries and Technologies

*   **Vue.js Ecosystem**:
    *   `vue@^3.4`: Core Vue library.
    *   `vue-router@^4.5`: For client-side routing.
    *   `pinia@^3.0`: For state management.
*   **Build & Development**:
    *   `vite@^6.3`: Frontend build tool and dev server.
    *   `@vitejs/plugin-vue@^5.0`: Vite plugin for Vue.
*   **UI & Styling**:
    *   `element-plus@^2.9`: UI component library.
    *   Standard CSS (likely within Vue components or separate CSS files).
*   **Backend Framework**:
    *   `express@^4.18`: Web framework for Node.js.
*   **API Communication**:
    *   `axios@^1.9`: HTTP client for making API requests from the frontend.
*   **Utility & Others**:
    *   `vue-i18n@^12.0`: For internationalization.
    *   `@baiducloud/sdk@^1.0.4`: Baidu Cloud SDK, likely for BOS (Baidu Object Storage) or other cloud services.
    *   `multer@^1.4.5-lts.1`: Middleware for handling `multipart/form-data` (file uploads).
    *   `winston@^3.17` & `winston-daily-rotate-file@^5.0`: For logging.

## 3. Application Purpose

The application, "AIStudioDataset," appears to be a web-based tool designed for:

*   Managing datasets, potentially for use in Baidu's AI Studio platform.
*   Browsing, creating, and editing datasets.
*   Uploading files to datasets.
*   Interacting with Baidu Object Storage (BOS) for file storage.

It provides a user interface for these operations, facilitating data preparation and management for AI/ML workflows.

## 4. Deployment Considerations (Subpath)

This application is designed to be deployed under a URL subpath (e.g., `/my/custom/path/`) without requiring build-time configurations for the path. The frontend dynamically adapts at runtime.

Key aspects for subpath deployment:

*   **Vite Configuration (`vite.config.js`):** The `base` option is set to `'./'`. This ensures all static asset paths (JavaScript, CSS, images) in the built `index.html` are relative.
*   **Runtime Path Detection:**
    *   **Static Assets:** Relative asset paths work correctly as long as the web server serves `index.html` from the designated subpath. For example, if `index.html` is accessed via `/my/custom/path/`, a relative link like `./assets/app.js` will correctly resolve to `/my/custom/path/assets/app.js`.
    *   **Vue Router:** The router's base path is dynamically determined at runtime from `window.location.pathname`. It calculates the path from which the application is served and configures its routes accordingly.
    *   **API Calls:** The base URL for API calls (to `/api/...`) is also dynamically determined at runtime using `window.location.pathname`, ensuring that requests are correctly prefixed with the application's subpath.
*   **Web Server Configuration:**
    *   The web server (e.g., Nginx, Apache) must be configured to serve the application's `index.html` file (from the `dist` directory) when the subpath is accessed.
    *   For any client-side routes (e.g., `/my/custom/path/some-page`), the server should serve `index.html` to allow the Vue Router to handle the routing.
    *   API requests, now correctly prefixed by the frontend (e.g., `/my/custom/path/api/...`), must be proxied by the web server to the backend Node.js application, stripping the subpath if necessary before hitting the backend (which expects calls at `/api/...`).

This approach allows the same build artifact to be deployed under different subpaths without rebuilding, as the path adaptation logic resides in the client-side code.
