import { Logger } from "./logger";
import * as path from "shadow/core/path"
import { fs, http } from "shadow/core/apis";
import { ZipHandler } from "./compress";
import { relaunch } from '@tauri-apps/api/process';

interface ReleaseStatus {
    version: string;
    url: string;
    sha1: string;
    releaseDate: string;
    releaseNotes: string;
}

export class Updater {
    constructor(
        private currentVersion: string,
        private statusUrl: string,
        // the absolute path of the root directory of the application
        private rootDir: string,
        // the absolute path of the target executable
        private targetExecutable: string,
        // the absolute path of the directory to download the new release
        private downloadDir: string,
        private zipHandler: ZipHandler,
        private logger: Logger
    ) {
    }

    /*
     * the schema of the release status
     * {
     *    "version": "1.0.0",
     *    "url": "http://example.com/1.0.0.zip",
     *    "sha1": "sha1 of the zip file",
     *    "releaseDate": "2018-01-01T00:00:00.000Z",
     *    "releaseNotes": "release notes"
     * }
     */

    private async getReleaseStatus(): Promise<ReleaseStatus> {
        const json = await http.get(this.statusUrl);
        return JSON.parse(json);
    }

    private async downloadRelease(): Promise<void> {
        const status = await this.getReleaseStatus();
        const archivePath = this.pendingReleaseArchivePath();
        await http.download(status.url, archivePath);
    }

    async downloadReleaseIfAvailable(): Promise<boolean> {
        const status = await this.getReleaseStatus();
        if (status.version === this.currentVersion) {
            this.logger.log(`No new version available`);
            return false;
        }

        this.logger.log(`New version ${status.version} available`);
        this.logger.log(`Downloading ${status.url} to ${this.downloadDir}`);

        await this.downloadRelease();

        this.logger.log(`Downloaded ${status.url} to ${this.downloadDir}`);

        return true;
    }

    private oldExecutable(): string {
        // xxx.old.exe
        const name = path.basename(this.targetExecutable);
        const ext = path.extname(this.targetExecutable);
        const dir = path.dirname(this.targetExecutable);

        let ret = path.join(dir, `${name}.old`);
        if (ext) {
            ret += `.${ext}`;
        }
        return ret;
    }

    // the absolute path of the pending release archive
    private pendingReleaseArchivePath(): string {
        // xxx.pending.zip under the download directory
        const name = path.basename(this.targetExecutable);
        const ext = path.extname(this.targetExecutable);
        const dir = path.dirname(this.targetExecutable);

        let ret = path.join(dir, `${name}.pending`);
        if (ext) {
            ret += `.${ext}`;
        }
        return ret;
    }

    async cleanUpOldExecutable(): Promise<void> {
        const oldExecutable = this.oldExecutable();
        // if the old executable exists, and the executable exists, delete the old executable
        if (await fs.exists(oldExecutable) && await fs.exists(this.targetExecutable)) {
            await fs.removeFile(oldExecutable);
        }
    }

    private async renameExecutable(): Promise<void> {
        // rename the executable to xxx.old.exe
        await fs.rename(this.targetExecutable, this.oldExecutable());
    }

    private async releasePending(): Promise<boolean> {
        // check if the pending release archive exists
        return await fs.exists(this.pendingReleaseArchivePath());
    }

    // update the application if there is a new release available
    // return true if the application is updated, otherwise false
    async updateAndRelaunchIfAvailable(): Promise<boolean> {
        // a simple solution without fallback
        // 1. check if there is a new release downloaded
        // 2. rename the current executable to xxx.old.exe
        // 3. unzip the new release to the root directory

        // 1. check if there is a new release downloaded
        if (!await this.releasePending()) {
            this.logger.log(`No pending release available`);
            return false;
        }

        this.logger.log(`Pending release available`);

        // 2. rename the current executable to xxx.old.exe
        this.logger.log(`Renaming ${this.targetExecutable} to ${this.oldExecutable()}`);
        await this.renameExecutable();

        // 3. unzip the new release to the root directory
        this.logger.log(`Unzipping ${this.pendingReleaseArchivePath()} to ${this.rootDir}`);
        await this.zipHandler.unzip(this.pendingReleaseArchivePath(), this.rootDir);

        // 4. relaunch
        this.logger.log(`Relaunching`);
        await relaunch();

        return true;

        // TODO: a solution with fallback
        // if there is an old executable, delete it for cleanup

        // if there is a new release downloaded
        //  1. rename the current executable to a temporary name
        //  2. unzip the new release to the temporary directory, i.e. the download directory
        //  3. check if the new executable exists
        //  4. if exists, move the unzipped files to the root directory
        //  5. if not exists, rename the temporary executable back to the original name, and mark the update as failed

        // if the update is successful, relaunch the application
    }
}