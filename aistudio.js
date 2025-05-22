'use strict';
import { agent } from 'superagent';
import prefix from 'superagent-prefix';
import sdk from '@baiducloud/sdk';

// 数据集约束条件
export const DATASET_CONSTRAINTS = {
    MAX_FILE_NAME_LENGTH: 50,
    MAX_DATASET_NAME_DISPLAY_LENGTH: 40,
    MAX_DATASET_NAME_LENGTH: 100,
    MAX_DATASET_ABS_LENGTH: 200,
    MAX_TAG_LENGTH_ALL: 127,
    MAX_TAGS_COUNT: 5,
    MAX_FILE_ABS_LENGTH: 499,
    MAX_FILES_PER_DATASET: 10,
    MAX_DATASET_SIZE_GB: 50
}

// 验证数据集参数
export const validateDatasetParams = (params) => {
    const {
        datasetName = '',
        datasetAbs = '',
        tags = [],
        fileIds = []
    } = params

    // 验证数据集名称
    if (!datasetName || typeof datasetName !== 'string') {
        throw new Error('数据集名称不能为空')
    }
    if (datasetName.length > DATASET_CONSTRAINTS.MAX_DATASET_NAME_LENGTH) {
        throw new Error(`数据集名称长度不能超过 ${DATASET_CONSTRAINTS.MAX_DATASET_NAME_LENGTH} 个字符`)
    }

    // 验证数据集描述
    if (datasetAbs && datasetAbs.length > DATASET_CONSTRAINTS.MAX_DATASET_ABS_LENGTH) {
        throw new Error(`数据集描述长度不能超过 ${DATASET_CONSTRAINTS.MAX_DATASET_ABS_LENGTH} 个字符`)
    }

    // 验证标签
    if (!Array.isArray(tags)) {
        throw new Error('标签必须是数组格式')
    }
    if (tags.length > DATASET_CONSTRAINTS.MAX_TAGS_COUNT) {
        throw new Error(`标签数量不能超过 ${DATASET_CONSTRAINTS.MAX_TAGS_COUNT} 个`)
    }
    const totalTagLength = tags.reduce((sum, tag) => sum + (tag?.length || 0), 0)
    if (totalTagLength > DATASET_CONSTRAINTS.MAX_TAG_LENGTH_ALL) {
        throw new Error(`所有标签总长度不能超过 ${DATASET_CONSTRAINTS.MAX_TAG_LENGTH_ALL} 个字符`)
    }

    // 验证文件ID列表
    if (!Array.isArray(fileIds)) {
        throw new Error('文件ID列表必须是数组格式')
    }
    if (fileIds.length === 0) {
        throw new Error('文件ID列表不能为空')
    }
    if (fileIds.length > DATASET_CONSTRAINTS.MAX_FILES_PER_DATASET) {
        throw new Error(`文件数量不能超过 ${DATASET_CONSTRAINTS.MAX_FILES_PER_DATASET} 个`)
    }

    return true
}

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
