#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = 'https://github.com/lucide-icons/lucide.git';
const tempDir = path.join(process.cwd(), '.lucide-mendix-tmp');

try {
  console.log('Cloning lucide (sparse, depth=1)...');
  execSync(`git clone --sparse --depth=1 ${REPO} "${tempDir}"`, { stdio: 'inherit' });
  execSync(`git -C "${tempDir}" sparse-checkout set lucide-font icons`, { stdio: 'inherit' });

  console.log('\nGenerating lucide-mendix-import.txt...');
  const info = JSON.parse(fs.readFileSync(path.join(tempDir, 'lucide-font', 'info.json'), 'utf8'));
  const iconsDir = path.join(tempDir, 'icons');
  const lines = [];

  for (const file of fs.readdirSync(iconsDir).filter(f => f.endsWith('.json'))) {
    const name = path.basename(file, '.json');
    const entry = info[name];
    if (!entry) continue;
    const hexCode = entry.encodedCode.replace('\\', '');
    const meta = JSON.parse(fs.readFileSync(path.join(iconsDir, file), 'utf8'));
    const tags = (meta.tags || []).join(' ');
    lines.push(`${hexCode};${name};${tags}`);
  }

  lines.sort((a, b) => a.split(';')[1].localeCompare(b.split(';')[1]));
  fs.writeFileSync('lucide-mendix-import.txt', lines.join('\n'), 'utf8');
  console.log(`Written ${lines.length} icons to lucide-mendix-import.txt`);

  console.log('Copying lucide.ttf...');
  fs.copyFileSync(path.join(tempDir, 'lucide-font', 'lucide.ttf'), 'lucide.ttf');
  console.log('Copied lucide.ttf');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('Cleaned up temp files.');
}

console.log('\nDone! Files ready in current directory:');
console.log('  lucide.ttf');
console.log('  lucide-mendix-import.txt');
