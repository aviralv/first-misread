import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';

function loadDir(dir) {
  let files;
  try {
    files = readdirSync(dir).filter(f => f.endsWith('.yaml')).sort();
  } catch {
    return [];
  }
  return files.map(f => parse(readFileSync(join(dir, f), 'utf8')));
}

export function loadPersonasFromYaml(personasDir) {
  const core = loadDir(join(personasDir, 'core'));
  const dynamic = loadDir(join(personasDir, 'dynamic'));
  return { core, dynamic };
}
