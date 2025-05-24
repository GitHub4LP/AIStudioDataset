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

To deploy this application under a URL subpath (e.g., `/my/custom/path/`), it's essential to configure Vite using an environment variable at build time and for the development server. This ensures that Vite correctly handles asset paths, module loading, and provides the necessary base URL to the client-side application.

Key aspects for subpath deployment:

*   **Vite Configuration (`vite.config.js`):**
    *   The `base` option is set to `process.env.VITE_APP_BASE_PATH || '/'`.
    *   This means you must set the `VITE_APP_BASE_PATH` environment variable when running the development server or building the application if it's intended for a subpath. For example, `/my/custom/path/`.
    *   If not set, it defaults to `'/'` for root deployment.

*   **Client-Side Logic (Router and API calls):**
    *   The Vue Router (`src/router/index.js`) uses `createWebHistory(import.meta.env.BASE_URL)`.
    *   The API service (`src/services/apiService.js`) constructs its `API_BASE_URL` using `import.meta.env.BASE_URL`.
    *   `import.meta.env.BASE_URL` is automatically populated by Vite based on the `base` configuration. This ensures that client-side routing and API calls are correctly prefixed with the subpath.

*   **Development Server:**
    *   When running `npm run dev` for a subpath, you must prefix the command with the environment variable. For example:
        ```bash
        VITE_APP_BASE_PATH=/my/custom/path/ npm run dev
        ```
    *   This allows Vite's dev server (including its Hot Module Replacement client) to operate correctly under the specified subpath.

*   **Production Build:**
    *   Similarly, for a production build targeting a subpath:
        ```bash
        VITE_APP_BASE_PATH=/my/custom/path/ npm run build
        ```
    *   This ensures asset paths in the generated `dist/index.html` are correctly prefixed.

*   **Web Server Configuration:**
    *   The web server (e.g., Nginx) must be configured to serve the application's static files (from the `dist` directory) from the specified subpath.
    *   API requests, which will be made by the frontend to `[subpath]/api/...`, must be proxied to the backend Node.js application. The backend expects API calls at `/api/...`, so the proxy might need to strip the subpath prefix.
