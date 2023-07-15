import { EOF, Process } from "shadow/core/process";
import { baiduPCS as baiduPCS_rs, fs } from './apis';
import { Logger } from "./logger";

export enum StepKind {
    UserPass,
    Captcha,
    VerifyType,
    VerifyCode,
    Success,
    Failed,
}

export type Step = Steps.UserPassStep | Steps.CaptchaStep | Steps.SendVerifyTypeStep | Steps.SendVerifyCodeStep | Steps.SuccessStep | Steps.FailedStep;

export namespace Steps {
    export class UserPassStep {
        kind: StepKind.UserPass = StepKind.UserPass;
    }

    export class CaptchaStep {
        kind: StepKind.Captcha = StepKind.Captcha;
        localUrl = '';
        remoteUrl = '';
    }

    export class SendVerifyTypeStep {
        kind: StepKind.VerifyType = StepKind.VerifyType;
        phone = '';
        email = '';
    }

    export class SendVerifyCodeStep {
        kind: StepKind.VerifyCode = StepKind.VerifyCode;
    }

    export class SuccessStep {
        kind: StepKind.Success = StepKind.Success;
    }

    export class FailedStep {
        kind: StepKind.Failed = StepKind.Failed;
    }
}

export class Login {
    private proc: Process | undefined;

    constructor(
        private _baiduPcsExe: string,
    ) { }

    async nextStep(): Promise<Step> {
        if (this.proc === undefined) {
            return { kind: StepKind.UserPass };
        }

        // 1. VeriyCode
        // fmt.Printf("\n需要验证手机或邮箱才能登录\n选择一种验证方式\n")
        // fmt.Printf("1: 手机: %s\n", lj.Data.Phone)
        // fmt.Printf("2: 邮箱: %s\n", lj.Data.Email)
        // fmt.Printf("消息: %s\n\n", msg)
        // ```
        //   if strings.Contains(msg, "系统出错") {
        //     return
        //   }
        // ```
        //   fmt.Printf("[%d/3] 错误消息: %s\n\n", et+1, nlj.ErrInfo.Msg)
        //   if nlj.ErrInfo.No == "-2" { // 需要重发验证码
        //       return
        //   }
        //   continue
        // ```

        // 2. Captcha
        // fmt.Printf("打开以下路径, 以查看验证码\n%s\n\n", savePath)
        //
        // fmt.Printf("或者打开以下的网址, 以查看验证码\n")
        // fmt.Printf("%s\n\n", verifyImgURL)

        const prompt = await this.proc.readUntil('|| PROMPT END ||', true)
        if (this.proc.exited()) {
            // all output until exit read
            if (prompt.includes('百度帐号登录成功')) {
                return { kind: StepKind.Success };
            } else {
                return { kind: StepKind.Failed };
            }
        }

        if (prompt.includes('请输入验证方式 (1 或 2) > ')) {
            let step = new Steps.SendVerifyTypeStep();
            step.phone = prompt.match(/1: 手机: (.*)\n/)?.[1] ?? '';
            step.email = prompt.match(/2: 邮箱: (.*)\n/)?.[1] ?? '';
            return step;
        }

        if (prompt.includes('请输入接收到的验证码 > ')) {
            return { kind: StepKind.VerifyCode };
        }

        if (prompt.includes('请输入验证码 > ')) {
            let step = new Steps.CaptchaStep();
            step.localUrl = prompt.match(/打开以下路径, 以查看验证码\n(.*)\n/)?.[1] ?? '';
            step.remoteUrl = prompt.match(/或者打开以下的网址, 以查看验证码\n(.*)\n/)?.[1] ?? '';
            return step
        }

        throw new Error('Unknown prompt: ' + prompt);
    }

    async sendUserPass(user: string, pass: string): Promise<void> {
        this.proc = new Process(this._baiduPcsExe, ['login', '-username', user, '-password', pass]);
        await this.proc.start();

        // print all output to console
        this.proc.onStdout((data) => {
            console.log(data);
        });
    }

    async kill(): Promise<void> {
        if (this.proc === undefined) {
            throw new Error('BaiduPCS Not started');
        }
        await this.proc.kill();
    }

    async send(input: string): Promise<void> {
        if (this.proc === undefined) {
            throw new Error('BaiduPCS Not started');
        }

        if (!input.endsWith('\n')) {
            input += '\n';
        }

        await this.proc.write(input);
    }

    async sendVerifyType(verifyType: 'mobile' | 'email'): Promise<void> {
        await this.send(verifyType === 'mobile' ? '1' : '2');
    }

    async sendVerifyCode(verifyCode: string): Promise<void> {
        await this.send(verifyCode)
    }

    async sendCaptcha(captcha: string): Promise<void> {
        await this.send(captcha)
    }
}

export interface DownloadProgress {
    id: string,
    downloaded: number;
    total: number;
    speed: number;
    elapsed: number;
    timeLeft: number;
}

interface ExitStatus {
    success: boolean,
    error: string,
}

interface Message {
    session_id: string,
    type: string,
    name: string,
    data: unknown,
}

const prefix = "\nINC-PROTO-BEGIN\n"
const suffix = "\nINC-PROTO-END\n"

export const ErrNotStarted = new Error('BaiduPCS Not started');

export class Downloader {
    private _proc: Process | undefined;
    private _onProgressListener: ((progress: DownloadProgress) => void) | undefined;
    // NOTE: 
    //  1. onCompleted is called for each file
    //  2. onCompleted is not guaranteed to be emitted only once. Currently it should be called only once,
    //    but it is not guaranteed by the implementation.
    private _onCompletedListener: (() => void) | undefined;

    private _lastProgress: DownloadProgress = {
        id: '',
        downloaded: 0,
        total: 0,
        speed: 0,
        elapsed: 0,
        timeLeft: 0,
    };

    constructor(
        private _baiduPcsExe: string,
    ) { }

    lastProgress(): DownloadProgress {
        return this._lastProgress;
    }

    async onProgress(f: (progress: DownloadProgress) => void): Promise<void> {
        this._onProgressListener = f;
    }

    // FIXME: onCompleted is called for each file
    async onCompleted(f: () => void): Promise<void> {
        this._onCompletedListener = f;
    }

    private static readMessages(content: string): Message[] {
        const messages: Message[] = [];
        let startIndex = content.indexOf(prefix);
        while (startIndex !== -1) {
            const endIndex = content.indexOf(suffix, startIndex + prefix.length);
            if (endIndex !== -1) {
                const message = content.substring(startIndex + prefix.length, endIndex);
                messages.push(JSON.parse(message));
                startIndex = content.indexOf(prefix, endIndex + suffix.length);
            } else {
                break;
            }
        }
        return messages;
    }

    async start(panPath: string, saveDir: string): Promise<void> {
        this._proc = new Process(this._baiduPcsExe, ['d', panPath, '--saveto', saveDir]);
        await this._proc.start();

        (async () => {
            while (true) {
                if (this._proc === undefined) {
                    throw ErrNotStarted;
                }

                let content: string;
                try {
                    content = await this._proc.readUntil(suffix, false);
                } catch (e) {
                    if (e === EOF) {
                        break;
                    }
                    throw e;
                }

                const messages = Downloader.readMessages(content);

                for (const message of messages) {
                    if (message.name === 'download_progress') {
                        const progress = message.data as DownloadProgress;
                        this._lastProgress = progress;
                        this._onProgressListener?.(progress);

                        // if (progress.downloaded >= progress.total) {
                        //     this._onCompletedListener?.();
                        // }
                    } else if (message.name === 'download_exited') {
                        const status = message.data as ExitStatus;
                        if (status.success) {
                            this._onCompletedListener?.();
                        } else {
                            throw new Error(status.error);
                        }
                    }
                }
            }
        })();
    }

    async kill(): Promise<void> {
        if (this._proc === undefined) {
            throw ErrNotStarted;
        }
        await this._proc.kill();
    }
}

export class BaiduPCS {
    constructor(
        private _baiduPcsExe: string,
        private _logger: Logger,
    ) { }

    async runCommand(args: string[]): Promise<string> {
        const proc = new Process(this._baiduPcsExe, args);
        await proc.start();
        await proc.wait();
        return proc.readAll();
    }

    // return empty string if not logged in
    async who(): Promise<string> {
        const output = await this.runCommand(['who']);

        // logged in: 当前帐号 uid: 123456789, 用户名: xxxxx, 性别: unknown, 年龄: 1.1
        // logged out: 当前帐号 uid: 0, 用户名: , 性别: , 年龄: 0.0
        const match = output.match(/用户名: ([^,]+),/);
        if (match === null) {
            return '';
        }

        return match[1].trim();
    }

    async logout(): Promise<void> {
        await this.runCommand(['logout']);
    }

    async ls(path?: string): Promise<File[]> {
        let args = ['ls', '-json'];
        if (path) {
            args.push(path)
        }
        const content = await this.runCommand(args)
        return JSON.parse(content) as File[]
    }

    async cd(path: string): Promise<void> {
        await this.runCommand(['cd', path]);
    }

    async rm(path: string): Promise<void> {
        await this.runCommand(['rm', path]);
    }

    async pwd(): Promise<string> {
        const content = await this.runCommand(['pwd']);
        return content.trim();
    }

    // create a new, not started login session
    login(): Login {
        return new Login(this._baiduPcsExe);
    }

    downloader(): Downloader {
        return new Downloader(this._baiduPcsExe);
    }

    async transfer(url: string, code: string, dst: string): Promise<TransferRecord> {
        this._logger.log(`BaiduPCS: transfering ${url} to ${dst}`);

        const pwd = await this.pwd();
        await this.cd(dst);
        const output = await this.runCommand(['transfer', url, code]);
        await this.cd(pwd);

        // "分享链接转存到网盘成功, 保存了abc到当前目录"
        const match = output.match(/保存了(.+)到当前目录/);
        if (match === null) {
            throw new Error(`Failed to transfer ${url} to ${dst}`);
        }

        const panPath = match[1].trim();

        const files = await this.ls(dst);
        const file = files.find(f => f.file_name === panPath);
        if (file === undefined) {
            throw new Error(`File not found: ${panPath}`);
        }

        // write to log
        const record: TransferRecord = {
            url: url,
            code: code,
            dst: dst ?? '/',
            panPath: panPath,
            md5: file.md5,
        };

        return record;
    }
}

export interface PathMd5 {
    path: string;
    md5: string;
}

export interface TransferRecord {
    url: string;
    code: string;
    dst: string;
    panPath: string;

    md5: string;
}

export interface File {
    fs_id: number;
    path: string;
    file_name: string;
    is_dir: boolean;
    size: number;
    md5: string;
    ctime: number;
    mtime: number;
    app_id: number;
}