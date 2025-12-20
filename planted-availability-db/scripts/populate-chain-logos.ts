/**
 * Script to populate Chain.logo_url in Firestore
 * Usage: tsx scripts/populate-chain-logos.ts [--dry-run]
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

interface ChainLogoUpdate {
  id: string;
  name: string;
  logo_url: string;
  source: string;
  notes: string;
}

async function populateChainLogos() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('🔧 Chain Logo Population Script');
  console.log('='.repeat(80));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'EXECUTE'}\n`);

  // Initialize Firebase with service account
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(__dirname, '..', 'service-account.json');

  try {
    initializeApp({
      credential: cert(serviceAccountPath),
      projectId: 'get-planted-db',
    });
  } catch (e) {
    // App might already be initialized
  }

  const db = getFirestore();

  // Load curated logo data
  const curatedDataPath = path.join(__dirname, 'chain-logos-curated.json');

  if (!fs.existsSync(curatedDataPath)) {
    throw new Error('Curated logo data file not found at: ' + curatedDataPath);
  }

  const chainLogoUpdates: ChainLogoUpdate[] = JSON.parse(
    fs.readFileSync(curatedDataPath, 'utf-8')
  );

  console.log(`📋 Loaded ${chainLogoUpdates.length} chain logo updates from curated data\n`);

  // Statistics
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let alreadyHasLogo = 0;
  let noLogoProvided = 0;

  for (const update of chainLogoUpdates) {
    try {
      // Skip if no logo URL provided
      if (!update.logo_url || update.logo_url.trim() === '') {
        console.log(`⏭️  Skipping ${update.name} - no logo URL provided`);
        noLogoProvided++;
        continue;
      }

      // Skip if it's already using a local path (already configured)
      if (update.logo_url.startsWith('/images/')) {
        console.log(`✅ ${update.name} - already has logo configured (${update.logo_url})`);
        alreadyHasLogo++;
        continue;
      }

      // Get current chain document
      const chainRef = db.collection('chains').doc(update.id);
      const chainDoc = await chainRef.get();

      if (!chainDoc.exists) {
        console.log(`❌ Chain ${update.id} (${update.name}) not found in Firestore`);
        errors++;
        continue;
      }

      const currentData = chainDoc.data();

      // Check if logo_url is already set and is the same
      if (currentData?.logo_url === update.logo_url) {
        console.log(`⏭️  ${update.name} - logo already up to date`);
        skipped++;
        continue;
      }

      // Update the chain document
      if (dryRun) {
        console.log(`🔍 [DRY RUN] Would update ${update.name}:`);
        console.log(`   Current logo_url: ${currentData?.logo_url || 'Not set'}`);
        console.log(`   New logo_url: ${update.logo_url}`);
        console.log(`   Source: ${update.source}`);
      } else {
        await chainRef.update({
          logo_url: update.logo_url,
        });
        console.log(`✅ Updated ${update.name} with logo: ${update.logo_url}`);
      }

      updated++;
    } catch (error) {
      console.error(`❌ Error processing ${update.name}:`, error);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 Summary:');
  console.log(`   Total processed: ${chainLogoUpdates.length}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Already configured: ${alreadyHasLogo}`);
  console.log(`   Already up to date: ${skipped}`);
  console.log(`   No logo provided: ${noLogoProvided}`);
  console.log(`   Errors: ${errors}`);
  console.log('='.repeat(80));

  if (dryRun) {
    console.log('\n💡 This was a dry run. Run without --dry-run to apply changes.');
  } else {
    console.log('\n✅ Chain logo population complete!');
  }
}

// Run the script
populateChainLogos()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
