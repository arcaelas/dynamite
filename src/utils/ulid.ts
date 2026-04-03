/**
 * @description ULID (Universally Unique Lexicographically Sortable Identifier) generator.
 * @description Generador de ULID (Identificador Único Lexicográficamente Ordenable).
 *
 * 48 bits timestamp (ms) + 80 bits random, Crockford Base32 encoding.
 * Monotonic within the same millisecond: sequential calls in the same ms produce incrementing IDs.
 *
 * Monotónico dentro del mismo milisegundo: llamadas secuenciales en el mismo ms producen IDs incrementales.
 */

const CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

let last_time = 0;
let last_random_hi = 0;
let last_random_lo = 0;

function encode_time(time: number, len: number): string {
  let str = '';
  for (let i = len; i > 0; i--) {
    str = CHARS[time % 32] + str;
    time = Math.floor(time / 32);
  }
  return str;
}

function encode_random(): string {
  let str = '';
  let hi = last_random_hi;
  let lo = last_random_lo;
  for (let i = 0; i < 8; i++) {
    str = CHARS[lo % 32] + str;
    lo = Math.floor(lo / 32);
  }
  for (let i = 0; i < 8; i++) {
    str = CHARS[hi % 32] + str;
    hi = Math.floor(hi / 32);
  }
  return str;
}

export function ulid(): string {
  let now = Date.now();

  if (now === last_time) {
    last_random_lo++;
    if (last_random_lo > 0xFFFFFFFFFF) {
      last_random_lo = 0;
      last_random_hi++;
    }
  } else {
    last_time = now;
    last_random_hi = Math.floor(Math.random() * 0xFFFFFFFFFF);
    last_random_lo = Math.floor(Math.random() * 0xFFFFFFFFFF);
  }

  return encode_time(now, 10) + encode_random();
}
