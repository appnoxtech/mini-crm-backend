// RunPod API configuration
const RUNPOD_API_URL = process.env.RUNPOD_API_URL || 'https://api.runpod.ai/v2/2ul7r04332koqo/run';
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || 'YOUR_API_KEY';

interface RunPodResponse {
  id: string;
  status: string;
  output?: {
    summary?: string;
    [key: string]: any;
  };
}

export async function summarizeThreadWithVLLM(threadText: string): Promise<string> {
  try {


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

    const data: RunPodResponse = await response.json();


    // RunPod returns a job ID for async processing
    // You may need to poll for the result using the status endpoint
    if (data.output?.summary) {
      return data.output.summary;
    }

    // If the response contains the job ID, return it for now
    // You might want to implement polling logic here
    return data.id || JSON.stringify(data);
  } catch (err: any) {
    console.error('RunPod service error:', err.message);
    throw new Error('Failed to summarize thread via RunPod');
  }
}
