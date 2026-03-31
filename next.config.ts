import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
