// Lightweight external-id generator (nanoid-style) for new records.
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function externalId(prefix: string, size = 12): string {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  let id = "";
  for (const b of bytes) id += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${id}`;
}
