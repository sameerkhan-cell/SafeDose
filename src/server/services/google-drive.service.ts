import { OAuth2Client } from "google-auth-library";

export class GoogleDriveService {
    /**
     * Uploads a file buffer to Google Drive.
     * Requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_DRIVE_REFRESH_TOKEN in env.
     */
    static async uploadFile(
        fileBuffer: Buffer,
        fileName: string,
        mimeType: string
    ): Promise<string> {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

        if (!clientId || !clientSecret || !refreshToken) {
            console.warn(
                "[GoogleDriveService] Google Drive upload skipped (missing GOOGLE_DRIVE_REFRESH_TOKEN or other credentials in env)."
            );
            return "";
        }

        const oauth2Client = new OAuth2Client(clientId, clientSecret);
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        try {
            const { token } = await oauth2Client.getAccessToken();
            if (!token) {
                throw new Error("Failed to retrieve Google Access Token.");
            }

            const metadata: any = {
                name: fileName,
            };
            if (folderId) {
                metadata.parents = [folderId];
            }

            const boundary = "boundary_mediverify_upload_" + Date.now();
            const delimiter = `\r\n--${boundary}\r\n`;
            const closeDelimiter = `\r\n--${boundary}--`;

            const metadataPart =
                `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
                JSON.stringify(metadata) +
                `\r\n`;

            const fileHeader = `Content-Type: ${mimeType}\r\n\r\n`;

            const bodyBuffer = Buffer.concat([
                Buffer.from(delimiter),
                Buffer.from(metadataPart),
                Buffer.from(delimiter),
                Buffer.from(fileHeader),
                fileBuffer,
                Buffer.from(closeDelimiter),
            ]);

            const response = await fetch(
                "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": `multipart/related; boundary=${boundary}`,
                        "Content-Length": bodyBuffer.length.toString(),
                    },
                    body: bodyBuffer,
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Google Drive API error: ${response.status} - ${errorText}`);
            }

            const data = (await response.json()) as any;
            console.log(
                `[GoogleDriveService] Uploaded ${fileName} to Google Drive: ${data.id}`
            );
            return data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`;
        } catch (error: any) {
            console.error("[GoogleDriveService] Upload failed:", error?.message || error);
            throw error;
        }
    }
}
