export default {
  common: {
    loading: `加载中...`,
    success: `成功`,
    error: `错误`,
    confirm: `确认`,
    cancel: `取消`,
    save: `保存`,
    delete: `删除`,
    edit: `编辑`,
    search: `搜索`,
    upload: `上传`,
    download: `下载`,
    back: `返回`,
    next: `下一步`,
    previous: `上一步`,
    finish: `完成`,
    page: `页`,
    none: `无`
  },
  file: {
    name: `文件名`,
    size: `大小`,
    type: `类型`,
    lastModified: `最后修改时间`,
    uploadSuccess: `文件上传成功`,
    uploadFailed: `文件上传失败`,
    deleteConfirm: `确定要删除此文件吗？`,
    deleteSuccess: `文件删除成功`,
    deleteFailed: `文件删除失败`,
    source: `文件源 (通过文件创建新数据集)`,
    server: `服务器文件`,
    local: `本地文件`,
    urlFetch: `URL抓取`,
    selectBasePath: `选择基础路径`,
    dragOrClick: `拖拽文件到此处或 点击上传`,
    autoAddTip: `文件处理后将自动添加至下方"已选文件"列表`,
    selectFolder: `选择文件夹`,
    url: `文件URL`,
    urlRequired: `请输入URL`,
    urlInvalid: `请输入有效的URL`,
    urlPlaceholder: `http(s)://...`,
    nameRequired: `请输入文件名`,
    namePlaceholder: `例如: data.zip`,
    referer: `Referer`,
    userAgent: `User-Agent`,
    optional: `可选`,
    fetching: `抓取中...`,
    fetchAndAdd: `抓取并添加文件`,
    getFileListFailed: `获取文件列表失败`,
    empty: `当前目录为空`,
    selectedFiles: `已选文件 (准备创建新数据集)`,
    operation: `操作`,
    createDataset: `通过文件创建新数据集`,
    processingServerFiles: `处理服务器文件中...`,
    processingLocalFiles: `处理本地文件中...`,
    processingUrlFiles: `处理URL文件中...`,
    uploadLocalFiles: `上传本地文件/文件夹到此...`,
    addServerItems: `从服务器添加文件/文件夹到此...`,
    addUrlFile: `通过URL添加文件到此...`,
    deleteDataset: `删除数据集`,
    deleteDatasetConfirm: `确定要删除数据集 "{name}" 吗？此操作不可恢复！`,
    deleteDatasetTitle: `删除数据集确认`,
    confirmDelete: `确定删除`,
    cancelDelete: `取消`,
    deleteSuccess: `数据集 "{name}" 已删除。`,
    deleteFailed: `删除失败: {error}`,
    refreshFailed: `文件已上传，但刷新数据集详情失败: {error}`,
    datasetInconsistent: `数据集状态可能不一致，请刷新页面`,
    local: `本地`,
    fileProcessSuccess: `本地文件 {name} 处理成功。`,
    fileProcessFailed: `处理本地文件 {name} 失败: {error}`,
    folderFilesProcessed: `{count}个文件夹内文件已处理。`,
    folderFilesPartialFailed: `部分文件夹内文件处理失败。`,
    urlFileSuccess: `URL文件 {name} 处理成功。`,
    urlFileFailed: `抓取URL文件失败: {error}`,
    checkUrlForm: `请检查URL抓取表单输入。`,
    addFilesToDataset: `添加文件到数据集: {name}`,
    uploadLocal: `上传本地文件`,
    addFromUrl: `从URL添加`,
    fileName: `文件名`,
    fileNamePlaceholder: `输入文件名`,
    refererPlaceholder: `输入referer URL (可选)`,
    userAgentPlaceholder: `输入user agent (可选)`,
    noPreview: `此文件无预览`,
    unknown: `未知`,
    deleteTitle: `删除文件`,
    downloadSuccess: `文件下载成功`,
    downloadFailed: `文件下载失败: {error}`,
    loadingFiles: `加载文件中...`,
    processingFiles: `处理文件中...`,
    addFiles: `添加文件`,
    removeFile: `移除文件`,
    removeFileConfirm: `确定要从数据集中移除此文件吗？`,
    removeFileSuccess: `文件已从数据集中移除`,
    removeFileFailed: `移除文件失败: {error}`,
    details: `文件详情: {name}`,
    folderDetails: `文件夹详情: {name}`,
    serverFile: `服务器文件: {name}`,
    id: `文件ID`,
    datasetId: `数据集ID`,
    path: `路径`,
    nodeId: `节点ID`,
    emptyFolder: `此文件夹为空`,
    fullPath: `完整路径`,
    unknownSize: `未知大小`,
    dropInstruction: `将文件拖放到此处或树中的数据集/文件夹。`,
    dropTargetInvalid: `无效的放置目标。请拖放到数据集或文件夹中。`,
    noValidFilesDropped: `拖放的项目中未找到有效文件。`,
    folderDropInfo: `对于文件夹，将处理其直接包含的文件。对于嵌套结构，请使用上传对话框中的"选择文件夹"按钮。`,
    noFilesDropped: `未拖放任何文件。`,
    dropError: `处理拖放的文件时出错。`,
    addMultipleItems: `添加 {count} 个项目`,
    registrationFailed: `{name} 注册失败: {error}`,
    noActualFilesRegistered: `操作完成，但没有新文件被注册（例如，空文件夹或已存在的项目）。`,
    drop: {
      serverItemDrop: "服务器项拖放: {name}",
      serverItemType: "类型: {type}",
      serverItemPath: "路径: {path}",
      featureInDevelopment: "(功能开发中)",
      invalidServerData: "无效的服务器文件拖放数据。"
    }
  },
  dataset: {
    name: `数据集`,
    description: `描述`,
    tags: `标签`,
    createTime: `创建时间`,
    updateTime: `更新时间`,
    size: `大小`,
    fileCount: `文件数量`,
    createSuccess: `数据集创建成功`,
    createFailed: `数据集创建失败`,
    updateSuccess: `数据集更新成功`,
    updateFailed: `数据集更新失败`,
    deleteSuccess: `数据集删除成功`,
    deleteFailed: `数据集删除失败`,
    createEmpty: `新建空数据集`,
    empty: `暂无数据集`,
    createTitle: `创建新数据集`,
    editTitle: `编辑数据集详情`,
    namePlaceholder: `请输入数据集名称`,
    descriptionPlaceholder: `请输入数据集描述`,
    loadingConstraints: `加载约束条件...`,
    loadingDetails: `加载数据集中...`,
    nameRequired: `数据集名称不能为空`,
    nameTooLong: `数据集名称长度不能超过 {maxLength}`,
    descriptionTooLong: `数据集描述长度不能超过 {maxLength}`,
    addTag: `+ 添加标签`,
    tagTip: `最多添加 {maxCount} 个标签，单个标签长度不超过 {maxLength}，总长度不超过 {maxLengthAll}。`,
    tagTooLong: `标签 {tag} 长度不能超过 {maxLength} 个字符`,
    tooManyTags: `最多只能添加 {maxCount} 个标签`,
    tagsTotalTooLong: `所有标签总长度不能超过 {maxLengthAll} 个字符`,
    selectItem: `请在左侧选择一个项目以查看详情`,
    details: `数据集详情: {name}`,
    edit: `编辑数据集`,
    id: `数据集ID`,
    containedItems: `包含的项目`,
    node: {
      folder: `文件夹`,
      file: `文件`,
      removeFile: `移除文件`,
      removeFileConfirm: `确定要从数据集中移除此文件吗？`,
      fileSize: `文件大小`,
      expand: `展开`,
      collapse: `折叠`,
      noPreview: `此文件无预览`,
      loading: `加载中...`,
      error: `加载失败`,
      id: `ID`,
      name: `名称`,
      datasetId: `数据集ID`,
      path: `路径`,
      type: `类型`,
      size: `大小`,
      unknown: `未知`,
      download: `下载`,
      addFiles: `添加文件`,
      fileDetails: `文件详情：{name}`,
      folderDetails: `文件夹详情：{name}`,
      serverFileDetails: `服务器文件详情：{name}`,
      emptyFolder: `此文件夹为空`,
      fullPath: `完整路径`
    }
  },
  error: {
    networkError: `网络错误`,
    serverError: `服务器错误`,
    fileTooLarge: `文件太大`,
    invalidFileType: `无效的文件类型`,
    pathNotAllowed: `路径不允许访问`,
    operationFailed: `未知错误`,
    loadDatasetFailed: `加载数据集出错`,
    cannotDetermineFile: `无法确定要操作的文件`,
    unknownFileId: `未知的文件ID`,
    unknownDatasetId: `未知的数据集ID`,
    apiCallError: "API 调用错误: {message}",
    sseConnectionError: "SSE 连接错误",
    unknownUploadType: "未知的上传类型: {type}",
    parentTaskFailed: "父任务失败",
    folderUploadPartialFailure: "一个或多个文件上传失败。"
  },
  log: {
    info: `信息`,
    warning: `警告`,
    error: `错误`,
    debug: `调试`,
    system: `系统`,
    security: `安全`,
    business: `业务`
  },
  upload: {
    tasks: `上传任务 ({count} 进行中)`,
    noTasks: `暂无上传任务`,
    clearCompletedTip: `清除所有已完成或失败的任务`,
    closeAllTip: `关闭所有任务 (将取消进行中的任务)`,
    hideSubtasks: `隐藏子任务`,
    showSubtasks: `显示子任务`,
    removeTask: `移除此任务`,
    closeAllConfirm: `确定要关闭所有上传任务吗？进行中的任务将被取消 (此操作目前仅从列表移除)。`,
    closeAllTitle: `确认关闭`,
    allTasksClosed: `所有任务已关闭`,
    status: {
      pending: `等待中`,
      uploading: `上传中`,
      processing: `处理中`,
      completed: `已完成`,
      failed: `失败`
    },
    uploadToDataset: `上传到数据集: {name}`,
    uploadingFile: `正在上传: {name} ({current}/{total})`,
    preparingUpload: `准备上传 {count} 个文件...`,
    targetPath: `目标路径 (数据集内)`,
    selectFilesOrFolder: `选择文件或文件夹`,
    dragOrClick: `拖拽文件到此处或 点击选择文件`,
    showOverlayTip: `显示上传进度`,
    hideOverlayTip: `隐藏上传进度`,
    closeOverlayTip: `关闭上传进度悬浮窗`,
    minimize: `最小化`,
    maximize: `最大化`,
    selectFolder: `选择文件夹`,
    filesToUpload: `待上传文件 ({count})`,
    relativePath: `相对路径 (文件夹内)`,
    uploadingProgress: `上传中... ({current}/{total})`,
    startUpload: `开始上传`,
    selectFilesFirst: `请选择要上传的文件`,
    multiFileUpload: `多文件上传到 {name}`,
    fileUpload: `文件上传到 {name}`,
    target: `目标`,
    noFilesProcessed: `没有文件被成功处理。`,
    batchFailed: `批量上传失败或部分失败。`
  },
  theme: {
    switchTheme: `切换主题`,
    light: `浅色`,
    dark: `深色`,
    auto: `跟随系统`,
    systemIs: `系统为{theme}`
  },
  cookie: {
    title: `请输入AI Studio Cookie`,
    inputLabel: `Cookie`,
    placeholder: `请输入BAIDUID开头的cookie`,
    submit: `提交`,
    emptyError: `Cookie不能为空`,
    success: `Cookie设置成功`,
    error: `Cookie设置失败，请重试`,
    notReadyTitle: `AI Studio Cookie未就绪`,
    notReadyMessage: `请等待Cookie设置完成或手动输入Cookie以继续使用`
  }
} 