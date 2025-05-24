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

To deploy this application under a subpath (e.g., `/my/custom/path/`), the following frontend configurations are essential:

*   **Build-time Base Path**: The `VITE_APP_BASE_PATH` environment variable must be set during the `vite build` process. For example:
    ```bash
    VITE_APP_BASE_PATH=/my/custom/path/ npm run build
    ```
*   This ensures that:
    *   Asset URLs (JavaScript, CSS, images) are correctly prefixed.
    *   Client-side routing (Vue Router) understands the application's base path.
    *   API calls made by the frontend are correctly directed to `[subpath]/api/...`.

The backend (`server.js`) serves the frontend from the root in its context but is expected to be run behind a reverse proxy that handles the subpath routing to the Node.js application.
