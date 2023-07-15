import { Entry } from "../core/config";
import { singletons } from "./singletons";
import * as interfaces from "./interfaces";

function entry(key: string) {
    return new Entry(singletons.config, key);
}

class Configs implements interfaces.Configs {
    downloadPath = entry("downloadPath");
    installPath = entry("installPath");
    baiduPanPath = entry("baiduPanPath");
}

export const configs: interfaces.Configs = new Configs();