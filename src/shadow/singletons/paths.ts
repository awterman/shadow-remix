import * as interfaces from "./interfaces";
import { fs, os } from "../core/apis";
import * as path from "../core/path";


const exePath = await os.getCurrentExe();
let exeDir;
if (exePath) {
    exeDir = path.dirname(exePath);
} else {
    exeDir = 'unknown';
}

// dirs under exeDir
const dirs: { [key: string]: string } = {
    root: exeDir,

    data: path.join(exeDir, 'data'),
    config: path.join(exeDir, 'config'),
    thirdParty: path.join(exeDir, 'third_party'),
    download: path.join(exeDir, 'download'),
    userData: path.join(exeDir, 'user_data'),
}

async function ensureDir(dir: string) {
    await fs.makeDir(dir);
}

// ensure dirs exist
for (let dir in dirs) {
    if (dir === 'root') {
        continue;
    }

    await ensureDir(dirs[dir]);
}

class Paths implements interfaces.Paths {
    // configs
    config = path.join(dirs.config, 'config.json');

    // userData
    downloads = path.join(dirs.userData, 'downloads.json');

    // third party
    baiduPCS = path.join(dirs.thirdParty, 'BaiduPCS-Go.exe');
    _7z = path.join(dirs.thirdParty, '7z.exe');
}

export const paths: interfaces.Paths = new Paths();
export const shadowDirs = dirs;