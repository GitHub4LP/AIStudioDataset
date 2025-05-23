'use strict';
import { agent } from 'superagent';
import prefix from 'superagent-prefix';
import sdk from '@baiducloud/sdk';
// 验证数据集参数
// Note: This function previously used DATASET_CONSTRAINTS from this file.
// It should now ideally import it from 'src/utils/serverUtils.js' if it needs it.
// However, looking at the function, it seems the constraints it uses are hardcoded
// within the function body (e.g. MAX_DATASET_NAME_LENGTH).
// For this refactoring step, we'll leave validateDatasetParams as is,
// but acknowledge that DATASET_CONSTRAINTS has been centralized in serverUtils.js.
// A future step could be to have validateDatasetParams also import from serverUtils.js
// or have specific constraint values passed to it if they can vary.

// For now, the DATASET_CONSTRAINTS object that was here is removed to avoid duplication.
// The actual constraint values used by validateDatasetParams seem to be internal to it or passed.
// Re-checking: The validateDatasetParams function DOES use the constants like DATASET_CONSTRAINTS.MAX_DATASET_NAME_LENGTH.
// It MUST import DATASET_CONSTRAINTS from serverUtils.js.

import { DATASET_CONSTRAINTS as ServerUtilsDatasetConstraints } from '../utils/serverUtils.js'; // Import with alias to avoid conflict if any local vars

export const validateDatasetParams = (params) => {
    const {
        datasetName = '',
        datasetAbs = '',
        tags = [],
        fileIds = []
        // fileSize and fileName are also potential params from uploadController usage
    } = params;

    // Use the imported constraints
    const constraints = ServerUtilsDatasetConstraints;

    // 验证数据集名称
    if (!datasetName || typeof datasetName !== 'string') {
        throw new Error('数据集名称不能为空');
    }
    if (datasetName.length > constraints.MAX_DATASET_NAME_LENGTH) {
        throw new Error(`数据集名称长度不能超过 ${constraints.MAX_DATASET_NAME_LENGTH} 个字符`);
    }

    // 验证数据集描述
    if (datasetAbs && datasetAbs.length > constraints.MAX_DATASET_ABS_LENGTH) {
        throw new Error(`数据集描述长度不能超过 ${constraints.MAX_DATASET_ABS_LENGTH} 个字符`);
    }

    // 验证标签
    if (!Array.isArray(tags)) {
        throw new Error('标签必须是数组格式');
    }
    if (tags.length > constraints.MAX_TAGS_COUNT) {
        throw new Error(`标签数量不能超过 ${constraints.MAX_TAGS_COUNT} 个`);
    }
    const totalTagLength = tags.reduce((sum, tag) => sum + (tag?.length || 0), 0);
    if (totalTagLength > constraints.MAX_TAG_LENGTH_ALL) {
        throw new Error(`所有标签总长度不能超过 ${constraints.MAX_TAG_LENGTH_ALL} 个字符`);
    }

    // 验证文件ID列表
    if (!Array.isArray(fileIds)) {
        throw new Error('文件ID列表必须是数组格式');
    }
    // This specific check might be too restrictive if fileIds are not always present (e.g. creating an empty dataset)
    // Or if it's for a single file upload, fileIds might be a placeholder.
    // The original server.js had placeholder like `fileIds: [1]` for some validations.
    // Consider if this validation needs to be more flexible or context-aware.
    // For now, retaining original logic.
    if (fileIds.length > constraints.MAX_FILES_PER_DATASET) {
        throw new Error(`文件数量不能超过 ${constraints.MAX_FILES_PER_DATASET} 个`);
    }
    
    // Add fileName validation if present (from upload use cases)
    if (params.fileName && typeof params.fileName === 'string' && params.fileName.length > constraints.MAX_FILE_NAME_LENGTH) {
        throw new Error(`文件名长度不能超过 ${constraints.MAX_FILE_NAME_LENGTH} 个字符`);
    }
    
    // Add fileSize validation if present (from upload use cases)
    // Assuming MAX_DATASET_SIZE_GB is for the whole dataset, not single file.
    // There wasn't a per-file size constraint in the original DATASET_CONSTRAINTS in aistudio.js
    // If there is one in serverUtils.js (e.g. MAX_FILE_SIZE_MB), it could be used here.
    // For now, no direct file size check here unless it was implied by MAX_DATASET_SIZE_GB.

    return true;
};

class AI_Studio {

    constructor(cookie) {
        this.agent = agent()
            .set("Cookie", cookie)
            .use(prefix('https://aistudio.baidu.com'))
            .set("x-requested-with", "XMLHttpRequest")
            .set("Cache-Control", "no-cache")
            .set("Referer", "https://aistudio.baidu.com/my/dataset");
    }

    async initialize() {
        const tokenResponse = await this.agent.get("/studio/token");
        // console.log(tokenResponse.body);
        const token = tokenResponse.body["result"]["bdToken"];
        // console.log(token);
        this.agent.set("x-studio-token", token);
        return this;
    }

    getPrivateList(kw, page, pageSize) {
        return this.agent.post("/studio/dataset/userlist").send({
            kw: kw,
            selfOrder: 0,
            orderType: 0,
            personalDatasetRange: 0,
            p: page,
            pageSize: pageSize
        })
    }

    getPublicList(kw, page, pageSize) {
        return this.agent.post("/studio/dataset/public").type("form").send({
            p: page,
            pageSize: pageSize,
            kw: kw,
            orderType: 0,
            topic: 0,
            tags: []
        })
    }
    getCollectList(kw, page, pageSize) {
        return this.agent.post("/studio/dataset/collectlist").send({
            kw: kw,
            ts: 0,
            p: page,
            pageSize: pageSize
        })
    }
    datasetFileDownload(datasetId, fileId, oldVersion = true) {
        if (oldVersion) {
            return this.agent.post("/studio/dataset/file/download").send({
                datasetId: datasetId,
                fileId: fileId
            })
        } else {
            return this.agent.get(`/llm/files/datasets/${datasetId}/file/${fileId}/download`)
        }
    }

    getDatasetUsed(datasetId) {
        return this.agent.get("/studio/dataset/check/used").query({
            datasetId: datasetId
        })
    }

    acl = function (llm = true) {
        if (llm) {
            return this.agent.get("/llm/files/acl")
        } else {
            return this.agent.post("/studio/dataset/bosacl")
        }
    }

    addFile = function de(fileOriginName, fileKey, llm = true) {
        const addfile_url = llm ? "/llm/files/addfile" : "/studio/file/addfile"
        let m = this.agent.post(addfile_url)
        if (!llm) {
            m = m.type("form")
        }
        return m.send({
            fileOriginName: fileOriginName,
            fileKey: fileKey
        })
    }

    del = (datasetId) => {
        return this.agent.post("/studio/dataset/delete").type("form").send({
            datasetId: datasetId
        })
    }

    fetchDetail = (datasetId) => {
        return this.agent.post("/studio/dataset/detail").type("form").send({
            datasetId: datasetId
        })
    }

    create = (
        datasetName,
        datasetAbs,
        datasetContent,
        tags,
        fileIds,
        fileAbsList,
        ispublic
    ) => {
        return this.agent.post("/llm/files/datasets").send({
            datasetName: datasetName,
            datasetAbs: datasetAbs,
            datasetContent: datasetContent,
            authorName: void 0,
            datasetType: void 0,
            protocolId: void 0,
            tags: tags,
            fileIds: fileIds,
            fileAbsList: fileAbsList,
            public: ispublic
        })
    }

    saveEdit = (
        datasetId,
        datasetName,
        datasetAbs,
        datasetContent,
        tags,
        fileIds,
        fileAbsList,
        ispublic
    ) => {
        return this.agent.post("/studio/dataset/add").type("form").send({
            datasetId: datasetId,
            datasetName: datasetName,
            datasetAbs: datasetAbs,
            datasetContent: datasetContent,
            authorName: void 0,
            datasetType: void 0,
            protocolId: void 0,
            tags: tags,
            fileIds: fileIds,
            fileAbsList: fileAbsList,
            public: ispublic
        })
    }

    bosClient = async (llm = true) => {
        const acl_resp = await this.acl(llm);
        // console.log(acl_resp.body);
        const acl = acl_resp.body["result"];
        // console.log(acl);
        let config = {
            credentials: {
                ak: acl["accessKeyId"],
                sk: acl["secretAccessKey"]
            },
            sessionToken: acl["sessionToken"],
            endpoint: llm ? acl["endpoint"] : "https://bj.bcebos.com"
            // protocol: 'https'
        };
        return {
            client: new sdk.BosClient(config),
            fileKey: acl["fileKey"],
            bucketName: acl["bucketName"]
        }
    }
}

export { AI_Studio };
