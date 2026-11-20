// A small seeded random number generator (mulberry32): the same seed gives the same
// city, traffic and screenshot scenes, which is what makes the game repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An integer in [min, max). */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min));
}

/** One item from a list. */
export function randomPick(random, list) {
  return list[Math.floor(random() * list.length)];
}

/** A value in [min, max). */
export function randomRange(random, min, max) {
  return min + random() * (max - min);
}
