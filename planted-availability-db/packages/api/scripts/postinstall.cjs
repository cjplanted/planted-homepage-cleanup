#!/usr/bin/env node
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
