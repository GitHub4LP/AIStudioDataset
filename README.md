# AIStudioDataset
AIStudioDataset

## Build and Deployment

### Standard Build

To build the application for production, run:

```bash
npm run build
```
This will generate static assets in the `dist` directory. These assets can be served by any static file server.

### Deploying under a Subpath

To deploy this application effectively under a URL subpath (e.g., `https://yourdomain.com/my-custom-app/`), you **must** use the `VITE_APP_BASE_PATH` environment variable when running the development server and when building for production.

**Key Configuration Steps:**

1.  **Set the Base Path Environment Variable:**
    The `vite.config.js` is configured with `base: process.env.VITE_APP_BASE_PATH || '/'`. This means Vite's behavior is controlled by `VITE_APP_BASE_PATH`.

2.  **Running the Development Server under a Subpath:**
    If you want to run the dev server so it's accessible under `/my-custom-app/` (usually via a proxy):
    ```bash
    VITE_APP_BASE_PATH=/my-custom-app/ npm run dev
    ```
    Your proxy should then map requests from `/my-custom-app/` to the Vite dev server (e.g., `http://localhost:3000/` if that's where Vite runs, but now Vite expects to be accessed via `/my-custom-app/`).

3.  **Building for Production under a Subpath:**
    To build the application so it can be hosted at `/my-custom-app/`:
    ```bash
    VITE_APP_BASE_PATH=/my-custom-app/ npm run build
    ```
    This command will generate assets in the `dist` folder with all paths correctly prefixed for `/my-custom-app/`.

4.  **Web Server Configuration (Production):**
    Your web server (e.g., Nginx) must be configured to:
    *   Serve the static files from the `dist` directory when a user accesses your subpath (e.g., `/my-custom-app/`).
    *   For any client-side routes (e.g., `/my-custom-app/some-page`), the server must serve `index.html` from the `dist` directory (located at `/my-custom-app/index.html` from the browser's perspective).
    *   Proxy API requests. The frontend will make API calls to `[subpath]/api/resource` (e.g., `/my-custom-app/api/resource`). Your web server needs to route these to your backend service. The backend expects API calls at `/api/resource` (without the subpath).

**Example Nginx Configuration Snippet (Production):**

If your application is built with `VITE_APP_BASE_PATH=/my-custom-app/` and hosted at `/my-custom-app/`:

```nginx
location /my-custom-app/ {
    alias /path/to/your/project/dist/;  # Point to the dist directory
    try_files $uri $uri/ /my-custom-app/index.html; # For SPA routing
}

location /my-custom-app/api/ {
    # Frontend sends to /my-custom-app/api/...
    # Backend expects /api/...
    rewrite ^/my-custom-app(/api/.*)$ $1 break; # $1 becomes /api/...
    
    proxy_pass http://localhost:3000; # Your backend API server
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**How it Works with `VITE_APP_BASE_PATH`:**
*   **Vite Dev Server:** Uses `VITE_APP_BASE_PATH` to serve its own client (`@vite/client`) and resolve module imports from the correct subpath.
*   **Build Process:** Vite uses `VITE_APP_BASE_PATH` to prefix all asset URLs in the generated `index.html` and other built files.
*   **Client-Side Code:** `import.meta.env.BASE_URL` (provided by Vite) will correctly reflect the subpath (e.g., `/my-custom-app/`). The Vue Router and API service use this to construct base paths for routing and API calls.
