/**
 * UVS Version Negotiation — Section 3.5
 * Integer sets, not ranges. max(intersection) wins.
 */

'use strict';

/**
 * Negotiate UVS version between client and server.
 * @param {number[]} clientVersions — set of supported versions
 * @param {number[]} serverVersions — set of supported versions
 * @returns {{ accepted: boolean, negotiated?: number, clientVersions: number[], serverVersions: number[] }}
 */
function negotiate(clientVersions, serverVersions) {
  const cs = new Set(clientVersions);
  const ss = new Set(serverVersions);
  const intersection = [...cs].filter(v => ss.has(v));
  if (intersection.length === 0) {
    return {
      accepted: false,
      clientVersions: [...cs].sort((a, b) => a - b),
      serverVersions: [...ss].sort((a, b) => a - b)
    };
  }
  return {
    accepted: true,
    negotiated: Math.max(...intersection)
  };
}

module.exports = { negotiate };
