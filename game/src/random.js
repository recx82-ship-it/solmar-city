// A small seeded random generator (xorshift with a Weyl increment): the same
// seed always deals the same city, the same traffic and the same screenshots,
// which is what makes staged scenes repeatable.

export function createRandom(seed) {
  let state = (seed | 0) || 0x9e3779b9;
  let counter = 0x2545f491;
  return function random() {
    counter = (counter + 0x9e3779b9) | 0;
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state = (state + counter) | 0;
    return ((state >>> 0) % 1000000) / 1000000;
  };
}

/** Pick one entry from a list with the seeded generator. */
export function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

/** A number between low (inclusive) and high (exclusive). */
export function range(random, low, high) {
  return low + random() * (high - low);
}

/** A whole number between low and high, inclusive. */
export function intRange(random, low, high) {
  return low + Math.floor(random() * (high - low + 1));
}
