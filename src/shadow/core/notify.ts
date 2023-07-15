import { sendNotification } from "@tauri-apps/api/notification";

export function notifyDesktop(title: string, body: string) {
    sendNotification({
        title: title,
        body: body,
    });
}