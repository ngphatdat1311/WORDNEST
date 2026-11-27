const fs = require('fs');
const path = require('path');

/**
 * electron-builder intentionally strips `node_modules` inside `extraResources`.
 * Next.js `output: 'standalone'` REQUIRES `.next/standalone/node_modules` next to `server.js`,
 * otherwise the packaged Desktop App crashes on startup with `Cannot find module 'next'`.
 *
 * This afterPack hook copies `.next/standalone/node_modules` into the exact platform resources
 * directory on Windows, macOS (x64/arm64/universal), and Linux, and asserts `next` is present.
 */
exports.default = async function afterPack(context) {
  const projectDir = context.packager.projectDir;
  const srcNodeModules = path.join(projectDir, '.next', 'standalone', 'node_modules');

  if (!fs.existsSync(srcNodeModules)) {
    throw new Error(
      `[afterPack] Missing ${srcNodeModules}. Run "npm run build:electron" before electron-builder.`
    );
  }

  let resourcesDir;
  if (context.electronPlatformName === 'darwin') {
    const appName = `${context.packager.appInfo.productFilename}.app`;
    resourcesDir = path.join(context.appOutDir, appName, 'Contents', 'Resources');
  } else {
    resourcesDir = path.join(context.appOutDir, 'resources');
  }

  const standaloneDir = path.join(resourcesDir, 'standalone');
  const dstNodeModules = path.join(standaloneDir, 'node_modules');

  if (!fs.existsSync(standaloneDir)) {
    throw new Error(`[afterPack] Expected standalone directory at ${standaloneDir}`);
  }

  // Ensure no accidental local .env secrets ever end up in packaged resources
  for (const name of fs.readdirSync(standaloneDir)) {
    if (name.startsWith('.env')) {
      fs.rmSync(path.join(standaloneDir, name), { force: true });
    }
  }

  fs.cpSync(srcNodeModules, dstNodeModules, {
    recursive: true,
    force: true,
    dereference: true,
  });

  // Hard verification gate so CI can NEVER publish an unbootable installer again
  const nextPkg = path.join(dstNodeModules, 'next', 'package.json');
  const requiredFiles = path.join(standaloneDir, '.next', 'required-server-files.json');
  if (!fs.existsSync(nextPkg)) {
    throw new Error(`[afterPack] Verification failed: ${nextPkg} not found!`);
  }
  if (!fs.existsSync(requiredFiles)) {
    throw new Error(`[afterPack] Verification failed: ${requiredFiles} not found!`);
  }

  console.log(
    `[afterPack] Verified standalone runtime (${context.electronPlatformName}/${context.arch}): ${dstNodeModules}`
  );
};
