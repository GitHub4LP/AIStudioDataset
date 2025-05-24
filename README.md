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

This application is configured to dynamically adapt to being served from a URL subpath (e.g., `https://yourdomain.com/my-custom-app/`) at runtime. You do not need to set any build-time environment variables for this.

**Key Configuration Points:**

1.  **Build the Application:**
    Run the standard build command:
    ```bash
    npm run build
    ```
    The `vite.config.js` is set with `base: './'`, which means all asset paths in the generated `dist/index.html` will be relative.

2.  **Web Server Configuration:**
    This is the most critical part for subpath deployment. Your web server (e.g., Nginx, Apache) must be configured to:
    *   Serve the main `index.html` file (from your project's `dist` directory) when a user accesses the root of your subpath (e.g., `/my-custom-app/`).
    *   For any client-side routes under that subpath (e.g., `/my-custom-app/some-page`, `/my-custom-app/another-view`), the server must also serve the same `index.html` file. This allows the Vue Router (which is now aware of the subpath at runtime) to handle the specific client-side route.
    *   Proxy API requests. The frontend will make API calls prefixed with the detected subpath (e.g., `/my-custom-app/api/resource`). Your web server needs to route these requests to your backend service. The backend service itself listens for requests at `/api/resource` (without the subpath).

**Example Nginx Configuration Snippet:**

If your application is to be served from `/my-custom-app/`:

```nginx
location /my-custom-app/ {
    alias /path/to/your/project/dist/;  # Point to the directory containing index.html and assets
    try_files $uri $uri/ /my-custom-app/index.html; # For SPA routing: if file/dir not found, serve index.html

    # Note: The $uri already includes /my-custom-app/ part.
    # So try_files will look for /path/to/your/project/dist/js/app.js for /my-custom-app/js/app.js
}

location /my-custom-app/api/ {
    # The frontend sends requests to /my-custom-app/api/...
    # We need to strip /my-custom-app from the path before proxying to the backend,
    # as the backend expects /api/...
    rewrite ^/my-custom-app(/api/.*)$ $1 break; # $1 will be /api/whatever
    
    proxy_pass http://localhost:3000; # Assuming backend runs on port 3000 and expects /api/...
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**How it Works:**
*   **Static Assets:** Since `vite.config.js` uses `base: './'`, all asset links in `index.html` are relative (e.g. `<script src="./assets/app.js">`). If `index.html` is loaded from `/my-custom-app/`, the browser correctly requests `/my-custom-app/assets/app.js`.
*   **Client-side Routing:** The Vue Router dynamically determines the base path (e.g., `/my-custom-app/`) from `window.location.pathname` at runtime.
*   **API Calls:** The API service in the frontend also dynamically determines the base path from `window.location.pathname` and prefixes all calls to `/api/` accordingly (e.g., sends request to `/my-custom-app/api/data`). The Nginx `rewrite` rule then ensures the backend receives the request at `/api/data`.
