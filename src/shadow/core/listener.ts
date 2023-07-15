export type Listener<T extends (...args: any[]) => any> = {
    listen: (callback: T) => () => void;
    unlisten: (callback: T) => void;
    emit: (...args: Parameters<T>) => void;
};

export function createListener<T extends (...args: any[]) => any>(): Listener<T> {
    const callbacks: T[] = [];

    return {
        listen: (callback: T) => {
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index >= 0) {
                    callbacks.splice(index, 1);
                }
            };
        },
        unlisten: (callback: T) => {
            const index = callbacks.indexOf(callback);
            if (index >= 0) {
                callbacks.splice(index, 1);
            }
        },
        emit: (...args: Parameters<T>) => {
            for (const callback of callbacks) {
                callback(...args);
            }
        },
    };
}
