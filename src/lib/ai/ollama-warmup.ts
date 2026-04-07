/**
 * Ollama model warmup — pings the model on import to keep it loaded in GPU memory.
 * Called once when the chat route first loads. Sets keep_alive to 24h so the model
 * stays resident between requests.
 */

let warmedUp = false;

export async function warmupOllama(modelName: string = "gemma4:26b"): Promise<void> {
  if (warmedUp) return;
  warmedUp = true;

  try {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        prompt: "ping",
        keep_alive: "24h",
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (res.ok) {
      console.log(`[ollama] Model ${modelName} pinned in memory (keep_alive: 24h)`);
    }
  } catch {
    // Ollama not running or model not available — silent fail
  }
}
