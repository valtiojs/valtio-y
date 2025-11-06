/**
 * Seeded pseudo-random number generator (xorshift128+)
 * Provides deterministic shuffling for reproducible game states
 */

export class SeededRNG {
  private state: [number, number, number, number];

  constructor(seed: string) {
    // Convert seed string to 4 32-bit integers
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    }

    this.state = [
      h >>> 0,
      (h * 2654435761) >>> 0,
      (h * 3266489917) >>> 0,
      (h * 4194304001) >>> 0,
    ];
  }

  /**
   * Returns a random number in [0, 1)
   */
  next(): number {
    const [s0, s1, s2, s3] = this.state;
    let t = s1 ^ (s1 << 11);
    this.state = [s1, s2, s3, (s0 ^ (s0 >>> 19) ^ t ^ (t >>> 8)) >>> 0];
    return (this.state[3] >>> 0) / 0x100000000;
  }

  /**
   * Returns a random integer in [0, max)
   */
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}

/**
 * Fisher-Yates shuffle using seeded RNG
 */
export function seededShuffle<T>(array: T[], seed: string): T[] {
  const rng = new SeededRNG(seed);
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/**
 * Generate a random seed string
 */
export function generateSeed(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}
