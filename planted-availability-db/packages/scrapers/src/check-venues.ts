#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../../..');
config({ path: resolve(rootDir, '.env') });

if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.startsWith('./')) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = resolve(
    rootDir,
    process.env.GOOGLE_APPLICATION_CREDENTIALS.slice(2)
  );
}

import { initializeFirestore, discoveredVenues } from '@pad/database';
initializeFirestore();

async function main() {
  const venues = await discoveredVenues.getByStatus('discovered');
  const sample = venues.slice(0, 5);

  for (const v of sample) {
    console.log('---');
    console.log('Name:', v.name);
    console.log('Platforms:', JSON.stringify(v.delivery_platforms, null, 2));
    console.log('City:', v.address.city);
  }
}

main();
