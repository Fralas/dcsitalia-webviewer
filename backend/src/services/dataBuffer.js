import fs from 'fs';
import path from 'path';
import * as csvParser from './csvParser.js';

const DEFAULT_BUFFER_FILE = path.resolve(process.cwd(), 'data-buffer.json');

function getBufferFilePath(customPath) {
  return customPath ? path.resolve(customPath) : DEFAULT_BUFFER_FILE;
}

export function readBuffer(bufferFilePath) {
  const targetPath = getBufferFilePath(bufferFilePath);

  if (!fs.existsSync(targetPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(targetPath, 'utf-8');
    const parsed = JSON.parse(content);
    return parsed.data || parsed;
  } catch (error) {
    console.error('Error reading buffer file:', error.message);
    return null;
  }
}

export function writeBuffer(data, bufferFilePath) {
  const targetPath = getBufferFilePath(bufferFilePath);
  const tempPath = `${targetPath}.tmp`;
  const payload = {
    data,
    updatedAt: Date.now(),
  };

  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2));
  fs.renameSync(tempPath, targetPath);
}

export function syncFromCsv(airports, csvDir, bufferFilePath) {
  const data = csvParser.parseAllAirports(airports, csvDir);
  writeBuffer(data, bufferFilePath);
  return data;
}

export default {
  readBuffer,
  writeBuffer,
  syncFromCsv,
};
