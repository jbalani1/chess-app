// Utility for grouping opening names into families

export const KNOWN_OPENING_BASES = [
  // Most common first for matching priority
  "Sicilian Defense",
  "Italian Game",
  "Ruy Lopez",
  "French Defense",
  "Caro Kann Defense",
  "Queens Gambit Declined",
  "Queens Gambit Accepted",
  "Kings Indian Defense",
  "Scotch Game",
  "English Opening",
  "London System",
  "Pirc Defense",
  "Scandinavian Defense",
  "Dutch Defense",
  "Nimzo Indian Defense",
  "Grunfeld Defense",
  "Catalan Opening",
  "Vienna Game",
  "Petrov Defense",
  "Philidor Defense",
  "Four Knights Game",
  "Slav Defense",
  "Kings Gambit Accepted",
  "Kings Gambit Declined",
  "Modern Defense",
  "Alekhine Defense",
  "Benoni Defense",
  "Budapest Gambit",
  "Trompowsky Attack",
  "Bird Opening",
  "Owen Defense",
  "Nimzowitsch Defense",
  "Queens Pawn Game",
  "Queen Pawn Game",
  "King Pawn Game",
  "Kings Pawn Game",
  "King Knight Opening",
  "Indian Defense",
  "Uncommon Opening",
  "Uncommon King Pawn",
]

/**
 * Extract the base opening family from a full opening name.
 * e.g. "Italian Game Two Knights Modern Bishops Opening" → "Italian Game"
 */
export function getBaseOpeningName(name: string): string {
  if (!name) return "Unknown"

  // Normalize: remove apostrophes/special chars for matching
  const normalized = name.replace(/['']/g, "")

  for (const base of KNOWN_OPENING_BASES) {
    const normalizedBase = base.replace(/['']/g, "")
    if (normalized.toLowerCase().startsWith(normalizedBase.toLowerCase())) {
      // Return the original casing from the name if possible
      return name.slice(0, base.length)
    }
  }

  // Fallback: use first 2 words (or 3 if second word is common like "Game", "Defense", etc.)
  const words = name.split(/\s+/)
  if (words.length <= 2) return name
  const continuationWords = ["game", "defense", "opening", "gambit", "attack", "system", "variation"]
  if (words.length >= 2 && continuationWords.includes(words[1].toLowerCase())) {
    return words.slice(0, 2).join(" ")
  }
  return words.slice(0, 2).join(" ")
}

/** Convert an opening family name to a URL-safe slug */
export function openingToSlug(name: string): string {
  return encodeURIComponent(name)
}

/** Convert a URL slug back to an opening family name */
export function slugToOpeningName(slug: string): string {
  return decodeURIComponent(slug)
}
