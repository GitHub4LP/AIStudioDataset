const API_BASE_URL = '/api'; // Assuming your backend is served from the same domain

/**
 * Handles the response from a fetch call.
 * @param {Response} response - The fetch response object.
 * @returns {Promise<any>} - A promise that resolves with the JSON data or rejects with an error.
 */
async function handleResponse(response) {
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      // If response is not JSON, use status text
      errorData = { error: response.statusText || 'Unknown server error' };
    }
    const errorMessage = errorData?.error || `HTTP error! status: ${response.status}`;
    console.error('API Error:', errorMessage, 'Full response:', response);
    throw new Error(errorMessage);
  }
  // Check if response has content before trying to parse JSON
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return response.json();
  } else {
    return response.text(); // Or handle as appropriate, e.g. return null or an empty object
  }
}

/**
 * Fetches the list of private datasets.
 * Corresponds to GET /api/datasets/private
 * @param {number} page - The page number.
 * @param {number} pageSize - The number of items per page.
 * @returns {Promise<any>}
 */
export async function fetchPrivateDatasetList(page = 1, pageSize = 20) {
  const response = await fetch(`${API_BASE_URL}/datasets/private?page=${page}&pageSize=${pageSize}`);
  return handleResponse(response);
}

/**
 * Fetches details for a specific dataset.
 * Corresponds to GET /api/datasets/:datasetId/detail
 * @param {string} datasetId - The ID of the dataset.
 * @returns {Promise<any>}
 */
export async function getDatasetDetails(datasetId) {
  if (!datasetId) throw new Error("Dataset ID is required for fetching details.");
  const response = await fetch(`${API_BASE_URL}/datasets/${datasetId}/detail`);
  return handleResponse(response);
}

/**
 * Updates an existing dataset.
 * Corresponds to PUT /api/datasets/:datasetId
 * @param {string} datasetId - The ID of the dataset to update.
 * @param {object} datasetData - The data to update, including datasetName, datasetAbs, tags, fileIds, fileAbsList, ispublic.
 * @returns {Promise<any>}
 */
export async function updateDataset(datasetId, datasetData) {
  if (!datasetId) throw new Error("Dataset ID is required for updating.");
  const response = await fetch(`${API_BASE_URL}/datasets/${datasetId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datasetData),
  });
  return handleResponse(response);
}

/**
 * Deletes a dataset.
 * Corresponds to DELETE /api/datasets/:datasetId
 * @param {string} datasetId - The ID of the dataset to delete.
 * @returns {Promise<any>}
 */
export async function deleteDataset(datasetId) {
  if (!datasetId) throw new Error("Dataset ID is required for deletion.");
  const response = await fetch(`${API_BASE_URL}/datasets/${datasetId}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
}

/**
 * Uploads a server-side file to be part of a dataset (gets its fileId and fileAbs).
 * Corresponds to POST /api/upload-to-dataset
 * @param {object} fileInfo - Information about the server file { filePath, fileName, folderPath, currentPath, selectedBasePath }.
 * @returns {Promise<any>}
 */
export async function registerServerFile(fileInfo) {
  const response = await fetch(`${API_BASE_URL}/upload-to-dataset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fileInfo),
  });
  return handleResponse(response);
}

/**
 * Fetches dataset constraints.
 * Corresponds to GET /api/dataset-constraints
 * @returns {Promise<any>}
 */
export async function getDatasetConstraints() {
  const response = await fetch(`${API_BASE_URL}/dataset-constraints`);
  return handleResponse(response);
}

/**
 * Fetches current dataset count.
 * Corresponds to GET /api/datasets/count
 * @returns {Promise<any>}
 */
export async function getDatasetCount() {
    const response = await fetch(`${API_BASE_URL}/datasets/count`);
    return handleResponse(response);
}


/**
 * Fetches files and folders for a given server path.
 * Corresponds to GET /api/files
 * @param {string} path - The server path to browse.
 * @returns {Promise<any>}
 */
export async function getServerFiles(path = '.') {
  const response = await fetch(`${API_BASE_URL}/files?path=${encodeURIComponent(path)}`);
  return handleResponse(response);
}

/**
 * Creates a new dataset.
 * Corresponds to POST /api/create-dataset
 * @param {object} datasetData - Data for the new dataset { datasetName, datasetAbs, tags, fileIds, fileAbsList }.
 * @returns {Promise<any>}
 */
export async function createDataset(datasetData) {
  const response = await fetch(`${API_BASE_URL}/create-dataset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datasetData),
  });
  return handleResponse(response);
}

// Add more functions as needed, e.g., for local file uploads, URL fetching to dataset
// For example, for local file upload:
/**
 * Uploads a local file directly.
 * Corresponds to POST /api/upload-local-to-dataset
 * @param {FormData} formData - The FormData object containing the file and other metadata.
 * @returns {Promise<any>}
 */
export async function uploadLocalFile(formData) {
    const response = await fetch(`${API_BASE_URL}/upload-local-to-dataset`, {
        method: 'POST',
        // 'Content-Type' header is automatically set by browser for FormData
        body: formData,
    });
    return handleResponse(response);
}

/**
 * Fetches a file via URL and adds it to dataset temporary storage.
 * Corresponds to POST /api/fetch-to-dataset
 * @param {object} fetchData - { url, fileName, referer, userAgent }
 * @returns {Promise<any>}
 */
export async function fetchUrlToDataset(fetchData) {
    const response = await fetch(`${API_BASE_URL}/fetch-to-dataset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fetchData),
    });
    return handleResponse(response);
}
