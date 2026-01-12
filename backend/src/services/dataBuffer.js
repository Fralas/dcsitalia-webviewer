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

export async function writeBuffer(data, bufferFilePath) {
  const targetPath = getBufferFilePath(bufferFilePath);
  const tempPath = `${targetPath}.tmp`;
  const payload = {
    data,
    updatedAt: Date.now(),
  };

  try {
    await fs.promises.writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
    await fs.promises.rename(tempPath, targetPath);
  } catch (error) {
    console.error('Error writing buffer file:', error.message);
  }
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
