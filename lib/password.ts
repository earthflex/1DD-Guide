/** Random password from the browser's CSPRNG, without look-alike characters (0/O, 1/l/I). */
const SETS = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%*-_+?"];

/** Uniform integer in [0, n) via rejection sampling. */
function randomInt(n: number) {
  const limit = 2 ** 32 - (2 ** 32 % n), buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}
const pick = (chars: string) => chars[randomInt(chars.length)];

export function generatePassword(length = 14) {
  const all = SETS.join("");
  // At least one of each kind, then fill and shuffle (Fisher–Yates).
  const out = SETS.map(pick);
  while (out.length < length) out.push(pick(all));
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join("");
}
