export const PHOENIX_PACKAGE_ID = 'phoenix-decryptor';

export const PHOENIX_FREQ_MIN = 100;
export const PHOENIX_FREQ_MAX = 520;
export const PHOENIX_GATE_MHZ = 11;
export const PHOENIX_LOCK_MS = 880;
export const PHOENIX_CIPHER_MS = 7500;
export const PHOENIX_TARGET_CATCHES = 5;
export const PHOENIX_FILE_CATCHES = 5;
export const PHOENIX_MAX_DROPS = 3;

function withBurstTranscriptMeta(file) {
  const stem = String(file.fileName).replace(/\.SIG$/i, '');
  return {
    ...file,
    transcriptFile: `${stem}.TXT`,
    bursts: file.bursts.map((burst, index) => ({
      ...burst,
      transcriptKey: `${file.transcriptKey}${String.fromCharCode(65 + index)}`,
    })),
  };
}

export const PHOENIX_INTERCEPTS = Object.freeze([
  withBurstTranscriptMeta({
    id: 'guard-142',
    fileName: 'GUARD_142.SIG',
    freqMhz: 142.76,
    transcriptKey: 'guard',
    bursts: [
      { id: 'guard-142-a', freqMhz: 112.40, digits: '44107' },
      { id: 'guard-142-b', freqMhz: 142.76, digits: '44701' },
      { id: 'guard-142-c', freqMhz: 174.18, digits: '44019' },
      { id: 'guard-142-d', freqMhz: 206.55, digits: '44790' },
      { id: 'guard-142-e', freqMhz: 238.90, digits: '40117' },
    ],
  }),
  withBurstTranscriptMeta({
    id: 'burst-241',
    fileName: 'BURST_241.SIG',
    freqMhz: 241.02,
    transcriptKey: 'burst',
    bursts: [
      { id: 'burst-241-a', freqMhz: 176.20, digits: '90310' },
      { id: 'burst-241-b', freqMhz: 209.44, digits: '93104' },
      { id: 'burst-241-c', freqMhz: 241.02, digits: '90331' },
      { id: 'burst-241-d', freqMhz: 273.80, digits: '93301' },
      { id: 'burst-241-e', freqMhz: 307.15, digits: '90013' },
    ],
  }),
  withBurstTranscriptMeta({
    id: 'relay-433',
    fileName: 'RELAY_433.SIG',
    freqMhz: 433.92,
    transcriptKey: 'relay',
    bursts: [
      { id: 'relay-433-a', freqMhz: 361.10, digits: '11807' },
      { id: 'relay-433-b', freqMhz: 397.40, digits: '18170' },
      { id: 'relay-433-c', freqMhz: 433.92, digits: '11870' },
      { id: 'relay-433-d', freqMhz: 469.25, digits: '11087' },
      { id: 'relay-433-e', freqMhz: 504.60, digits: '18701' },
    ],
  }),
]);

export function getPhoenixFileBursts(file) {
  if (Array.isArray(file?.bursts) && file.bursts.length) return file.bursts;
  if (!file) return [];
  return [{ id: file.id, freqMhz: file.freqMhz, digits: file.digits }];
}

export function getPhoenixTranscriptFileName(file) {
  if (file?.transcriptFile) return file.transcriptFile;
  return String(file?.fileName || 'INTERCEPT').replace(/\.SIG$/i, '.TXT');
}

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
