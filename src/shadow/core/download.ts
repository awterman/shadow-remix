import { DownloadProgress, Downloader, ErrNotStarted, BaiduPCS } from "./baidu-pcs";
import { crypto, fs } from "./apis";
import { createListener } from "./listener";
import { Logger } from "./logger";
import { Decompressor, ZipHandler } from "./compress";
import * as path from "./path";
import { notifyDesktop } from "./notify";

export type TaskState = "waiting" | "downloading" | 'paused' | "completed" | "canceled" | "error";

export interface ConfigParams {
    name: string;
    imageUrl: string;
    saveDir: string;
    md5: string;

    installDir: string;
    installConfig: object;
}

export interface BaiduPanConfig {
    panPath: string;
}

export interface ZipInstallConfig {
    password: string;
}

export interface TaskConfig {
    id: string;

    name: string;
    imageUrl: string;
    saveDir: string;
    md5: string;

    localPath: string;

    createdAt: number;
    updatedAt: number;
    completedAt: number;

    kind: "pan";
    sourceConfig: object;

    installKind: "zip";
    installDir: string;
    installConfig: object;

    state: TaskState;
    progress: DownloadProgress;
}

interface Data {
    latestId: number;
    tasks: TaskConfig[];
}

interface Task {
    onProgress(f: (progress: DownloadProgress) => void): void;
    onCompleted(f: () => void): void;

    start(): Promise<void>;
    stop(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
}

class BaiduPanTask implements Task {
    private _localPath: string;
    private _onProgressListeners = createListener<(progress: DownloadProgress) => void>();
    private _onCompletedListeners = createListener<() => void>();

    constructor(
        private _panPath: string,
        private _localDir: string,
        private _md5: string,
        private _downloader: Downloader,
        private _logger: Logger,
    ) {
        this._localPath = path.join(this._localDir, path.basename(this._panPath));

        this._downloader.onProgress((progress) => {
            this._logger.log(`BaiduPanTask: download progress: ${progress.downloaded / 1024 / 1024} MB`);
            this._onProgressListeners.emit(progress);
        });

        this._downloader.onCompleted(() => {
            this._logger.log(`BaiduPanTask: download completed: ${this._localPath}`);
            this._onCompletedListeners.emit();
        });
    }

    onProgress(f: (progress: DownloadProgress) => void) {
        this._onProgressListeners.listen(f);
    }

    onCompleted(f: () => void) {
        this._onCompletedListeners.listen(f);
    }

    async start(): Promise<void> {
        // baidu-pcs already checks if the download is completed when checking the existence of the file

        // check if the file exists
        // if (await fs.exists(this._localPath)) {
        //     this._logger.log(`BaiduPanTask: file exists: ${this._localPath}, checking md5...`);

        //     const md5 = await crypto.md5sum(this._localPath);
        //     if (md5 == this._md5) {
        //         this._logger.log(`BaiduPanTask: md5 matched: ${this._localPath}, skip download...`);
        //         this._onCompletedListeners.emit();
        //         return;
        //     }
        // }

        this._logger.log(`BaiduPanTask: start download: ${this._panPath} to ${this._localPath}`);
        await this._downloader.start(this._panPath, this._localDir);
    }

    async stop(): Promise<void> {
        await this.pause();
        try {
            await fs.removeAll(this._localPath);
        } catch (e) {
            this._logger.log(e);
        }
    }

    async pause(): Promise<void> {
        this._logger.log(`BaiduPanTask: pause download: ${this._panPath} to ${this._localPath}...`)
        try {
            await this._downloader.kill();
        } catch (e) {
            if (e != ErrNotStarted) {
                throw e;
            }
        }
    }

    async resume(): Promise<void> {
        await this.start();
    }
}

class TaskWithInstalling implements Task {
    constructor(
        private _downloadTask: Task,
        private _installer: ZipInstaller,
    ) { }

    async run() {
        this._downloadTask.onCompleted(() => {
            this._installer.start();
        });

        await this._downloadTask.start();
    }

    async start(): Promise<void> {
        await this.run();
    }

    async stop(): Promise<void> {
        await this._downloadTask.stop();
        await this._installer.stop();
    }

    async pause(): Promise<void> {
        await this._downloadTask.pause();
        await this._installer.stop();
    }

    async resume(): Promise<void> {
        await this.run();
    }

    onProgress(f: (progress: DownloadProgress) => void) {
        this._downloadTask.onProgress(f);
    }

    onCompleted(f: () => void) {
        this._installer.onCompleted(f);
    }
}


class ZipInstaller {
    private _onCompletedListeners = createListener<() => void>();
    private _decompressor?: Decompressor;
    private _stopped = false;

    constructor(
        private _zipHandler: ZipHandler,
        private _zipPath: string,
        private _installDir: string,
        private _password: string,
        private _logger: Logger,
    ) { }

    onCompleted(f: () => void): () => void {
        return this._onCompletedListeners.listen(f);
    }

    // decompress and return if it's a zip file
    private async decompress(zipPath: string, dstDir: string): Promise<string> {
        const lastStatus = this._stopped;

        this._logger.log(`ZipInstaller: decompressing ${zipPath} to ${dstDir}...`)
        this._decompressor = this._zipHandler.createDecompressor();
        await this._decompressor?.start(zipPath, dstDir, this._password);

        if (this._stopped && !lastStatus) {
            await this._decompressor?.stop();
        }

        await this._decompressor?.wait();
        this._logger.log(`ZipInstaller: decompressing ${zipPath} to ${dstDir} completed.`)

        const files = await this._zipHandler.list(zipPath);
        if (files.length > 0) {
            const content = files[0];

            const ext = path.extname(content) ?? "";
            if (["zip", "rar"].includes(ext)) {
                this._logger.log(`ZipInstaller: found zip file ${content}`)
                return path.join(dstDir, content);
            }
        }
        return "";
    }

    private async run(): Promise<void> {
        this._logger.log(`ZipInstaller: started`);

        // recursively decompress
        let zipPath = this._zipPath;
        let dstDir = this._installDir;

        zipPath = await this.decompress(zipPath, dstDir);

        while (!this._stopped && zipPath != "") {
            const newZip = await this.decompress(zipPath, dstDir);
            // delete the temp file
            try {
                this._logger.log(`ZipInstaller: removing temp file ${zipPath}...`)
                await fs.removeAll(zipPath);
            }
            catch (e) {
                this._logger.log(e);
            }
            zipPath = newZip;

            if (this._stopped) {
                this._logger.log(`ZipInstaller: stopped`);
                return;
            }
        }

        this._logger.log(`ZipInstaller: completed`);

        this._onCompletedListeners.emit();
    }

    async start(): Promise<void> {
        try {
            // TODO: installDir is still the dir for all the crates, so we cannot remove it
            // await fs.removeAll(this._installDir);
        } catch (e) {
            this._logger.log(e);
        }

        this.run();
    }

    async stop(): Promise<void> {
        this._stopped = true;
        try {
            this._decompressor?.stop();
        } catch { }
    }
}

// TODO: add mutex to prevent concurrent access
export class Manager {
    private _tasks: Map<string, Task> = new Map();
    private _data?: Data;
    private _onTaskStateChangedListeners = createListener<(id: string) => void>();
    private _onTaskProgressListeners = createListener<(id: string, progress: DownloadProgress) => void>();

    constructor(
        private _savePath: string,
        private _baiduPCS: BaiduPCS,
        private _zipHandler: ZipHandler,
        private _logger: Logger,
    ) { }

    private async load(): Promise<Data> {
        if (this._data !== undefined) {
            return this._data;
        }

        try {
            const content = await fs.readTextFile(this._savePath);
            const config = JSON.parse(content) as Data;
            this._data = config;
        } catch {
            this._data = { latestId: 0, tasks: [] };
        }

        for (const task of this._data.tasks) {
            if (task.state === "downloading") {
                task.state = "paused";
            }
        }

        return this._data;
    }

    private async save(data: Data): Promise<void> {
        await fs.writeTextFile(this._savePath, JSON.stringify(data, null, 4));
        this._data = data;
    }

    async getTask(id: string): Promise<TaskConfig | undefined> {
        const data = await this.load();
        return data.tasks.find((task) => task.id === id);
    }

    async getTasks(): Promise<TaskConfig[]> {
        const data = await this.load();
        return data.tasks;
    }

    onTaskStateChanged(f: (id: string) => void): () => void {
        return this._onTaskStateChangedListeners.listen(f);
    }

    onTaskProgress(f: (id: string, progress: DownloadProgress) => void): () => void {
        return this._onTaskProgressListeners.listen(f);
    }

    private async updateTask(id: string, from: TaskState[], to: TaskState, action: (task: Task, config: TaskConfig) => Promise<void>): Promise<void> {
        const data = await this.load();
        const taskConfig = data.tasks.find((task) => task.id === id);
        if (taskConfig === undefined) {
            throw new Error(`Task ${id} not found`);
        }

        if (!from.includes(taskConfig.state)) {
            throw new Error(`Task ${id} is not in state ${from.join(", ")}`);
        }

        let task = this._tasks.get(id);
        if (task === undefined) {
            task = this.createTask(taskConfig);
        }

        await action(task, taskConfig);

        this._logger.log(`Task ${id} state changed from ${taskConfig.state} to ${to}.`)
        taskConfig.state = to;
        taskConfig.updatedAt = Date.now();

        await this.save(data);

        this._onTaskStateChangedListeners.emit(id);
    }

    async startTask(id: string): Promise<void> {
        return await this.updateTask(id, ["waiting", "paused"], "downloading", async (task, taskConfig) => {
            await task.start();
            notifyDesktop("开始下载", `${taskConfig.name} 已开始下载`);
        });
    }

    async stopTask(id: string): Promise<void> {
        return await this.updateTask(id, ["downloading", "paused"], "waiting", async (task) => {
            await task.stop();
            this._tasks.delete(id);
        });
    }

    async pauseTask(id: string): Promise<void> {
        return await this.updateTask(id, ["downloading"], "paused", async (task) => {
            await task.pause();
            this._tasks.delete(id);
        });
    }

    async resumeTask(id: string): Promise<void> {
        return await this.updateTask(id, ["paused"], "downloading", async (task) => {
            await task.resume();
        });
    }

    async cancelTask(id: string): Promise<void> {
        return await this.updateTask(id, ["waiting", "downloading", "paused"], "canceled", async (task, config) => {
            if (config.state === "downloading" || config.state === "paused") {
                await task.stop();
                this._tasks.delete(id);
            }
        });
    }

    async deleteTask(id: string, deleteFiles = true): Promise<void> {
        const data = await this.load();

        const index = data.tasks.findIndex((task) => task.id === id);
        if (index < 0) {
            throw new Error(`Task ${id} not found`);
        }

        const taskConfig = data.tasks[index];
        if (deleteFiles) {
            try {
                await fs.removeAll(taskConfig.localPath);
            } catch (e) {
                this._logger.log(e);
            }
        }

        // delete task from config
        data.tasks.splice(index, 1);
        await this.save(data);

        // delete task
        const task = this._tasks.get(id);
        if (task !== undefined) {
            await task.stop();
            this._tasks.delete(id);
        }

        this._onTaskStateChangedListeners.emit(id);
    }

    async restartTask(id: string): Promise<void> {
        const taskConfig = await this.getTask(id);
        if (taskConfig === undefined) {
            throw new Error(`Task ${id} not found`);
        }

        await this.deleteTask(id, false);

        let taskId: string;

        switch (taskConfig.kind) {
            case "pan":
                const configParams: ConfigParams = {
                    name: taskConfig.name,
                    imageUrl: taskConfig.imageUrl,
                    saveDir: taskConfig.saveDir,
                    md5: taskConfig.md5,

                    installDir: taskConfig.installDir,
                    installConfig: taskConfig.installConfig,
                };
                const panPath = (taskConfig.sourceConfig as BaiduPanConfig).panPath;
                taskId = await this.addBaiduPanTask(configParams, panPath);
                break;
            default:
                throw new Error(`Task ${id} kind ${taskConfig.kind} not supported`);
        }

        await this.startTask(taskId);
    }

    async addBaiduPanTask(params: ConfigParams, panPath: string): Promise<string> {
        const data = await this.load();
        const taskConfig: TaskConfig = {
            id: (data.latestId + 1).toString(),

            name: params.name,
            imageUrl: params.imageUrl,
            saveDir: params.saveDir,
            md5: params.md5,

            localPath: path.join(params.saveDir, panPath.split("/").pop()!),

            createdAt: Date.now(),
            updatedAt: Date.now(),
            completedAt: 0,

            kind: "pan",
            sourceConfig: { panPath },

            installKind: 'zip',
            installDir: params.installDir,
            installConfig: params.installConfig,

            state: "waiting",
            progress: {
                id: '',
                total: 0,
                downloaded: 0,
                speed: 0,
                elapsed: 0,
                timeLeft: 0,
            }
        };

        data.latestId++;
        data.tasks.push(taskConfig);
        await this.save(data);

        this.createTask(taskConfig);

        return taskConfig.id;
    }

    private createTask(config: TaskConfig): Task {
        switch (config.kind) {
            case "pan":
                const panConfig = config.sourceConfig as BaiduPanConfig;
                const downloadTask = new BaiduPanTask(panConfig.panPath, config.saveDir, config.md5, this._baiduPCS.downloader(), this._logger);

                const password = (config.installConfig as ZipInstallConfig).password;
                const installTask = new ZipInstaller(this._zipHandler, config.localPath, config.installDir, password, this._logger);

                const task = new TaskWithInstalling(downloadTask, installTask);

                task.onCompleted(() => {
                    this._logger.log(`TaskManager: task ${config.id} completed`);

                    const taskConfig = this._data?.tasks.find((task) => task.id === config.id);
                    if (taskConfig === undefined) {
                        return;
                    }

                    taskConfig.state = "completed";
                    taskConfig.completedAt = Date.now();
                    taskConfig.updatedAt = Date.now();
                    this.save(this._data!);

                    notifyDesktop("下载完成", `${taskConfig.name} 下载完成`);

                    this._onTaskStateChangedListeners.emit(config.id);
                });

                task.onProgress((progress) => {
                    const taskConfig = this._data?.tasks.find((task) => task.id === config.id);
                    if (taskConfig === undefined) {
                        return;
                    }

                    taskConfig.progress = progress;
                    taskConfig.updatedAt = Date.now();
                    this.save(this._data!);

                    this._onTaskProgressListeners.emit(config.id, progress);
                });

                this._tasks.set(config.id, task);

                notifyDesktop("添加下载", `${config.name} 已添加到下载队列`);
                return task;
        }
    }
}