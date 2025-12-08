import axios from 'axios';

// VLLM service endpoint
const VLLM_API_URL = process.env.VLLM_API_URL || 'http://localhost:5000/summarize';

export async function summarizeThreadWithVLLM(threadText: string): Promise<string> {
  try {
    console.log('Calling VLLM service...');
    console.log('Thread text:', threadText);
    return "DONE";
    const response = await axios.post(VLLM_API_URL, { text: threadText });
    return response.data.summary; // expecting { summary: "..." } from VLLM
  } catch (err: any) {
    console.error('VLLM service error:', err.message);
    throw new Error('Failed to summarize thread via VLLM');
  }
}
