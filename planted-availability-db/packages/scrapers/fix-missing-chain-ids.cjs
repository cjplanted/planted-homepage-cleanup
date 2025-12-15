#!/usr/bin/env node
/**
 * Fix Missing Chain IDs
 * Assigns chain_ids to venues that should belong to chains but don't have one set
 *
 * Usage:
 *   node fix-missing-chain-ids.cjs          # Dry run
 *   node fix-missing-chain-ids.cjs --execute  # Actually fix
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', '..', 'service-account.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const EXECUTE = process.argv.includes('--execute');

// Chain name patterns to chain IDs
// These patterns will match venue names to assign them a chain_id
const CHAIN_PATTERNS = [
  { pattern: /^kaisin\.?/i, chainId: 'kaisin', chainName: 'kaisin.' },
  { pattern: /^rice up!?/i, chainId: 'RinkvVQc9uTH7z71ga88', chainName: 'Rice Up!' },
  { pattern: /^dean\s*&\s*david/i, chainId: 'dean-david', chainName: 'dean&david' },
  { pattern: /^burgermeister/i, chainId: 'cgZfuNjKT2xg1ghEqJhU', chainName: 'Burgermeister' },
  { pattern: /^hiltl/i, chainId: 'hiltl', chainName: 'Hiltl' },
  { pattern: /^nooch asian kitchen/i, chainId: 'nooch', chainName: 'Nooch Asian Kitchen' },
  { pattern: /^tuktuk/i, chainId: 'tuktuk', chainName: 'TukTuk Thai Kitchen' },
  { pattern: /^brezelkönig/i, chainId: 'brezelkoenig', chainName: 'Brezelkönig' },
  { pattern: /^union diner/i, chainId: 'union-diner', chainName: 'Union Diner' },
  { pattern: /^smash bro.*burger/i, chainId: 'smash-bros', chainName: "Smash Bro's Burger" },
  { pattern: /^veganitas/i, chainId: 'veganitas', chainName: 'Veganitas' },
  { pattern: /^zeki/i, chainId: 'zekis-world', chainName: 'Zekis World' },
  { pattern: /^choi asian garden/i, chainId: 'choi', chainName: 'CHOI Asian Garden' },
  { pattern: /^subway/i, chainId: 'subway', chainName: 'Subway' },
];

async function fixMissingChainIds() {
  console.log('\n=== FIX MISSING CHAIN IDS ===\n');
  console.log(`Mode: ${EXECUTE ? '🔥 EXECUTE' : '🔍 DRY RUN'}\n`);

  // Query all venues without chain_id
  const venuesSnap = await db.collection('venues')
    .where('status', '==', 'active')
    .get();

  const venues = venuesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Find venues that match chain patterns but don't have chain_id
  const needsFix = [];

  for (const venue of venues) {
    // Skip if already has chain_id
    if (venue.chain_id) continue;

    // Check if name matches any chain pattern
    for (const { pattern, chainId, chainName } of CHAIN_PATTERNS) {
      if (pattern.test(venue.name)) {
        needsFix.push({
          venue,
          chainId,
          chainName
        });
        break;
      }
    }
  }

  console.log(`Found ${needsFix.length} venues that need chain_id assignment:\n`);

  // Group by chain for display
  const byChain = {};
  needsFix.forEach(({ venue, chainId, chainName }) => {
    if (!byChain[chainName]) byChain[chainName] = [];
    byChain[chainName].push(venue);
  });

  for (const [chainName, chainVenues] of Object.entries(byChain)) {
    console.log(`\n${chainName} (${chainVenues.length} venues):`);
    for (const v of chainVenues) {
      console.log(`  - ${v.name} (${v.address?.city || 'Unknown'}) [${v.id}]`);
    }
  }

  if (needsFix.length === 0) {
    console.log('No venues need fixing!');
    return;
  }

  if (EXECUTE) {
    console.log('\n\nApplying fixes...\n');
    let fixed = 0;

    for (const { venue, chainId } of needsFix) {
      await db.collection('venues').doc(venue.id).update({
        chain_id: chainId
      });
      console.log(`  ✓ Fixed ${venue.name}`);
      fixed++;
    }

    console.log(`\n✓ Fixed ${fixed} venues`);
  } else {
    console.log('\n\n💡 Run with --execute to apply fixes');
  }
}

fixMissingChainIds()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
