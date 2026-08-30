import path from 'path';
import * as csvParser from './csvParser.js';
import { DOC, archiveSeedFile, loadJsonIfPresent, saveJson } from '../db/jsonStore.js';

const DEFAULT_BUFFER_FILE = path.resolve(process.cwd(), 'data-buffer.json');

function getBufferFilePath(customPath) {
  return customPath ? path.resolve(customPath) : DEFAULT_BUFFER_FILE;
}

export function readBuffer(bufferFilePath) {
  const seedPath = getBufferFilePath(bufferFilePath);
  const parsed = loadJsonIfPresent(DOC.CSV_BUFFER, seedPath);
  if (parsed == null) return null;
  return parsed.data || parsed;
}

export async function writeBuffer(data, bufferFilePath) {
  saveJson(DOC.CSV_BUFFER, {
    data,
    updatedAt: Date.now(),
  });
  archiveSeedFile(getBufferFilePath(bufferFilePath));
}

export async function syncFromCsv(airports, csvDir, bufferFilePath) {
  const data = await csvParser.parseAllAirports(airports, csvDir);
  await writeBuffer(data, bufferFilePath);
  return data;
}

export default {
  readBuffer,
  writeBuffer,
  syncFromCsv,
};
