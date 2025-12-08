#!/usr/bin/env node
/**
 * Prepares the functions package for Firebase deployment by:
 * 1. Creating a lib/ directory with pre-built workspace packages
 * 2. Adding a postinstall script to copy packages to node_modules
 * 3. Ensuring all dependencies are properly declared
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const apiDir = path.join(rootDir, 'packages', 'api');
const apiLib = path.join(apiDir, 'lib'); // Pre-built packages directory
const apiNodeModules = path.join(apiDir, 'node_modules');
const rootNodeModules = path.join(rootDir, 'node_modules');
const pnpmDir = path.join(rootNodeModules, '.pnpm');

// Workspace packages to copy
const workspacePackages = ['core', 'database'];

// Ensure lib/@pad exists (this survives npm install)
const libPadDir = path.join(apiLib, '@pad');
if (!fs.existsSync(libPadDir)) {
  fs.mkdirSync(libPadDir, { recursive: true });
}

// Also ensure node_modules/@pad exists for local development
const nmPadDir = path.join(apiNodeModules, '@pad');
if (!fs.existsSync(nmPadDir)) {
  fs.mkdirSync(nmPadDir, { recursive: true });
}

// Collect dependencies from workspace packages
const additionalDeps = {};

// Copy each workspace package to both lib/ and node_modules/
for (const pkg of workspacePackages) {
  const srcDir = path.join(rootDir, 'packages', pkg);

  // Copy to lib/@pad/
  const libDestDir = path.join(libPadDir, pkg);
  if (fs.existsSync(libDestDir)) {
    fs.rmSync(libDestDir, { recursive: true });
  }
  fs.mkdirSync(libDestDir, { recursive: true });

  // Copy to node_modules/@pad/ for local development
  const nmDestDir = path.join(nmPadDir, pkg);
  if (fs.existsSync(nmDestDir)) {
    fs.rmSync(nmDestDir, { recursive: true });
  }
  fs.mkdirSync(nmDestDir, { recursive: true });

  // Copy package.json and collect non-workspace dependencies
  const pkgJson = JSON.parse(fs.readFileSync(path.join(srcDir, 'package.json'), 'utf8'));

  if (pkgJson.dependencies) {
    for (const [dep, version] of Object.entries(pkgJson.dependencies)) {
      if (version.startsWith('workspace:')) {
        // Remove workspace dependencies
        delete pkgJson.dependencies[dep];
      } else {
        // Collect external dependencies
        additionalDeps[dep] = version;
      }
    }
  }

  fs.writeFileSync(path.join(libDestDir, 'package.json'), JSON.stringify(pkgJson, null, 2));
  fs.writeFileSync(path.join(nmDestDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

  // Copy dist folder
  const srcDist = path.join(srcDir, 'dist');
  if (fs.existsSync(srcDist)) {
    copyDirSync(srcDist, path.join(libDestDir, 'dist'));
    copyDirSync(srcDist, path.join(nmDestDir, 'dist'));
  }
}

// Copy zod to lib/ and node_modules/
const zodSrc = findPnpmPackage('zod');
if (zodSrc) {
  const libZodDest = path.join(apiLib, 'zod');
  const nmZodDest = path.join(apiNodeModules, 'zod');

  if (fs.existsSync(libZodDest)) {
    fs.rmSync(libZodDest, { recursive: true });
  }
  copyDirSync(zodSrc, libZodDest);

  if (!fs.existsSync(nmZodDest)) {
    copyDirSync(zodSrc, nmZodDest);
  }
  console.log('Copied zod to lib/ and node_modules/');
}

// Create postinstall script that copies packages from lib/ to node_modules/
const postinstallScript = `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const libDir = path.join(__dirname, '..', 'lib');
const nodeModulesDir = path.join(__dirname, '..', 'node_modules');

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy @pad packages
const libPad = path.join(libDir, '@pad');
const nmPad = path.join(nodeModulesDir, '@pad');
if (fs.existsSync(libPad)) {
  if (!fs.existsSync(nmPad)) {
    fs.mkdirSync(nmPad, { recursive: true });
  }
  for (const pkg of fs.readdirSync(libPad)) {
    const src = path.join(libPad, pkg);
    const dest = path.join(nmPad, pkg);
    if (!fs.existsSync(dest)) {
      copyDirSync(src, dest);
    }
  }
}

// Copy zod
const libZod = path.join(libDir, 'zod');
const nmZod = path.join(nodeModulesDir, 'zod');
if (fs.existsSync(libZod) && !fs.existsSync(nmZod)) {
  copyDirSync(libZod, nmZod);
}

console.log('Postinstall: copied bundled packages to node_modules');
`;

// Ensure scripts directory exists
const scriptsDir = path.join(apiDir, 'scripts');
if (!fs.existsSync(scriptsDir)) {
  fs.mkdirSync(scriptsDir, { recursive: true });
}
fs.writeFileSync(path.join(scriptsDir, 'postinstall.cjs'), postinstallScript);

// Update API's package.json
const apiPkgPath = path.join(apiDir, 'package.json');
const apiPkg = JSON.parse(fs.readFileSync(apiPkgPath, 'utf8'));

// Save original for restoration
const backupPath = path.join(apiDir, 'package.json.backup');
fs.writeFileSync(backupPath, JSON.stringify(apiPkg, null, 2));

// Remove workspace dependencies
delete apiPkg.dependencies['@pad/core'];
delete apiPkg.dependencies['@pad/database'];

// Add external dependencies from workspace packages
for (const [dep, version] of Object.entries(additionalDeps)) {
  if (!apiPkg.dependencies[dep]) {
    apiPkg.dependencies[dep] = version;
  }
}

// Add postinstall script
apiPkg.scripts = apiPkg.scripts || {};
apiPkg.scripts.postinstall = 'node scripts/postinstall.cjs';

fs.writeFileSync(apiPkgPath, JSON.stringify(apiPkg, null, 2));

console.log('Functions prepared for deployment');
console.log('Created lib/ directory with pre-built packages');
console.log('Added postinstall script to copy packages after npm install');
console.log('Added dependencies:', Object.keys(additionalDeps).join(', '));
console.log('Original package.json backed up to:', backupPath);

/**
 * Find a package in pnpm's .pnpm directory
 */
function findPnpmPackage(packageName) {
  if (!fs.existsSync(pnpmDir)) {
    const regularPath = path.join(rootNodeModules, packageName);
    return fs.existsSync(regularPath) ? regularPath : null;
  }

  const entries = fs.readdirSync(pnpmDir);
  const matchingEntries = entries.filter(e => e.startsWith(packageName + '@'));

  if (matchingEntries.length === 0) {
    return null;
  }

  matchingEntries.sort((a, b) => b.localeCompare(a));
  const pnpmPackagePath = path.join(pnpmDir, matchingEntries[0], 'node_modules', packageName);
  return fs.existsSync(pnpmPackagePath) ? pnpmPackagePath : null;
}

/**
 * Copy directory recursively
 */
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
