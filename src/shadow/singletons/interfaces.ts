import { BaiduPCS } from "shadow/core/baidu-pcs";
import { ZipHandler } from "shadow/core/compress";
import { Config, Entry } from "shadow/core/config";
import { Manager } from "shadow/core/download";

export interface Paths {
    downloads: string;
    config: string;
    baiduPCS: string;
    _7z: string;
}

export interface Configs {
    downloadPath: Entry;
    installPath: Entry;
    baiduPanPath: Entry;
}

export interface Singletons {
    logger: Console;
    config: Config;
    baiduPCS: BaiduPCS;
    zipHandler: ZipHandler;
    downloadManager: Manager;
}