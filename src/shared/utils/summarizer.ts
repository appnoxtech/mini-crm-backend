// RunPod API configuration - read at runtime to ensure dotenv has loaded
const RUNPOD_POLL_INTERVAL = 2000; // 2 seconds
const RUNPOD_MAX_POLLS = 60; // Max 2 minutes waiting

function getRunPodConfig() {
  const url = process.env.RUNPOD_API_URL || 'https://api.runpod.ai/v2/2ul7r04332koqo/run';
  const key = process.env.RUNPOD_API_KEY || '';
  return { url, key };
}

interface RunPodResponse {
  id: string;
  status: string;
  output?: {
    summary?: string;
    [key: string]: any;
  };
}

async function pollForResult(jobId: string): Promise<string> {
  const { url: RUNPOD_API_URL, key: RUNPOD_API_KEY } = getRunPodConfig();
  const statusUrl = RUNPOD_API_URL.replace('/run', `/status/${jobId}`);
  console.log(`[Summarizer] Polling for job ${jobId}...`);

  for (let i = 0; i < RUNPOD_MAX_POLLS; i++) {
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`Poll HTTP error! status: ${response.status}`);
    }

    const data: RunPodResponse = (await response.json()) as RunPodResponse;
    console.log(`[Summarizer] Poll ${i + 1}: status=${data.status}`);

    if (data.status === 'COMPLETED') {
      if (data.output?.summary) {
        console.log(`[Summarizer] ✅ Got summary: ${data.output.summary.substring(0, 100)}...`);
        return data.output.summary;
      }
      throw new Error('Job completed but no summary in output');
    }

    if (data.status === 'FAILED') {
      throw new Error(`RunPod job failed: ${JSON.stringify(data)}`);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, RUNPOD_POLL_INTERVAL));
  }

  throw new Error(`RunPod job timed out after ${RUNPOD_MAX_POLLS * RUNPOD_POLL_INTERVAL / 1000}s`);
}

export async function summarizeThreadWithVLLM(threadText: string): Promise<string> {
  const { url: RUNPOD_API_URL, key: RUNPOD_API_KEY } = getRunPodConfig();
  
  console.log(`[Summarizer] Using API URL: ${RUNPOD_API_URL}`);
  console.log(`[Summarizer] API Key: ${RUNPOD_API_KEY ? RUNPOD_API_KEY.substring(0, 8) + '...' : 'NOT SET'}`);
  
  if (!RUNPOD_API_KEY) {
    throw new Error('RUNPOD_API_KEY is not set in environment variables');
  }
  
  try {
    console.log(`[Summarizer] Submitting job to RunPod...`);

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
      const errorText = await response.text();
      console.error(`[Summarizer] ❌ HTTP error: ${response.status} - ${errorText}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: RunPodResponse = (await response.json()) as RunPodResponse;
    console.log(`[Summarizer] Job submitted: id=${data.id}, status=${data.status}`);

    // If output is immediately available (sync response)
    if (data.output?.summary) {
      console.log(`[Summarizer] ✅ Immediate summary received`);
      return data.output.summary;
    }

    // If job is queued/running, poll for result
    if (data.id && (data.status === 'IN_QUEUE' || data.status === 'IN_PROGRESS')) {
      return await pollForResult(data.id);
    }

    // Unexpected response
    console.error(`[Summarizer] ❌ Unexpected response:`, data);
    throw new Error(`Unexpected RunPod response: ${JSON.stringify(data)}`);
  } catch (err: any) {
    console.error('[Summarizer] ❌ RunPod service error:', err.message);
    throw new Error(`Failed to summarize thread via RunPod: ${err.message}`);
  }
}
