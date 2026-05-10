#!/usr/bin/env node
const { execSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const REPO = 'https://github.com/lucide-icons/lucide.git';
const API_URL = 'https://api.github.com/repos/lucide-icons/lucide/releases/latest';
const tempDir = path.join(process.cwd(), '.lucide-mendix-tmp-' + Date.now());

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'lucide-mendix' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        resolve(httpsGet(res.headers.location));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(tempDir, { recursive: true });
  let version;
  try {
    // Fetch latest release metadata
    console.log('Fetching latest lucide release...');
    const release = JSON.parse((await httpsGet(API_URL)).toString('utf8'));
    version = release.tag_name;
    const fontAsset = release.assets.find(a => a.name === `lucide-font-${version}.zip`);
    if (!fontAsset) throw new Error(`Font zip not found in release ${version} assets`);
    console.log(`Version: ${version}`);

    // Download and parse font zip (contains info.json + lucide.ttf)
    console.log('Downloading lucide-font zip...');
    const zipBuf = await httpsGet(fontAsset.browser_download_url);
    const zip = new AdmZip(zipBuf);
    const info = JSON.parse(zip.readAsText('lucide-font/info.json'));
    const ttfBuf = zip.readFile('lucide-font/lucide.ttf');
    if (!ttfBuf) throw new Error('lucide.ttf not found in font zip');

    // Sparse-clone just the icons directory for tags
    console.log('Cloning lucide icons (sparse, depth=1)...');
    const repoDir = path.join(tempDir, 'repo');
    execSync(`git clone --sparse --depth=1 ${REPO} "${repoDir}"`, { stdio: 'inherit' });
    execSync(`git -C "${repoDir}" sparse-checkout set icons`, { stdio: 'inherit' });

    // Create version output directory
    const outDir = path.join(process.cwd(), `lucide-${version}`);
    fs.mkdirSync(outDir, { recursive: true });

    // Generate import file
    console.log('\nGenerating lucide-mendix-import.txt...');
    const iconsDir = path.join(repoDir, 'icons');
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
    const importFile = path.join(outDir, 'lucide-mendix-import.txt');
    fs.writeFileSync(importFile, lines.join('\n'), 'utf8');
    console.log(`Written ${lines.length} icons to ${importFile}`);

    // Write TTF
    console.log('Writing lucide.ttf...');
    const ttfFile = path.join(outDir, 'lucide.ttf');
    fs.writeFileSync(ttfFile, ttfBuf);
    console.log(`Written ${ttfFile}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log('Cleaned up temp files.');
  }

  console.log(`\nDone! Files ready in ./lucide-${version}/`);
  console.log(`  lucide-${version}/lucide.ttf`);
  console.log(`  lucide-${version}/lucide-mendix-import.txt`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error('\nError:', err.message);
  process.exit(1);
});
