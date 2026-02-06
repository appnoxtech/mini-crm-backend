import { parentPort, workerData } from 'worker_threads';
import { simpleParser } from 'mailparser';

/**
 * Worker thread for parsing emails.
 * This offloads the CPU-intensive parsing task from the main event loop.
 */

if (!parentPort) {
    throw new Error('This file must be run as a worker thread');
}

parentPort.on('message', async (task) => {
    const { id, source, type } = task;

    try {
        if (type === 'parse') {
            // Ensure source is a string or Buffer
            const sourceData = Buffer.isBuffer(source) ? source :
                (typeof source === 'object' && source.type === 'Buffer' ? Buffer.from(source.data) : String(source));

            const parsed = await simpleParser(sourceData);

            // We need to serialize the result to send it back
            // Buffers/Streams might need special handling, but simpleParser result is mostly JSON-serializable
            // Attachments content might be large Buffers

            const result = {
                text: parsed.text,
                html: parsed.html || parsed.textAsHtml,
                subject: parsed.subject,
                from: parsed.from,
                to: parsed.to,
                cc: parsed.cc,
                date: parsed.date,
                messageId: parsed.messageId,
                inReplyTo: parsed.inReplyTo,
                references: parsed.references,
                attachments: parsed.attachments?.map((att: any) => ({
                    filename: att.filename,
                    contentType: att.contentType,
                    contentDisposition: att.contentDisposition,
                    checksum: att.checksum,
                    size: att.size,
                    headers: att.headers,
                    content: att.content, // Buffer
                    contentId: att.contentId,
                    cid: att.cid,
                    related: att.related
                }))
            };

            parentPort?.postMessage({ id, success: true, data: result });
        }
    } catch (error: any) {
        parentPort?.postMessage({ id, success: false, error: error.message });
    }
});
