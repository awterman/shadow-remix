import { process } from 'shadow/core/apis'

export const EOF = new Error('EOF')

export class Process {
    program: string;
    args: string[] = [];

    pid: string = '';
    private _exited = false;

    private stdoutBuffer: string = '';
    private stdoutListeners: ((data: string) => void)[] = [];
    private exitListeners: (() => void)[] = [];

    constructor(program: string, args?: string[]) {
        this.program = program;

        if (args) {
            this.args = args;
        }
    }

    async start(): Promise<void> {
        this.pid = await process.create(this.program, this.args);
        this.setupStdoutListener();
        this.setupExitListener();
    }

    started(): boolean {
        return this.pid !== '';
    }

    exited(): boolean {
        return this._exited;
    }

    private checkStarted(): void {
        if (this.pid === '') {
            throw new Error('Process not started');
        }
    }

    async write(data: string): Promise<void> {
        this.checkStarted();
        await process.write_stdin(this.pid, data);
    }

    async kill(): Promise<void> {
        this.checkStarted();
        await process.kill(this.pid);
    }

    private setupStdoutListener(): void {
        this.checkStarted();
        process.on_stdout(this.pid, (data: string) => {
            this.stdoutBuffer += data;
            this.stdoutListeners.forEach((listener) => listener(data));
        });
    }

    private setupExitListener(): void {
        this.checkStarted();
        process.on_exit(this.pid, () => {
            this._exited = true;
            this.exitListeners.forEach((listener) => listener());
        });
    }

    onStdout(callback: (data: string) => void): () => void {
        this.stdoutListeners.push(callback);
        return () => {
            const index = this.stdoutListeners.indexOf(callback);
            if (index !== -1) {
                this.stdoutListeners.splice(index, 1);
            }
        };
    }

    onExit(callback: () => void): () => void {
        this.exitListeners.push(callback);
        return () => {
            const index = this.exitListeners.indexOf(callback);
            if (index !== -1) {
                this.exitListeners.splice(index, 1);
            }
        }
    }

    hasStdout(): boolean {
        this.checkStarted();
        return this.stdoutBuffer !== '';
    }

    // clear all stdout buffer and return it
    async readAll(): Promise<string> {
        this.checkStarted();
        const buffer = this.stdoutBuffer;
        this.stdoutBuffer = '';
        return buffer;
    }

    async readUntil(delimiter: string, untilExit: boolean = false): Promise<string> {
        return (await this.readUntilWithTimeout(delimiter, untilExit)).content;
    }

    async readUntilWithTimeout(delimiter: string, untilExit: boolean, timeoutMs?: number): Promise<{ content: string, ok: boolean }> {
        this.checkStarted();

        return await new Promise<{ content: string, ok: boolean }>((resolve, reject) => {
            if (untilExit) {
                const unlisten = this.onExit(() => {
                    unlisten();
                    resolve({ content: this.stdoutBuffer, ok: true });
                    this.stdoutBuffer = ''
                });
            }

            if (this._exited && this.stdoutBuffer === '') {
                reject(EOF);
            }

            const unlisten = this.onStdout(() => {
                const index = this.stdoutBuffer.indexOf(delimiter);
                if (index !== -1) {
                    const content = this.stdoutBuffer.slice(0, index + delimiter.length);
                    this.stdoutBuffer = this.stdoutBuffer.slice(index + delimiter.length + 1);
                    unlisten();
                    resolve({ content: content, ok: true });
                }
            });

            if (timeoutMs !== undefined) {
                setTimeout(() => {
                    unlisten();
                    resolve({ content: '', ok: false });
                }, timeoutMs);
            }
        });
    }

    async readLine(untilExit: boolean = false): Promise<string> {
        return (await this.readLineWithTimeout()).content;
    }

    async readLineWithTimeout(untilExit: boolean = false, timeoutMs?: number): Promise<{ content: string, ok: boolean }> {
        return await this.readUntilWithTimeout('\n', untilExit, timeoutMs);
    }

    async wait(): Promise<void> {
        this.checkStarted();

        if (this._exited) {
            return;
        }

        await new Promise<void>((resolve) => {
            const unlisten = this.onExit(() => {
                unlisten();
                resolve();
            });

            // if exited before we listen
            if (this._exited) {
                unlisten();
                resolve();
            }
        });
    }
}

export async function runCommand(program: string, args?: string[]): Promise<string> {
    const proc = new Process(program, args);
    await proc.start();
    await proc.wait();
    const ret = await proc.readAll();
    return ret;
}