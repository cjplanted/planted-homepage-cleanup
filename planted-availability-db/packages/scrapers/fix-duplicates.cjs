/**
 * Fix Duplicate Venues
 *
 * Safely delete production venues with 0 dishes that are clear duplicates.
 *
 * Usage:
 *   node fix-duplicates.cjs                    # Dry run - show what would be deleted
 *   node fix-duplicates.cjs --execute          # Actually delete
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

// Define clear duplicate pairs: [toDelete (0 dishes), primary (has dishes)]
const CLEAR_DUPLICATES = [
  // dean&david
  { delete: 'YJGxUkQ8dqA9Gf7ECy2l', primary: 'nvNIawnFkxCU9Jjhh9Kz', reason: 'dean&david Basel Centralbahnplatz duplicate (0 vs 13 dishes)' },
  { delete: '27bEiDVALQQE2A8oZMmO', primary: 'jPOIPDjSdw0O0K1rFv1N', reason: 'dean&david (Hirschengraben) Bern duplicate (0 vs 3 dishes)' },
  { delete: 'lRaMnnk8McbHJDTtTNzr', primary: '11A5GdRpDPQX6yIIoTlX', reason: 'dean&david Berlin Bülowstraße duplicate (0 vs 4 dishes)' },
  { delete: 'B7LqEnoJKw91iTGW6pfV', primary: '1pf5c3fCYVPqBnYywoRK', reason: 'dean&david München Pasinger Bahnhof duplicate (0 vs 5 dishes)' },
  { delete: 'YxyQS1SBE6FqyzXGRQwi', primary: 'P2EQ4vkfHMoLYga2vjD8', reason: 'dean&david München Orleansplatz duplicate (0 vs 3 dishes)' },
  { delete: 'rnCEVwzdUqNx5fdUIkS7', primary: 'g8UbXqyMLYa4KSnsDZwq', reason: 'dean&david München Parkstadt duplicate (0 vs 3 dishes)' },
  { delete: 'sKOHFldYyanZmJllbUrZ', primary: 'owJT10kiJoT9XJn9G7sV', reason: 'dean&david München Leopoldstr duplicate (0 vs 5 dishes)' },
  { delete: 'mtCGkpGEHFDsL7eRrxsD', primary: 'c74C0zDD27bzUmjB2R51', reason: 'dean&david München Werksviertel duplicate (0 vs 5 dishes)' },
  { delete: 'CjCQRAHLfm5QkCt8ZLcH', primary: 'lJ6zEvFpfwtjSL1T1ZdW', reason: 'dean&david München 5 Höfe duplicate (0 vs 5 dishes)' },
  { delete: 'FwcPvgn5UDliDqjOsVVM', primary: 'SodzG6vHUv7BxdNgMFU1', reason: 'dean&david München Bahnhofplatz duplicate (0 vs 4 dishes)' },
  { delete: 'U0KFXdBtnGNK92HvM379', primary: 'fJhIMIptUIAOzBZYqvDI', reason: 'dean&david Georgsplatz duplicate (0 vs 3 dishes)' },

  // KAIMUG
  { delete: '3D5POGbXfe60Re9uCT2w', primary: '3OnKGnneXCY9MIRL2lxx', reason: 'KAIMUG Zürich duplicate (0 vs 1 dish)' },
];

async function fixDuplicates(execute) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(execute ? '🚀 EXECUTING DUPLICATE FIX' : '🔍 DRY RUN - No changes will be made');
  console.log(`${'='.repeat(60)}\n`);

  let deleted = 0;
  let skipped = 0;
  let errors = 0;

  for (const dup of CLEAR_DUPLICATES) {
    console.log(`\n📍 ${dup.reason}`);

    // Verify the venue to delete exists and has 0 dishes
    const toDeleteDoc = await db.collection('venues').doc(dup.delete).get();
    if (!toDeleteDoc.exists) {
      console.log(`   ⚠️ Venue ${dup.delete} not found - already deleted?`);
      skipped++;
      continue;
    }

    const toDeleteData = toDeleteDoc.data();
    console.log(`   To delete: ${toDeleteData.name} [${dup.delete}]`);

    // Count dishes for safety
    const dishCount = await db.collection('dishes')
      .where('venue_id', '==', dup.delete)
      .count()
      .get();

    const count = dishCount.data().count;
    if (count > 0) {
      console.log(`   ❌ SKIPPING - venue has ${count} dishes! Would lose data.`);
      errors++;
      continue;
    }

    // Verify primary exists
    const primaryDoc = await db.collection('venues').doc(dup.primary).get();
    if (!primaryDoc.exists) {
      console.log(`   ❌ SKIPPING - primary venue ${dup.primary} not found!`);
      errors++;
      continue;
    }

    const primaryData = primaryDoc.data();
    const primaryDishCount = await db.collection('dishes')
      .where('venue_id', '==', dup.primary)
      .count()
      .get();

    console.log(`   Primary: ${primaryData.name} [${dup.primary}] (${primaryDishCount.data().count} dishes)`);

    if (execute) {
      await db.collection('venues').doc(dup.delete).delete();
      console.log(`   ✅ Deleted`);
      deleted++;
    } else {
      console.log(`   📝 Would delete`);
      deleted++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`${execute ? 'Deleted' : 'Would delete'}: ${deleted}`);
  console.log(`Skipped (already done): ${skipped}`);
  console.log(`Errors (would lose data): ${errors}`);
}

const execute = process.argv.includes('--execute');
fixDuplicates(execute)
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
