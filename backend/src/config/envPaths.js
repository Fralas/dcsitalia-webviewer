import path from 'path';

export function optionalPath(envName) {
  const value = String(process.env[envName] || '').trim();
  return value ? path.resolve(value) : null;
}
