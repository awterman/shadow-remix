import { Configs, Singletons } from "./singletons/interfaces";

export interface Entry {
    name: string;
    imgUrl: string;

    // use downloadManager to download
    addDownloadTask(singletons: Singletons, configs: Configs): Promise<string>;
}

export interface Handler {
    search(query: string): Promise<Entry[]>;
}