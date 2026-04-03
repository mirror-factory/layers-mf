/**
 * Backward-compatible re-export from the centralized embeddings module.
 *
 * All 13+ consumers import from "@/lib/ai/embed" — this shim keeps them
 * working while the real implementation now lives in "@/lib/embeddings".
 *
 * New code should import directly from "@/lib/embeddings".
 */
export { generateEmbedding, generateEmbeddings } from "@/lib/embeddings";
