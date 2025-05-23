import { defineStore } from 'pinia';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

export const useUploadStore = defineStore('upload', {
  state: () => ({
    tasks: [], // Array of task objects
    // Example task:
    // {
    //   id: 'uuid-123',
    //   name: 'MyImage.jpg',
    //   type: 'file', // 'file' or 'folder'
    //   status: 'pending', // 'pending', 'uploading', 'processing', 'completed', 'failed'
    //   progress: 0, // 0-100. For Phase 1, can be 0 or 100.
    //   error: null, // Error message string
    //   subTasks: [], // For folder uploads, array of similar task objects
    //   createdAt: Date.now() // For sorting or timeout logic
    // }
  }),

  getters: {
    activeTasks: (state) => state.tasks.filter(task => task.status !== 'completed' && task.status !== 'failed'),
    completedTasks: (state) => state.tasks.filter(task => task.status === 'completed' || task.status === 'failed'),
    allTasksSorted: (state) => [...state.tasks].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
  },

  actions: {
    addTask(taskDetails) {
      const newTask = {
        id: taskDetails.id || uuidv4(),
        name: taskDetails.name,
        type: taskDetails.type || 'file',
        status: 'pending',
        progress: 0,
        error: null,
        subTasks: taskDetails.subTasks || [], // Initialize if provided
        createdAt: Date.now(),
        // Any other details passed in
        ...taskDetails, 
      };
      this.tasks.push(newTask);
      return newTask.id; // Return the ID of the new task
    },

    updateTaskStatus(taskId, status, progress, error = null) {
      const task = this.tasks.find(t => t.id === taskId);
      if (task) {
        if (status !== undefined) task.status = status;
        if (progress !== undefined) task.progress = progress;
        if (error !== undefined) task.error = error; // Allow setting error to null explicitly

        // If a folder task is marked completed, ensure all its subtasks are also completed.
        // Or, if it failed, mark subtasks appropriately if they are still pending/uploading.
        if (task.type === 'folder') {
            if (status === 'completed') {
                task.subTasks.forEach(st => {
                    if (st.status !== 'failed') st.status = 'completed'; st.progress = 100;
                });
            } else if (status === 'failed') {
                 task.subTasks.forEach(st => {
                    if (st.status === 'pending' || st.status === 'uploading' || st.status === 'processing') {
                        st.status = 'failed';
                        st.error = st.error || "Parent task failed";
                    }
                });
            }
        }

      } else {
        console.warn(`Task with ID ${taskId} not found for update.`);
      }
    },
    
    // For more granular control if needed, especially for folder uploads
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

    updateSubTaskStatus(parentTaskId, subTaskId, status, progress, error = null) {
      const parentTask = this.tasks.find(t => t.id === parentTaskId);
      if (parentTask && parentTask.subTasks) {
        const subTask = parentTask.subTasks.find(st => st.id === subTaskId);
        if (subTask) {
          if (status !== undefined) subTask.status = status;
          if (progress !== undefined) subTask.progress = progress;
          if (error !== undefined) subTask.error = error;

          // Update parent folder task's progress based on subtasks
          // This is a simple average; more sophisticated logic might be needed (e.g., weighted by size)
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
            parentTask.status = hasFailures ? 'failed' : 'completed';
            parentTask.error = hasFailures ? (parentTask.error || 'One or more files failed to upload.') : null;
          }
          
        } else {
          console.warn(`SubTask with ID ${subTaskId} not found in parent ${parentTaskId}.`);
        }
      }
    },

    removeTask(taskId) {
      this.tasks = this.tasks.filter(t => t.id !== taskId);
    },

    clearCompleted() {
      this.tasks = this.tasks.filter(task => task.status !== 'completed' && task.status !== 'failed');
    },
    
    clearAllTasks() {
        this.tasks = [];
    }
  },
});
