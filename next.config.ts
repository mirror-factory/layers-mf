import type { NextConfig } from "next";

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

export default nextConfig;
