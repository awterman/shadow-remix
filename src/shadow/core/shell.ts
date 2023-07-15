import { runCommand } from "./process";


// open path with explorer
export function explorer(path: string) {
    runCommand("explorer", [path])
}