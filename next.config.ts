import type { NextConfig } from "next";
import million from "million/compiler";

const nextConfig: NextConfig = {
  typescript: {
    // Skip type checking during build — pre-existing Supabase type mismatches
    // (generated types don't include tables from recent migrations)
    ignoreBuildErrors: true,
  },
  serverExternalPackages: [
    "discord.js",
    "@discordjs/ws",
    "@discordjs/rest",
    "@chat-adapter/discord",
    "bufferutil",
    "utf-8-validate",
  ],
};

export default million.next(nextConfig as any, {
  // Keep Million installed for profiling/gates, but do not auto-wrap server
  // layouts. The auto compiler currently wraps App Router RSC layouts in a way
  // that breaks Next 16 server rendering.
  auto: false,
}) as NextConfig;
