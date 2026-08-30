export const PHOENIX_PACKAGE_ID = 'phoenix-decryptor';

export const PHOENIX_FREQ_MIN = 100;
export const PHOENIX_FREQ_MAX = 520;
export const PHOENIX_GATE_MHZ = 11;
export const PHOENIX_LOCK_MS = 880;
export const PHOENIX_CIPHER_MS = 7500;
export const PHOENIX_TARGET_CATCHES = 3;
export const PHOENIX_MAX_DROPS = 3;

export const PHOENIX_INTERCEPTS = Object.freeze([
  {
    id: 'guard-142',
    freqMhz: 142.76,
    digits: '44701',
    transcriptKey: 'guard',
  },
  {
    id: 'burst-241',
    freqMhz: 241.02,
    digits: '90331',
    transcriptKey: 'burst',
  },
  {
    id: 'relay-433',
    freqMhz: 433.92,
    digits: '11870',
    transcriptKey: 'relay',
  },
]);

export function freqToRatio(freq) {
  return (freq - PHOENIX_FREQ_MIN) / (PHOENIX_FREQ_MAX - PHOENIX_FREQ_MIN);
}

export function ratioToFreq(ratio) {
  return PHOENIX_FREQ_MIN + ratio * (PHOENIX_FREQ_MAX - PHOENIX_FREQ_MIN);
}

export function clampPhoenixFreq(freq) {
  return Math.min(PHOENIX_FREQ_MAX, Math.max(PHOENIX_FREQ_MIN, freq));
}

export function formatPhoenixFreq(freq) {
  return `${Number(freq).toFixed(2)} MHz`;
}
