import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read package.json to get external dependencies
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const external = [
  ...Object.keys(pkg.dependencies || {}),
  // Firebase/Google Cloud packages should always be external
  'firebase-functions',
  'firebase-admin',
];

await esbuild.build({
  entryPoints: ['./src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: './dist/index.js',
  external: external.filter(dep => !dep.startsWith('@pad/')), // Bundle @pad/* packages
  sourcemap: true,
  minify: false, // Keep readable for debugging
  // Handle workspace package imports - use absolute paths
  alias: {
    '@pad/core': resolve(__dirname, '../core/src/index.ts'),
    '@pad/database': resolve(__dirname, '../database/src/index.ts'),
  },
});

console.log('Build complete!');
