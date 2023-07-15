import { http, secrets } from "shadow/core/apis";
import { iter, parse } from "shadow/core/parse";
import { Entry, Handler } from "shadow/contracts";
import { Configs, Singletons } from "shadow/singletons/interfaces";
import { ZipInstallConfig } from "shadow/core/download";
import { shadowDirs } from "../singletons/paths";
import * as path from "shadow/core/path";

export interface XXXEntry {
    url: string;
    code: string;
    password: string;
}

interface XXXBuddleEntry {
    name: string;
    image_url: string;
    pan_url: string;
    pan_code: string;
    unzip_passwords: string;
}

export class XXXBundle implements Handler {
    private _logger = console;
    private _entries: XXXBuddleEntry[] = [];

    constructor(private _filePath: string) {
        this.load();
    }

    private async load(): Promise<void> {
        const content = await secrets.decryptFile(this._filePath);
        if (!content) {
            this._logger.log(`XXXBundle: failed to load ${this._filePath}, content is empty`);
            return;
        }
        const json = JSON.parse(content);

        this._entries = json.entries;
        this._logger.log(`XXXBundle: loaded ${this._entries.length} entries`);
    }

    private makeDownloadCallback(name: string, url: string, imageUrl: string, code: string, password: string): (singletons: Singletons, configs: Configs) => Promise<string> {
        return async (singletons: Singletons, configs: Configs) => {
            // if url contains pwd, then use it as the code, and remove params from url
            const pwdPattern = /(?<=pwd=).*/;
            const pwdRegex = new RegExp(pwdPattern, "g");
            const pwdResult = url.match(pwdRegex);
            if (pwdResult) {
                code = pwdResult[0];
                url = url.split('?')[0]
            }

            const record = await singletons.baiduPCS.transfer(
                url,
                code,
                await configs.baiduPanPath.get()
            );

            const taskId = await singletons.downloadManager.addBaiduPanTask(
                {
                    name: name,
                    imageUrl: imageUrl,
                    saveDir: await configs.downloadPath.get(),
                    md5: record.md5,

                    installDir: await configs.installPath.get(),
                    installConfig: {
                        password: password,
                    } as ZipInstallConfig,
                },
                record.panPath
            );

            return taskId;
        };
    }

    private toEntry(e: XXXBuddleEntry): Entry {
        return {
            name: e.name,
            imgUrl: e.image_url,
            addDownloadTask: this.makeDownloadCallback(e.name, e.pan_url, e.image_url, e.pan_code, e.unzip_passwords ? e.unzip_passwords[0] : ""),
        };
    }

    async search(query: string): Promise<Entry[]> {
        // fuzzy search
        const entries = this._entries.filter(e => e.name.toLowerCase().includes(query.toLowerCase()));
        return entries.map(e => this.toEntry(e));
    }
}

const buddlePath = path.join(shadowDirs.data, "xxx.bin");
export const xxxBunddle = new XXXBundle(buddlePath);