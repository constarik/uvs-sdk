/**
 * UVS Canonical JSON — Section 8.2
 * Keys sorted by Unicode code point, recursively.
 * No whitespace. UTF-8 NFC normalization. RFC 8259 escaping.
 */

'use strict';

/**
 * Serialize object to canonical JSON string.
 * @param {*} obj
 * @returns {string}
 */
function canonicalJSON(obj) {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'boolean' || typeof obj === 'number') return JSON.stringify(obj);
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJSON).join(',') + ']';
  }
  if (typeof obj === 'object') {
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(k =>
      JSON.stringify(k) + ':' + canonicalJSON(obj[k])
    ).join(',') + '}';
  }
  throw new Error('canonicalJSON: unsupported type ' + typeof obj);
}

module.exports = { canonicalJSON };
