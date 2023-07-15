import { BaiduPCS } from "../core/baidu-pcs";
import { Manager } from "../core/download";
import { Config } from "../core/config";
import { paths } from "./paths";
import { ZipHandler } from "shadow/core/compress";
import * as interfaces from "./interfaces";

class Singletons implements interfaces.Singletons {
    logger = console;

    config = new Config(paths.config);

    baiduPCS = new BaiduPCS(paths.baiduPCS, this.logger);
    zipHandler = new ZipHandler(paths._7z);
    downloadManager = new Manager(paths.downloads, this.baiduPCS, this.zipHandler, this.logger);
}

export const singletons: interfaces.Singletons = new Singletons();

// window.singletons = singletons;