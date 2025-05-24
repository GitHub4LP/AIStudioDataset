import { defineStore } from 'pinia';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs
import i18n from '@/i18n'; // Import the i18n instance
import { useDatasetStore } from './datasetStore'; // Import the dataset store

export const useUploadStore = defineStore('upload', {
  state: () => ({
    tasks: [], // Array of task objects
    // Concurrency management
    maxConcurrentLocalUploads: 3,
    maxConcurrentServerUploads: 2,
    activeLocalUploads: 0,
    activeServerUploads: 0,
    pendingQueue: [], // Stores task IDs that are waiting for a slot
    sseConnections: {}, // Stores active EventSource connections by taskId
    // Example task:
    // {
    //   id: 'uuid-123',
    //   name: 'MyImage.jpg',
    //   type: 'file', // 'file' or 'folder'
    //   status: 'pending', // 'pending', 'uploading', 'processing', 'completed', 'failed'
    //   progress: 0, // 0-100.
    //   error: null, // Error message string
    //   subTasks: [], // For folder uploads, array of similar task objects
    //   createdAt: Date.now(), // For sorting or timeout logic
    //   targetDatasetId: 'dataset-uuid-456',
    //   targetDatasetName: 'My Research Data',
    //   uploadType: 'local-file', // 'local-file', 'local-folder', 'server-file', 'server-folder', 'url-fetch'
    //   fileId: null, // Populated after successful upload & registration
    //   fileAbs: null // Populated after successful upload & registration
    // }
  }),

  getters: {
    activeTasks: (state) => state.tasks.filter(task => task.status !== 'completed' && task.status !== 'failed'),
    completedTasks: (state) => state.tasks.filter(task => task.status === 'completed' || task.status === 'failed'),
    allTasksSorted: (state) => [...state.tasks].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    getTaskById: (state) => (taskId) => state.tasks.find(t => t.id === taskId),
  },

  actions: {
    async _finalizeTask(taskId) { // Make the function async
      const task = this.tasks.find(t => t.id === taskId);
      if (!task) {
        console.warn(`_finalizeTask: Task with ID ${taskId} not found.`);
        return;
      }

      if (task.uploadType.startsWith('local')) {
        this.activeLocalUploads = Math.max(0, this.activeLocalUploads - 1);
        console.debug(`_finalizeTask: Decremented activeLocalUploads for ${taskId}. New count: ${this.activeLocalUploads}`);
      } else if (task.uploadType.startsWith('server')) {
        this.activeServerUploads = Math.max(0, this.activeServerUploads - 1);
        console.debug(`_finalizeTask: Decremented activeServerUploads for ${taskId}. New count: ${this.activeServerUploads}`);
      }
      // URL fetches do not have their own counters in this system.

      if (this.sseConnections[taskId]) {
        this.sseConnections[taskId].close();
        delete this.sseConnections[taskId];
        console.log(`_finalizeTask: SSE Connection closed for task: ${taskId}`);
      }

      // Trigger dataset refresh for completed tasks with a targetDatasetId
      if (task && task.targetDatasetId && 
          (task.status === 'completed' || task.status === 'completed_folder' || task.status === 'completed_folder_with_errors')) {
          
          console.log(`Upload task ${task.id} (${task.name}) completed for dataset ${task.targetDatasetId}. Triggering dataset refresh.`);
          const datasetStore = useDatasetStore(); // Get store instance here
          try {
              await datasetStore.fetchDatasetDetails(task.targetDatasetId, true); // Force refresh
              console.log(`Dataset ${task.targetDatasetId} refreshed successfully after task ${task.id} completion.`);
          } catch (error) {
              console.error(`Error refreshing dataset ${task.targetDatasetId} after task ${task.id} completion:`, error);
              // Optionally, you could dispatch a global error notification here if needed
          }
      }

      this.processUploadQueue();
    },

    // Initializes a new task and adds it to the main tasks list.
    // This task is then pushed to the pendingQueue to await processing.
    addTask(taskDetails) { // taskDetails will now include the actual file object for local uploads
      const newTask = {
        id: taskDetails.id || uuidv4(), // This is the taskId
        name: taskDetails.name,
        type: taskDetails.type || 'file',
        uploadType: taskDetails.uploadType || 'local-file', // Crucial for concurrency type
        status: 'queued', // New initial status
        progress: 0,
        error: null,
        subTasks: taskDetails.subTasks || [],
        createdAt: Date.now(),
        targetDatasetId: taskDetails.targetDatasetId || null,
        targetDatasetName: taskDetails.targetDatasetName || null,
        fileId: null,
        fileAbs: null,
        // Store raw file data if provided, for local uploads
        fileData: taskDetails.fileData || null, 
        // Store server file path if provided
        serverFilePath: taskDetails.serverFilePath || null,
        // Store URL if provided
        fetchUrl: taskDetails.fetchUrl || null,
        uploadId: null, // Will be generated when task processing starts (for SSE)
        eventSource: null, // To store the EventSource object for this task
        ...taskDetails,
      };
      this.tasks.push(newTask);
      this.pendingQueue.push(newTask.id); // Add task ID to pending queue
      this.processUploadQueue(); // Attempt to process the queue
      return newTask.id;
    },
    
    // Helper to update task with SSE data
    _handleSSEMessage(taskId, data) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        console.log(`SSE Message for ${taskId}:`, data);

        if (data.status) {
            task.status = data.status;
        }
        if (data.progress !== undefined) {
            task.progress = data.progress;
        }
        if (data.error) {
            task.error = data.error;
        }
        if (data.fileId) {
            task.fileId = data.fileId;
        }
        if (data.fileAbs) {
            task.fileAbs = data.fileAbs;
        }
        // For folder uploads, individual file updates might come through SSE
        if (task.type === 'folder' && data.individualFileName) {
            let subTask = task.subTasks.find(st => st.name === data.individualFileName);
            if (!subTask) { // Create subTask if it doesn't exist based on SSE message
                subTask = {
                    id: uuidv4(),
                    name: data.individualFileName,
                    type: 'file', // Ensure this is set for new sub-tasks from SSE
                    status: data.status,      // From SSE data specific to this file
                    progress: data.progress || 0, // From SSE data
                    error: data.error || null,    // From SSE data
                    fileId: data.fileId || null,  // From SSE data
                    fileAbs: data.fileAbs || null, // From SSE data
                    parentId: task.id,          // Optional, for clarity
                    // Any other relevant fields for a file task can be added here if needed
                };
                task.subTasks.push(subTask);
            } else {
                if (data.status) subTask.status = data.status;
                if (data.progress !== undefined) subTask.progress = data.progress;
                if (data.error) subTask.error = data.error;
                if (data.fileId) subTask.fileId = data.fileId;
                if (data.fileAbs) subTask.fileAbs = data.fileAbs;
            }
            // Recalculate overall folder progress if needed (simplified here)
             this.updateSubTaskStatus(task.id, subTask.id, subTask.status, subTask.progress, subTask.error, { fileId: subTask.fileId, fileAbs: subTask.fileAbs });
        }


        if (data.status === 'completed' || data.status === 'failed' || data.status === 'completed_folder' || data.status === 'completed_folder_with_errors') {
            this._finalizeTask(taskId);
        }
    },


    updateTaskStatus(taskId, status, progress, error = null, fileDetails = {}) {
      const task = this.tasks.find(t => t.id === taskId);
      if (task) {
        if (status !== undefined) task.status = status;
        if (progress !== undefined) task.progress = progress;
        if (error !== undefined) task.error = error;

        if (status === 'completed') {
          if (fileDetails.fileId !== undefined) task.fileId = fileDetails.fileId;
          if (fileDetails.fileAbs !== undefined) task.fileAbs = fileDetails.fileAbs;
        }

        // Folder task status propagation
        if (task.type === 'folder') {
          if (status === 'completed') {
            task.subTasks.forEach(st => {
              if (st.status !== 'failed') {
                st.status = 'completed';
                st.progress = 100;
                // fileId and fileAbs for subtasks should be set via updateSubTaskStatus
              }
            });
          } else if (status === 'failed') {
            task.subTasks.forEach(st => {
              if (['pending', 'uploading', 'processing'].includes(st.status)) {
                st.status = 'failed';
                st.error = st.error || i18n.global.t('error.parentTaskFailed');
              }
            });
          }
        }
      } else {
        console.warn(`Task with ID ${taskId} not found for update.`);
      }
    },

    // For more granular control if needed
    startUploadingTask(taskId, totalSize = 0) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = 'uploading';
            task.progress = 0;
            task.totalSize = totalSize; // Optional: store total size for progress calculation
        }
    },

    updateTaskProgress(taskId, loadedBytes) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task && task.totalSize) {
            task.progress = Math.round((loadedBytes / task.totalSize) * 100);
        } else if (task) {
            // Fallback if totalSize not set, or use a different progress update logic
            // For phase 1, this might just be 0 or 100.
        }
    },

    // Sub-task specific actions
    // Add a subtask to a parent folder task
    addSubTask(parentTaskId, subTaskDetails) {
      const parentTask = this.tasks.find(t => t.id === parentTaskId);
      if (parentTask && parentTask.type === 'folder') {
        const newSubTask = {
          id: subTaskDetails.id || uuidv4(),
          name: subTaskDetails.name,
          type: 'file', // Sub-tasks are typically files
          status: 'pending',
          progress: 0,
          error: null,
          createdAt: Date.now(),
          parentId: parentTaskId, // Link back to parent
           ...subTaskDetails,
        };
        parentTask.subTasks.push(newSubTask);
        return newSubTask.id;
      } else {
        console.warn(`Parent folder task with ID ${parentTaskId} not found or not a folder.`);
        return null;
      }
    },

    updateSubTaskStatus(parentTaskId, subTaskId, status, progress, error = null, fileDetails = {}) {
      const parentTask = this.tasks.find(t => t.id === parentTaskId);
      if (parentTask && parentTask.subTasks) {
        const subTask = parentTask.subTasks.find(st => st.id === subTaskId);
        if (subTask) {
          if (status !== undefined) subTask.status = status;
          if (progress !== undefined) subTask.progress = progress;
          if (error !== undefined) subTask.error = error;

          if (status === 'completed') {
            if (fileDetails.fileId !== undefined) subTask.fileId = fileDetails.fileId;
            if (fileDetails.fileAbs !== undefined) subTask.fileAbs = fileDetails.fileAbs;
          }

          // Update parent folder task's progress based on subtasks
          let completedSubTasks = 0;
          let totalProgress = 0;
          parentTask.subTasks.forEach(st => {
            totalProgress += st.progress;
            if (st.status === 'completed' || st.status === 'failed') {
              completedSubTasks++;
            }
          });
          parentTask.progress = parentTask.subTasks.length > 0 ? Math.round(totalProgress / parentTask.subTasks.length) : 0;

          // If all subtasks are done, mark parent as completed or failed
          if (completedSubTasks === parentTask.subTasks.length && parentTask.subTasks.length > 0) {
            const hasFailures = parentTask.subTasks.some(st => st.status === 'failed');
            parentTask.status = hasFailures ? 'completed_folder_with_errors' : 'completed_folder';
            parentTask.error = hasFailures ? (parentTask.error || i18n.global.t('error.folderUploadPartialFailure')) : null;
          }
          
        } else {
          console.warn(`SubTask with ID ${subTaskId} not found in parent ${parentTaskId}.`);
        }
      }
    },

    removeTask(taskId) {
      const task = this.tasks.find(t => t.id === taskId);
      if (task && this.sseConnections[task.id]) {
        this.sseConnections[task.id].close();
        delete this.sseConnections[task.id];
        console.log(`SSE Connection closed for removed task: ${task.id}`);
      }
      this.tasks = this.tasks.filter(t => t.id !== taskId);
      // Also remove from pendingQueue if it's there
      this.pendingQueue = this.pendingQueue.filter(id => id !== taskId);
    },

    clearCompleted() {
      this.tasks.forEach(task => {
        if ((task.status === 'completed' || task.status === 'failed') && this.sseConnections[task.id]) {
          this.sseConnections[task.id].close();
          delete this.sseConnections[task.id];
        }
      });
      this.tasks = this.tasks.filter(task => task.status !== 'completed' && task.status !== 'failed');
    },
    
    clearAllTasks() {
        this.tasks.forEach(task => {
            if (this.sseConnections[task.id]) {
                this.sseConnections[task.id].close();
                delete this.sseConnections[task.id];
            }
        });
        this.tasks = [];
        this.pendingQueue = [];
        this.activeLocalUploads = 0;
        this.activeServerUploads = 0;
    },

    async _performActualUpload(task) {
      // Generate uploadId for SSE connection
      task.uploadId = uuidv4(); // Assign unique ID for this specific upload attempt
      console.log(`Starting actual upload for ${task.name}, taskId: ${task.id}, uploadId: ${task.uploadId}`);
      this.updateTaskStatus(task.id, 'uploading', 0); // Initial status update

      const eventSource = new EventSource(`/api/sse/upload-progress/${task.uploadId}`);
      this.sseConnections[task.id] = eventSource; // Store connection

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this._handleSSEMessage(task.id, data);
        } catch (e) {
          console.error(`Error parsing SSE message for task ${task.id}:`, e, event.data);
        }
      };

      eventSource.onerror = (err) => {
        console.error(`EventSource failed for task ${task.id} (uploadId: ${task.uploadId}):`, err);
        // Don't close connection here, server might have already done so or it's a temp network issue.
        // If server closes, 'completed' or 'failed' message should handle it.
        // If it's a persistent error, task might remain in 'uploading' or be marked 'failed' by a timeout mechanism (not yet implemented).
        // For now, we assume the server will send a final status or the connection will be closed by other means.
        // However, if the error implies a total failure to connect or immediate closure, we might act.
        if (task.status === 'uploading' || task.status === 'queued') { // Only if still in an active phase
             this._handleSSEMessage(task.id, { status: 'failed', error: i18n.global.t('error.sseConnectionError') });
        }
        // eventSource.close(); // Closing here might prevent retries or server's own final messages
        // delete this.sseConnections[task.id];
      };
      
      // Simulate the API call that triggers the backend process
      // This would be an actual fetch/XHR call in a real app.
      try {
        // Ensure task status is 'uploading' before API call
        // this.updateTaskStatus(task.id, 'uploading', task.progress); // Already done before calling _performActualUpload or at the start of it.

        let apiUrl;
        const requestBody = {
            uploadId: task.uploadId,
            fileName: task.name,
            targetDatasetId: task.targetDatasetId,
            targetDatasetName: task.targetDatasetName,
            // other necessary details from task object
        };
        const formData = new FormData(); // For local file uploads

        if (task.uploadType.startsWith('local')) {
            apiUrl = '/api/upload/local-to-dataset';
            if (!task.fileData) { // fileData should be the File object
                throw new Error("Local upload task missing fileData.");
            }
            formData.append('file', task.fileData, task.name); // 'file' is the field name multer expects
            formData.append('uploadId', task.uploadId);
            formData.append('datasetName', task.targetDatasetName || task.name);
            formData.append('datasetAbs', task.targetDatasetAbs || 'Uploaded via SSE');
            // Add tags if any: formData.append('tags', JSON.stringify(task.tags || []));
            
            // Simulate XHR for client-side progress
            const xhr = new XMLHttpRequest();
            xhr.open('POST', apiUrl, true);

            // Client-to-server upload progress
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const clientProgress = Math.round((event.loaded / event.total) * 100 * 0.05); // Client upload is 5% of total
                    this.updateTaskStatus(task.id, 'uploading', clientProgress);
                }
            };
            
            // This will be handled by SSE now mostly
            // xhr.onload = () => { /* Server will send SSE for final status */ };
            // xhr.onerror = () => { /* SSE error handler will manage this */ };

            xhr.send(formData);
            // The rest of the progress (BOS upload, AI Studio add) will be via SSE.

        } else if (task.uploadType.startsWith('server')) {
            apiUrl = '/api/upload/to-dataset'; // Assuming this is the correct endpoint
            requestBody.filePath = task.serverFilePath; // Path on the server
            requestBody.folderPath = task.serverFolderPath; // Optional, if it's a folder within a base path
            
            await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });
        } else if (task.uploadType === 'url-fetch') {
            apiUrl = '/api/upload/fetch-to-dataset';
            requestBody.url = task.fetchUrl;
            // Add other params like referer, userAgent if available in task
             await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });
        } else {
          throw new Error(i18n.global.t('error.unknownUploadType', { type: task.uploadType }));
        }
        console.log(`API call made for ${task.name} to ${apiUrl}`);
        // Note: The `finally` block of the main processing loop will handle decrementing concurrency counters.
        // The EventSource connection will remain open until the server closes it or sends a final message.
      } catch (error) {
          console.error(`API call failed for task ${task.id}:`, error);
          // _handleSSEMessage will call _finalizeTask, which handles counters and SSE connection cleanup.
          this._handleSSEMessage(task.id, { status: 'failed', error: i18n.global.t('error.apiCallError', { message: error.message }) });
          // No need to manually close SSE here, _finalizeTask will do it.
          // No need to manually decrement counters here if _finalizeTask is robustly called.
          // processUploadQueue will be called by _finalizeTask.
      }
    },

    processUploadQueue() {
      if (this.pendingQueue.length === 0) {
        console.debug('Pending queue is empty. Nothing to process.');
        return;
      }
      console.debug(`Processing upload queue. Pending: ${this.pendingQueue.length}, Active Local: ${this.activeLocalUploads}, Active Server: ${this.activeServerUploads}`);

      for (let i = 0; i < this.pendingQueue.length; i++) {
        const taskId = this.pendingQueue[i];
        const task = this.tasks.find(t => t.id === taskId); 

        if (!task) {
          console.warn(`Task ID ${taskId} found in queue but not in tasks list. Removing from queue.`);
          this.pendingQueue.splice(i, 1);
          i--; 
          continue;
        }
        
        if (task.status !== 'queued') {
          console.warn(`Task ${task.id} (${task.name}) is in queue but status is ${task.status}. Skipping.`);
          continue;
        }

        let slotAvailable = false;
        let isLocalTaskType = false;
        let isServerTaskType = false;

        if (task.uploadType.startsWith('local')) {
          isLocalTaskType = true;
          if (this.activeLocalUploads < this.maxConcurrentLocalUploads) {
            this.activeLocalUploads++;
            slotAvailable = true;
          }
        } else if (task.uploadType.startsWith('server')) {
          isServerTaskType = true;
          if (this.activeServerUploads < this.maxConcurrentServerUploads) {
            this.activeServerUploads++;
            slotAvailable = true;
          }
        } else if (task.uploadType === 'url-fetch') {
          slotAvailable = true; // URL fetches don't use these counters
        } else {
          console.warn(`Unknown upload type for task ${task.id}: ${task.uploadType}. Cannot process.`);
          this.updateTaskStatus(task.id, 'failed', 0, i18n.global.t('error.unknownUploadType', { type: task.uploadType }));
          this.pendingQueue.splice(i, 1);
          i--;
          continue;
        }

        if (slotAvailable) {
          this.pendingQueue.splice(i, 1); 
          i--; 

          // The _performActualUpload now handles its own async lifecycle with SSE.
          // The decrementing of counters and re-processing of queue is now tied to SSE completion/error
          // or initial API call failure within _performActualUpload.
          this._performActualUpload(task)
            .then(() => {
                // console.log(`_performActualUpload promise chain initiated for ${task.name}`);
            })
            .catch(error => {
                // This .catch() is for synchronous errors thrown by _performActualUpload setup *before* the try/catch inside _performActualUpload.
                // For example, if _performActualUpload itself was not an async function and threw directly.
                // Given _performActualUpload is async and has its own try/catch that calls _handleSSEMessage -> _finalizeTask,
                // this specific catch block in processUploadQueue might become less critical for counter management,
                // as _finalizeTask should handle it. However, it's a good safety net.
                console.error(`Error during initial call to _performActualUpload for ${task.name}:`, error);
                
                // Directly ensure task is failed and finalized if _performActualUpload itself errors out early.
                // This is a fallback. Ideally, errors within _performActualUpload are caught there.
                this.updateTaskStatus(task.id, 'failed', task.progress, error.message || i18n.global.t('error.operationFailed'));
                
                // Call _finalizeTask directly to ensure cleanup and queue processing.
                // This covers cases where _performActualUpload might not even start its try-catch block.
                this._finalizeTask(task.id); 
            });
        } else {
            console.debug(`No slot for task ${task.name} (Type: ${task.uploadType}). Local: ${this.activeLocalUploads}/${this.maxConcurrentLocalUploads}, Server: ${this.activeServerUploads}/${this.maxConcurrentServerUploads}`);
        }
      } 
    }
  },
});
