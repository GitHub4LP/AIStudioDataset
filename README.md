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

If you need to deploy the application under a specific subpath (e.g., `https://yourdomain.com/my-custom-app/`), you need to set the `VITE_APP_BASE_PATH` environment variable during the build process.

For example, if the application will be served from `/my-custom-app/`:

1.  **Build the application with the base path:**
    ```bash
    VITE_APP_BASE_PATH=/my-custom-app/ npm run build
    ```
    Ensure the path starts and ends with a slash if it's a subpath. For root deployment, you can omit `VITE_APP_BASE_PATH` or set it to `'/'` or `'./'`.

2.  **Configure your web server:**
    Your web server (e.g., Nginx, Apache) should be configured to serve the contents of the `dist` directory from the specified subpath (`/my-custom-app/` in this example). All API requests (typically to `/my-custom-app/api/...`) should be proxied to the backend Node.js server.

**Example Nginx Configuration Snippet:**

```nginx
location /my-custom-app/ {
    alias /path/to/your/project/dist/; # Path to the dist directory
    try_files $uri $uri/ /my-custom-app/index.html; # Serve index.html for SPA routing

    # Proxy API requests to the backend
    location /my-custom-app/api/ {
        proxy_pass http://localhost:3000/api/; # Assuming backend runs on port 3000
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

This setup ensures that:
*   Frontend assets (JS, CSS) are loaded correctly from the subpath.
*   Client-side routing (Vue Router) works correctly under the subpath.
*   API calls are correctly directed to `[subpath]/api/...`.
