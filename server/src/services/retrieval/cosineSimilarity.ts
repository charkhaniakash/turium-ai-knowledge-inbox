/**
 * Computes cosine similarity between two vectors.
 *
 * Because embeddings are L2-normalised on write (|a| = |b| = 1),
 * cosine similarity reduces to a plain dot product:
 *   cos_sim(a, b) = (a · b) / (|a| × |b|) = a · b   when |a| = |b| = 1
 *
 * This is O(d) where d is the embedding dimension — simple and fast enough
 * for the expected corpus size. At large scale, replace with an ANN index.
 *
 * Returns a value in [-1, 1]; practically [0, 1] for normalised text embeddings.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector dimension mismatch: ${a.length} vs ${b.length}`
    );
  }

  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return dot;
}
