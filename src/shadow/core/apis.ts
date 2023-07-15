import { listen } from '@tauri-apps/api/event'
import { open as tauriOpen } from '@tauri-apps/api/shell';
import { invoke } from './invoke'

export namespace fs {
    export async function readDir(path: string): Promise<string[]> {
        return invoke('plugin:fs|read_dir', { path })
    }

    export async function readTextFile(path: string, defaultValue?: string): Promise<string> {
        try {
            return invoke('plugin:fs|read_text_file', { path })
        } catch (e) {
            if (defaultValue) {
                return defaultValue;
            }
            throw e;
        }
    }

    export async function readJSONFile<T>(path: string, defaultValue?: (() => T) | Exclude<T, Function>): Promise<T> {
        try {
            const content = await readTextFile(path);
            return JSON.parse(content);
        } catch (e) {
            if (defaultValue) {
                if (typeof defaultValue === 'function') {
                    return (defaultValue as () => T)();
                }
                return defaultValue;
            }

            throw e;
        }
    }

    export async function writeTextFile(path: string, content: string): Promise<void> {
        return invoke('plugin:fs|write_text_file', { path, content })
    }

    export async function exists(path: string): Promise<boolean> {
        const ok = await invoke('plugin:fs|exists', { path })
        return ok as boolean;
    }

    export async function makeDir(path: string): Promise<string> {
        return invoke('plugin:fs|make_dir', { path })
    }

    export async function removeFile(path: string): Promise<void> {
        return invoke('plugin:fs|remove_file', { path })
    }

    export async function removeDir(path: string): Promise<void> {
        return invoke('plugin:fs|remove_dir', { path })
    }

    export async function removeAll(path: string): Promise<void> {
        return invoke('plugin:fs|remove_all', { path })
    }

    export async function rename(from: string, to: string): Promise<void> {
        return invoke('plugin:fs|rename', { from, to })
    }
}

export namespace http {
    export async function get(url: string): Promise<string> {
        return await invoke('plugin:http|get', { url })
    }

    export async function download(url: string, savePath: string): Promise<void> {
        return await invoke('plugin:http|http_download', { url, savePath })
    }
}

// @deprecated Use the pure typescript implementation `baidu-pcs` instead.
export namespace baiduPCS {
    export async function transfer(url: string, code: string, dst: string = ""): Promise<string> {
        return invoke('plugin:baidu_pcs|transfer', { url, code, dst });
    }

    export async function download(path: string, savePath: string): Promise<string> {
        return invoke('plugin:baidu_pcs|download', { path, savePath });
    }

    export async function cd(path: string): Promise<string> {
        return invoke('plugin:baidu_pcs|cd', { path });
    }

    export async function mkdir(path: string): Promise<string> {
        return invoke('plugin:baidu_pcs|mkdir', { path });
    }
}

export namespace compress {
    export async function extract(archive: string, dstDir: string, password?: string, workDir?: string): Promise<string> {
        return invoke('plugin:compress|extract', { archive, dstDir, password, workDir });
    }
}

export namespace process {
    export async function create(program: string, args: string[]): Promise<string> {
        return invoke('plugin:process|create', { program, args });
    }

    export async function write_stdin(pid: string, data: string): Promise<string> {
        return invoke('plugin:process|write_stdin', { pid, data });
    }

    export async function kill(pid: string): Promise<string> {
        return invoke('plugin:process|kill', { pid });
    }

    export async function on_stdout(pid: string, callback: (data: string) => void): Promise<() => void> {
        const unlisten = await listen<string>(`process:stdout:chunk:${pid}`, e => {
            callback(e.payload);
        });
        return unlisten;
    }

    export async function on_stderr(pid: string, callback: (data: string) => void): Promise<() => void> {
        const unlisten = await listen<string>(`process:stderr:chunk:${pid}`, e => {
            callback(e.payload);
        });
        return unlisten;
    }

    export async function on_exit(pid: string, callback: () => void): Promise<() => void> {
        const unlisten = await listen<number>(`process:exit:${pid}`, _ => {
            callback();
        });
        return unlisten;
    }
}

export namespace crypto {
    export async function md5sum(path: string): Promise<string> {
        return invoke('plugin:crypto|md5sum', { path });
    }
}

export namespace secrets {
    export async function decryptFile(path: string, zipped = true): Promise<string> {
        return invoke('plugin:secrets|decrypt_file', { path, zipped });
    }
}

export namespace shell {
    export async function open(path: string): Promise<void> {
        return tauriOpen(path, 'start');
    }
}

export namespace os {
    // get the absolute path of the current executable
    export async function getCurrentExe(): Promise<string> {
        return invoke('plugin:os|get_current_exe');
    }
}