/**
 * Builds a file tree structure from a flat list of file objects.
 *
 * @param {Array<Object>} fileList - A flat list of file objects. Each object should have
 *                                   at least `fileAbs` (string), `fileId` (string/number),
 *                                   and `fileName` (string). Other properties will be preserved.
 * @param {string|number} datasetId - The ID of the dataset, used to prefix folder IDs for uniqueness.
 * @returns {Array<Object>} A tree structure of files and folders.
 */
export function buildFileTree(fileList, datasetId) {
  const tree = [];
  const folderMap = new Map(); // Stores references to folder nodes for quick access

  if (!fileList || fileList.length === 0) {
    return tree;
  }

  fileList.forEach(file => {
    // Ensure fileAbs uses forward slashes and remove leading/trailing slashes for consistency
    const path = (file.fileAbs || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const parts = path.split('/').filter(part => part !== ''); // Filter empty parts

    let currentLevel = tree;
    let currentPath = '';

    if (parts.length === 0 || (parts.length === 1 && parts[0] === file.fileName)) {
      // Root-level file or fileAbs is just the fileName
      const fileNode = {
        ...file,
        id: file.fileId,
        label: file.fileName,
        type: 'file',
        isFileNode: true,
        path: file.fileAbs, // Store original fileAbs as path
      };
      tree.push(fileNode);
      return;
    }

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = i === 0 ? part : `${currentPath}/${part}`;

      if (i === parts.length - 1 && part === file.fileName) {
        // It's a file node
        const fileNode = {
          ...file,
          id: file.fileId,
          label: file.fileName,
          type: 'file',
          isFileNode: true,
          path: file.fileAbs, // Store original fileAbs as path
        };
        currentLevel.push(fileNode);
      } else {
        // It's a folder node
        const folderId = `${datasetId}_${currentPath}`;
        let folderNode = folderMap.get(folderId);

        if (!folderNode) {
          folderNode = {
            id: folderId,
            label: part,
            type: 'folder',
            path: currentPath,
            children: [],
          };
          folderMap.set(folderId, folderNode);
          currentLevel.push(folderNode);
        }
        currentLevel = folderNode.children;
      }
    }
  });

  return tree;
}
