import { createListener } from "./listener";
import { Process, runCommand } from "./process";

export class ZipHandler {
    constructor(
        private _7z: string,
    ) { }

    async list(zip: string): Promise<string[]> {
        const args = [
            "l",
            "-ba",
            "-slt",
            zip,
        ];

        const output = await runCommand(this._7z, args);
        const parts = output.split("\r\n\r\n");

        const ret: string[] = [];
        for (const part of parts) {
            const lines = part.split("\r\n");
            for (const line of lines) {
                if (line.startsWith("Path = ")) {
                    ret.push(line.substring(7));
                }
            }
        }

        return ret;
    }

    createDecompressor(): Decompressor {
        return new Decompressor(this._7z);
    }

    async unzip(zip: string, dst: string, password?: string, workDir?: string): Promise<void> {
        const decompressor = this.createDecompressor();
        await decompressor.start(zip, dst, password, workDir);
        await decompressor.wait();
    }
}

export class Decompressor {
    private _proc?: Process;
    private _onCompletedListener = createListener<() => void>();

    constructor(
        private _7z: string,
    ) { }

    async start(zip: string, dst: string, password?: string, workDir?: string): Promise<void> {
        const args = [
            "x",
            "-y",
            "-o" + dst,
            zip,
        ];
        if (password) {
            args.push("-p" + password);
        }
        if (workDir) {
            args.push("-w" + workDir);
        }

        this._proc = new Process(this._7z, args);

        this._proc.onExit(() => {
            this._onCompletedListener.emit();
        });

        await this._proc.start();
    }

    async stop() {
        await this._proc?.kill();
    }

    async wait() {
        await this._proc?.wait();
    }

    onCompleted(listener: () => void): () => void {
        return this._onCompletedListener.listen(listener);
    }
}