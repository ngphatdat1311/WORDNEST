import fs from 'fs';
import path from 'path';

const root = process.cwd();
const standaloneDir = path.join(root, '.next', 'standalone');
const staticSrc = path.join(root, '.next', 'static');
const staticDst = path.join(standaloneDir, '.next', 'static');
const publicSrc = path.join(root, 'public');
const publicDst = path.join(standaloneDir, 'public');

if (!fs.existsSync(standaloneDir)) {
  console.error('Error: .next/standalone not found. Run "npm run build" first.');
  process.exit(1);
}

if (fs.existsSync(staticSrc)) {
  fs.cpSync(staticSrc, staticDst, { recursive: true, force: true });
}

if (fs.existsSync(publicSrc)) {
  fs.cpSync(publicSrc, publicDst, { recursive: true, force: true });
}

console.log('Prepared .next/standalone with static assets and public/ for Electron.');
