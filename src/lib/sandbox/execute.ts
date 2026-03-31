import { Sandbox } from "@vercel/sandbox";

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  previewUrl?: string;
}

/**
 * Execute code in a Vercel Sandbox microVM.
 * Supports Node.js and Python runtimes.
 */
export async function executeInSandbox(options: {
  code: string;
  language: "javascript" | "typescript" | "python";
  filename?: string;
  installPackages?: string[];
  exposePort?: number;
  timeout?: number;
}): Promise<SandboxResult> {
  const runtime = options.language === "python" ? "python3.13" : "node24";
  const filename =
    options.filename ??
    (options.language === "python" ? "main.py" : "index.js");

  const sandbox = await Sandbox.create({
    runtime,
    ports: options.exposePort ? [options.exposePort] : [],
    timeout: options.timeout ?? 30_000,
  });

  try {
    // Write the code file
    await sandbox.writeFiles([
      { path: filename, content: Buffer.from(options.code) },
    ]);

    // Install packages if needed
    if (options.installPackages?.length) {
      const installCmd =
        options.language === "python"
          ? "pip"
          : "npm";
      const installArgs =
        options.language === "python"
          ? ["install", ...options.installPackages]
          : ["install", ...options.installPackages];
      await sandbox.runCommand(installCmd, installArgs);
    }

    // Run the code
    const cmd = options.language === "python" ? "python3" : "node";
    const result = await sandbox.runCommand(cmd, [filename]);

    const stdout = await result.stdout();
    const stderr = await result.stderr();
    const exitCode = result.exitCode;

    // Get preview URL if a port was exposed
    const previewUrl = options.exposePort
      ? sandbox.domain(options.exposePort)
      : undefined;

    return { stdout, stderr, exitCode, previewUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { stdout: "", stderr: msg, exitCode: 1 };
  } finally {
    if (!options.exposePort) {
      await sandbox.stop();
    }
    // If port exposed, keep sandbox alive for preview (it'll auto-timeout)
  }
}
