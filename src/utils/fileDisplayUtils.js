// src/utils/fileDisplayUtils.js

import { Document, Picture as PictureIcon, Folder as FolderIcon, VideoCamera, Headset, Files as ZipIcon, Grid } from '@element-plus/icons-vue'; // Example, not directly used for SVG paths

// Default SVG path for a generic document
const DEFAULT_DOCUMENT_ICON_PATH = "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z";
// SVG path for a folder icon (alternative to Element Plus Folder icon if needed)
// const FOLDER_ICON_PATH = "M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z";

export function formatFileSize(size) {
  if (size === undefined || size === null || Number.isNaN(size)) return '-';
  if (size === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(size) / Math.log(k));
  if (i < 0 || i >= sizes.length) return `${size} B`; // Fallback for very small or very large numbers
  return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const EXTENSION_TO_ICON_MAP = {
  // Documents
  'pdf': { path: "M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5H14v1.5h-1.5v-6H14c.83 0 1.5.67 1.5 1.5v3zm4-3H17v3h1.5v-3zM9 9.5h1v-1H9v1z", color: '#FF5722' }, // PDF icon (example, consider a real PDF icon SVG)
  'doc': { path: DEFAULT_DOCUMENT_ICON_PATH, color: '#2196F3' },
  'docx': { path: DEFAULT_DOCUMENT_ICON_PATH, color: '#2196F3' },
  'xls': { path: DEFAULT_DOCUMENT_ICON_PATH, color: '#4CAF50' },
  'xlsx': { path: DEFAULT_DOCUMENT_ICON_PATH, color: '#4CAF50' },
  'ppt': { path: DEFAULT_DOCUMENT_ICON_PATH, color: '#FF9800' },
  'pptx': { path: DEFAULT_DOCUMENT_ICON_PATH, color: '#FF9800' },
  'txt': { path: "M14 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15h8v2H8v-2zm0-4h8v2H8v-2z", color: '#9E9E9E' }, // Text file
  'csv': { path: DEFAULT_DOCUMENT_ICON_PATH, color: '#4CAF50' },

  // Archives
  'zip': { path: "M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM10 4h4v2h-4V4zm10 16H4V8h16v12z", color: '#FFC107' }, // Zip icon
  'rar': { path: "M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM10 4h4v2h-4V4zm10 16H4V8h16v12z", color: '#00BCD4' },
  'tar': { path: "M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM10 4h4v2h-4V4zm10 16H4V8h16v12z", color: '#795548' },
  'gz': { path: "M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM10 4h4v2h-4V4zm10 16H4V8h16v12z", color: '#795548' },


  // Images
  'jpg': { path: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z", color: '#8BC34A' }, // Generic image icon
  'jpeg': { path: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z", color: '#8BC34A' },
  'png': { path: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z", color: '#8BC34A' },
  'gif': { path: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z", color: '#8BC34A' },
  'svg': { path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-14h2v4h-2V6zm0 6h2v2h-2v-2z", color: '#FFEB3B' }, // Generic vector/logo icon

  // Audio
  'mp3': { path: "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6zm-2 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z", color: '#03A9F4' }, // Music note icon
  'wav': { path: "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6zm-2 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z", color: '#009688' },
  'ogg': { path: "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6zm-2 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z", color: '#009688' },


  // Video
  'mp4': { path: "M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z", color: '#E91E63' }, // Video camera icon
  'mov': { path: "M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z", color: '#E91E63' },
  'avi': { path: "M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z", color: '#E91E63' },
  'wmv': { path: "M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z", color: '#E91E63' },


  // Code / Data
  'json': { path: "M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z", color: '#607D8B' }, // Code brackets
  'xml': { path: "M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z", color: '#607D8B' },
  'html': { path: "M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z", color: '#FF5722' },
  'css': { path: "M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z", color: '#2196F3' },
  'js': { path: "M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z", color: '#FFEB3B' },
  'py': { path: "M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z", color: '#4CAF50' },
  // Add more for java, c, cpp, go, rb, php, sh etc.
  'default': { path: DEFAULT_DOCUMENT_ICON_PATH, color: '#B0BEC5' }, // Default greyish color
};

const MIME_TYPE_TO_COLOR_MAP = {
  'application/pdf': '#D32F2F',
  'application/msword': '#1976D2',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '#1976D2',
  'application/vnd.ms-excel': '#388E3C',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '#388E3C',
  'application/vnd.ms-powerpoint': '#F57C00',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '#F57C00',
  'application/zip': '#FFA000',
  'application/x-rar-compressed': '#0097A7',
  'application/x-tar': '#5D4037',
  'application/gzip': '#5D4037',
  'image/jpeg': '#689F38',
  'image/png': '#689F38',
  'image/gif': '#689F38',
  'image/svg+xml': '#FBC02D',
  'audio/mpeg': '#0288D1',
  'audio/wav': '#00796B',
  'video/mp4': '#D81B60',
  'video/quicktime': '#D81B60',
  'text/plain': '#757575',
  'text/html': '#E64A19',
  'text/css': '#1976D2',
  'application/json': '#546E7A',
  'application/xml': '#546E7A',
  'text/xml': '#546E7A',
  'application/javascript': '#FBC02D',
  'text/javascript': '#FBC02D',
  // Default color if not found by specific extension or MIME
  'default': '#B0BEC5',
};


export function getFileIconDetails(fileName, contentType) {
  let extension = '';
  if (fileName) {
    const nameParts = fileName.toLowerCase().split('.');
    if (nameParts.length > 1) {
      extension = nameParts.pop();
      // Handle multi-part extensions like 'tar.gz'
      if ((extension === 'gz' || extension === 'bz2') && nameParts.length > 1) {
        const prevPart = nameParts.pop();
        if (prevPart === 'tar') {
          extension = `${prevPart}.${extension}`; // e.g., 'tar.gz'
        }
      }
    }
  }

  const iconSet = EXTENSION_TO_ICON_MAP[extension] || EXTENSION_TO_ICON_MAP['default'];
  let color = iconSet.color; // Color from extension map

  // Try to get a more specific color from MIME type if available and no color from extension
  if (contentType) {
    const mimeTypeBase = contentType.split(';')[0]; // Remove parameters like charset
    if (MIME_TYPE_TO_COLOR_MAP[mimeTypeBase]) {
      color = MIME_TYPE_TO_COLOR_MAP[mimeTypeBase];
    } else if (!color) { // Only use default MIME color if extension map didn't provide one
      color = MIME_TYPE_TO_COLOR_MAP['default'];
    }
  }
  
  return {
    path: iconSet.path,
    color: color || MIME_TYPE_TO_COLOR_MAP['default'], // Final fallback color
  };
}


export function getFileIconPath(fileName, contentType) {
  return getFileIconDetails(fileName, contentType).path;
}

export function getFileIconColor(fileName, contentType) {
  return getFileIconDetails(fileName, contentType).color;
}
