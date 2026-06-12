/**
 * UVS Canonical JSON — core §5.
 * Keys sorted by Unicode CODE POINT (not UTF-16 code units), recursively.
 * No whitespace. Strings and keys NFC-normalized. RFC 8259 escaping.
 * Numbers MUST be integers (no float ambiguity across languages) — enforced.
 *
 * Why code points, not plain .sort(): JS default string sort compares UTF-16
 * code units, which disagrees with code-point order for astral-plane characters
 * (a surrogate 0xD800.. sorts below 0xE000..0xFFFF, but its code point is
 * higher). Python's sorted(), Java and C++ compare code points — so plain
 * .sort() can produce a DIFFERENT hash than every other reference verifier.
 */

'use strict';

function cmpCodePoint(a, b) {
  const A = Array.from(a), B = Array.from(b);   // iterate by code points
  const n = Math.min(A.length, B.length);
  for (let i = 0; i < n; i++) {
    const x = A[i].codePointAt(0), y = B[i].codePointAt(0);
    if (x !== y) return x - y;
  }
  return A.length - B.length;
}

/**
 * Serialize a value to its canonical JSON string.
 * @param {*} obj
 * @returns {string}
 */
function canonicalJSON(obj) {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'boolean') return JSON.stringify(obj);
  if (typeof obj === 'number') {
    if (!Number.isInteger(obj))
      throw new Error('canonicalJSON: non-integer number ' + obj + ' — hashable values must be integers (quantize floats first, core §5)');
    return JSON.stringify(obj);
  }
  if (typeof obj === 'string') return JSON.stringify(obj.normalize('NFC'));
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJSON).join(',') + ']';
  }
  if (typeof obj === 'object') {
    const pairs = Object.keys(obj).map(k => [k.normalize('NFC'), obj[k]])  // normalize keys, keep values paired
      .sort((a, b) => cmpCodePoint(a[0], b[0]));
    return '{' + pairs.map(p => JSON.stringify(p[0]) + ':' + canonicalJSON(p[1])).join(',') + '}';
  }
  throw new Error('canonicalJSON: unsupported type ' + typeof obj);
}

module.exports = { canonicalJSON };
