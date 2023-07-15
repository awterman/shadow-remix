import { fs } from "./apis";

export class Entry {
    key: string;
    config: Config;

    constructor(config: Config, key: string) {
        this.config = config;
        this.key = key;
    }

    async get(): Promise<string> {
        return this.config.get(this.key)
    }

    async set(value: string): Promise<void> {
        return this.config.set(this.key, value);
    }
}

export class Config {
    constructor(
        private path: string
    ) { }

    private config: { [key: string]: string } = {};

    async tryRead(): Promise<string> {
        // try to read the config file, if it doesn't exist or is empty, return "{}"
        try {
            return await fs.readTextFile(this.path) || "{}";
        } catch (e) {
            return "{}";
        }
    }

    async get(key: string): Promise<string> {
        // read the config file
        const content = await this.tryRead();

        // parse the config file
        this.config = JSON.parse(content);

        // return the value
        return this.config[key];
    }

    async set(key: string, value: string): Promise<void> {
        // read the config file
        const content = await this.tryRead();

        // parse the config file
        this.config = JSON.parse(content);

        // set the value
        this.config[key] = value;

        // write the config file
        fs.writeTextFile(this.path, JSON.stringify(this.config));
    }
}