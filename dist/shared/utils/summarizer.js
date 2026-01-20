"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeThreadWithVLLM = summarizeThreadWithVLLM;
// RunPod API configuration
const RUNPOD_API_URL = process.env.RUNPOD_API_URL || 'https://api.runpod.ai/v2/2ul7r04332koqo/run';
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || 'YOUR_API_KEY';
async function summarizeThreadWithVLLM(threadText) {
    try {
        console.log('Calling RunPod service...');
        console.log('Thread text:', threadText);
        const response = await fetch(RUNPOD_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RUNPOD_API_KEY}`
            },
            body: JSON.stringify({
                input: {
                    email_content: threadText
                }
            })
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('RunPod response:', data);
        // RunPod returns a job ID for async processing
        // You may need to poll for the result using the status endpoint
        if (data.output?.summary) {
            return data.output.summary;
        }
        // If the response contains the job ID, return it for now
        // You might want to implement polling logic here
        return data.id || JSON.stringify(data);
    }
    catch (err) {
        console.error('RunPod service error:', err.message);
        throw new Error('Failed to summarize thread via RunPod');
    }
}
//# sourceMappingURL=summarizer.js.map