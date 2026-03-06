import { Nango } from "@nangohq/node";

// Server-side Nango client (secret key)
export const nango = new Nango({ secretKey: process.env.NANGO_SECRET_KEY! });
