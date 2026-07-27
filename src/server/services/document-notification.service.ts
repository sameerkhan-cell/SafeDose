import nodemailer from "nodemailer";

const PLACEHOLDER_PATTERNS = [
    /^your-email@/i,
    /^your-app-password$/i,
    /example\.com$/i,
    /^changeme$/i,
];

function isPlaceholderCredential(value: string): boolean {
    return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

function isSmtpConfigured(): boolean {
    const host = process.env.SMTP_HOST;
    const portRaw = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !portRaw || !user || !pass) return false;
    if (isPlaceholderCredential(user) || isPlaceholderCredential(pass)) return false;
    return true;
}

function getMailerTransporter(): nodemailer.Transporter | null {
    if (!isSmtpConfigured()) return null;

    const host = process.env.SMTP_HOST!;
    const port = Number(process.env.SMTP_PORT);
    const secure = process.env.SMTP_SECURE === "true" || port === 465;

    return nodemailer.createTransport({
        host,
        port,
        secure,
        family: 4,
        auth: {
            user: process.env.SMTP_USER!,
            pass: process.env.SMTP_PASS!,
        },
        ...(port === 587 ? { requireTLS: true } : {}),
        tls: {
            rejectUnauthorized: false,
        },
        connectionTimeout: 10000,
    });
}

export async function sendDocumentNotificationEmail(params: {
    manufacturerId: string;
    manufacturerName: string;
    documentType: string;
    documentName: string;
    uploadedAt: Date;
    driveLink?: string | null;
    fileBuffer: Buffer;
    fileName: string;
    mimeType: string;
}) {
    const notifyEmail = process.env.DRAP_NOTIFY_EMAIL;
    if (!notifyEmail) {
        console.warn("[DocumentNotificationService] DRAP_NOTIFY_EMAIL env variable is not set. Email notification skipped.");
        return;
    }

    if (!isSmtpConfigured()) {
        console.warn("[DocumentNotificationService] SMTP is not fully or correctly configured. Email notification skipped.");
        return;
    }

    const transporter = getMailerTransporter();
    if (!transporter) {
        console.warn("[DocumentNotificationService] Could not initialize SMTP transporter. Email notification skipped.");
        return;
    }

    const fromAddress = process.env.SMTP_FROM || `SafeDose <${process.env.SMTP_USER}>`;

    const driveSection = params.driveLink
        ? `<p><strong>Google Drive Link:</strong> <a href="${params.driveLink}">${params.driveLink}</a></p>`
        : "<p><strong>Google Drive Link:</strong> Not uploaded to Google Drive</p>";

    const htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #0f172a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">New Regulatory Document Uploaded</h2>
            <p>A new regulatory compliance document has been uploaded to SafeDose.</p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #1e293b;">Metadata</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 4px 0; font-weight: bold; color: #475569; width: 140px;">Manufacturer:</td>
                        <td style="padding: 4px 0; color: #0f172a;">${params.manufacturerName} (ID: ${params.manufacturerId})</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; font-weight: bold; color: #475569;">Document Type:</td>
                        <td style="padding: 4px 0; color: #0f172a;">${params.documentType}</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; font-weight: bold; color: #475569;">Document Name:</td>
                        <td style="padding: 4px 0; color: #0f172a;">${params.documentName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; font-weight: bold; color: #475569;">Upload Time:</td>
                        <td style="padding: 4px 0; color: #0f172a;">${params.uploadedAt.toUTCString()}</td>
                    </tr>
                </table>
            </div>

            ${driveSection}

            <p style="margin-top: 30px; font-weight: bold; color: #2563eb;">
                Action Required: Please log into the Admin / Regulator Dashboard to review and approve or reject this document.
            </p>
            
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 25px 0;" />
            <p style="font-size: 12px; color: #64748b; text-align: center;">This is an automated notification. Please do not reply to this email.</p>
        </div>
    `;

    const textContent = `
New Regulatory Document Uploaded

A new regulatory compliance document has been uploaded to SafeDose.

Metadata:
- Manufacturer: ${params.manufacturerName} (ID: ${params.manufacturerId})
- Document Type: ${params.documentType}
- Document Name: ${params.documentName}
- Upload Time: ${params.uploadedAt.toUTCString()}

${params.driveLink ? `Google Drive Link: ${params.driveLink}` : "Google Drive Link: Not uploaded to Google Drive"}

Action Required: Please log into the Admin / Regulator Dashboard to review and approve or reject this document.

This is an automated notification. Please do not reply to this email.
    `.trim();

    await transporter.sendMail({
        from: fromAddress,
        to: notifyEmail,
        subject: `[SafeDose] New Document Upload: ${params.documentName} (${params.manufacturerName})`,
        text: textContent,
        html: htmlContent,
        attachments: [
            {
                filename: params.fileName,
                content: params.fileBuffer,
                contentType: params.mimeType,
            },
        ],
    });

    console.log(`[DocumentNotificationService] Notification email sent successfully to ${notifyEmail} for document: ${params.documentName}`);
}
