export const delimiter = '\\';

export function join(...paths: string[]): string {
    return paths.join(delimiter);
}

export function basename(path: string): string {
    return path.split(delimiter).pop()!;
}

export function dirname(path: string): string {
    return path.split(delimiter).slice(0, -1).join(delimiter);
}

export function extname(path: string): string | undefined {
    return path.split('.').pop();
}