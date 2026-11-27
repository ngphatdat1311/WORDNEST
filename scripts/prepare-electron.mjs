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

// WordNest uses `images: { unoptimized: true }`, so native sharp/@img binaries
// are never needed at runtime and break macOS Universal (`@electron/universal`) merges.
for (const unusedPkg of ['@img', 'sharp']) {
  const pkgPath = path.join(standaloneDir, 'node_modules', unusedPkg);
  if (fs.existsSync(pkgPath)) {
    fs.rmSync(pkgPath, { recursive: true, force: true });
  }
}

console.log('Prepared .next/standalone with static assets and public/ for Electron.');
