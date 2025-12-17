#!/usr/bin/env node
/**
 * Copy dishes from discovered_venues to venues collection
 *
 * This script:
 * 1. Finds discovered venues with dishes
 * 2. Copies those dishes to the dishes collection with appropriate venue_ids
 * 3. Targets: Barburrito, Mit&Ohne, Vapiano, Hiltl, Veganitas
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

// Chain mappings: source discovered_venue ID -> target venue IDs
const CHAIN_MAPPINGS = {
  // Barburrito - source has 3 dishes
  barburrito: {
    sourceId: 'oSzz3yB3IMc6PvFMLWVH', // Barburrito - Cardiff (discovered_venues)
    targetIds: [
      'planted-a2Pc40000001U2xEAE', // Edinburgh Airport
      'planted-a2Pc40000001U2yEAE', // Edinburgh Forrest Road
      'planted-a2Pc40000001U2zEAE', // Glasgow Queen Street
      'planted-a2Pc40000001U30EAE', // Liverpool
      'planted-a2Pc40000001U31EAE', // Paddington Station
      'planted-a2Pc40000001U32EAE', // Manchester Airport T2
      'planted-a2Pc40000001U33EAE', // Manchester Arndale
      'planted-a2Pc40000001U34EAE', // Manchester Piccadilly Gardens
      'planted-a2Pc40000001U35EAE', // Trafford Centre
      'planted-a2Pc40000001U36EAE', // Nottingham
      'planted-a2Pc40000001U37EAE', // Sheffield Meadowhall
      'planted-a2Pc40000001U38EAE', // Cardiff
    ]
  },
  // Vapiano - source has 2 dishes
  vapiano: {
    sourceId: 'cJJSREy1R4tpkrFgIgwD', // Vapiano (Great Portland Street) in discovered_venues
    targetIds: [
      '8o1ECtPGofSFEXNd8E8w',  // Vapiano (Tower Bridge) - London
      'Mn1N8M63ZJsEit7sF4S8',  // Vapiano - Great Portland Street - London
      'Ov5TQlxY5sA2ZRAW6Xo0',  // Vapiano - Paddington - London
      'dtT35nOw3VU2i42oqbn9',  // Vapiano (Manchester)
      'xb0kmQ1JAVjCli0MYERm',  // Vapiano - Vienna
    ]
  },
  // Mit&Ohne - source has 5 dishes
  mitohne: {
    sourceId: 'yuZVWAQrEcOjx2QUtx6n', // mit&ohne kebab - Lochergut (discovered_venues)
    targetIds: [
      'Bd7JDajYNhnStKetUtnX',  // Mit&Ohne - HB Zürich
    ]
  }
};

// Venues with existing dishes that need to be copied to duplicates
const DUPLICATE_COPIES = {
  // Hiltl duplicate
  hiltl: {
    sourceVenueId: null, // Will find by name
    sourceName: 'Hiltl - Vegetarian Restaurant',
    targetIds: ['LY5AnA6UvnABI9l5vdA9'] // Hiltl (Zurich)
  },
  // Veganitas duplicate
  veganitas: {
    sourceVenueId: null,
    sourceName: 'Veganitas (Zürich)',
    targetIds: ['WKimrXBtirjfyzKSiwl7'] // Veganitas (Zurich)
  }
};

async function copyDiscoveredToVenues(dryRun = true) {
  console.log(`Copy Dishes Script (${dryRun ? 'DRY RUN' : 'EXECUTE MODE'})`);
  console.log('='.repeat(70));

  let totalDishesCreated = 0;
  let totalVenuesUpdated = 0;

  // Part 1: Copy from discovered_venues
  console.log('\n=== COPYING FROM DISCOVERED_VENUES ===\n');

  for (const [chainName, config] of Object.entries(CHAIN_MAPPINGS)) {
    console.log(`\n--- ${chainName.toUpperCase()} ---`);

    // Get source dishes from discovered_venues
    const sourceDoc = await db.collection('discovered_venues').doc(config.sourceId).get();
    if (!sourceDoc.exists) {
      console.log(`  ERROR: Source venue ${config.sourceId} not found`);
      continue;
    }

    const sourceData = sourceDoc.data();
    const sourceDishes = sourceData.dishes || [];

    console.log(`  Source: ${sourceData.name} (${sourceDishes.length} dishes)`);

    if (sourceDishes.length === 0) {
      console.log(`  SKIP: No dishes to copy`);
      continue;
    }

    // Copy to each target venue
    for (const targetId of config.targetIds) {
      const targetDoc = await db.collection('venues').doc(targetId).get();
      if (!targetDoc.exists) {
        console.log(`  ERROR: Target venue ${targetId} not found`);
        continue;
      }

      const targetData = targetDoc.data();

      // Check if target already has dishes
      const existingDishes = await db.collection('dishes')
        .where('venue_id', '==', targetId)
        .get();

      if (existingDishes.size > 0) {
        console.log(`  SKIP: ${targetData.name} already has ${existingDishes.size} dishes`);
        continue;
      }

      console.log(`  Target: ${targetData.name} (${targetData.address?.city})`);

      // Create dishes for this venue
      for (const dish of sourceDishes) {
        const newDish = {
          venue_id: targetId,
          name: dish.name || dish.dish_name,
          description: dish.description || '',
          price: dish.price || { amount: 0, currency: 'GBP' },
          planted_products: dish.planted_products || ['planted.chicken'],
          dietary_tags: dish.dietary_tags || ['vegan'],
          status: 'active',
          availability: dish.availability || 'permanent',
          created_at: new Date(),
          updated_at: new Date()
        };

        if (dryRun) {
          console.log(`    [DRY RUN] Would create: ${newDish.name}`);
        } else {
          const docRef = await db.collection('dishes').add(newDish);
          console.log(`    Created: ${newDish.name} (${docRef.id})`);
        }

        totalDishesCreated++;
      }

      totalVenuesUpdated++;
    }
  }

  // Part 2: Copy from venues (duplicates)
  console.log('\n\n=== COPYING BETWEEN VENUES (DUPLICATES) ===\n');

  for (const [chainName, config] of Object.entries(DUPLICATE_COPIES)) {
    console.log(`\n--- ${chainName.toUpperCase()} ---`);

    // Find source venue by name
    const venuesSnap = await db.collection('venues').get();
    let sourceVenueId = null;

    for (const doc of venuesSnap.docs) {
      if (doc.data().name === config.sourceName) {
        sourceVenueId = doc.id;
        break;
      }
    }

    if (!sourceVenueId) {
      console.log(`  ERROR: Could not find source venue: ${config.sourceName}`);
      continue;
    }

    // Get source dishes
    const sourceDishes = await db.collection('dishes')
      .where('venue_id', '==', sourceVenueId)
      .get();

    console.log(`  Source: ${config.sourceName} (${sourceDishes.size} dishes)`);

    if (sourceDishes.size === 0) {
      console.log(`  SKIP: No dishes to copy`);
      continue;
    }

    // Copy to each target
    for (const targetId of config.targetIds) {
      const targetDoc = await db.collection('venues').doc(targetId).get();
      if (!targetDoc.exists) {
        console.log(`  ERROR: Target venue ${targetId} not found`);
        continue;
      }

      const targetData = targetDoc.data();

      // Check if target already has dishes
      const existingDishes = await db.collection('dishes')
        .where('venue_id', '==', targetId)
        .get();

      if (existingDishes.size > 0) {
        console.log(`  SKIP: ${targetData.name} already has ${existingDishes.size} dishes`);
        continue;
      }

      console.log(`  Target: ${targetData.name} (${targetData.address?.city})`);

      // Copy dishes
      for (const sourceDoc of sourceDishes.docs) {
        const sourceData = sourceDoc.data();

        const newDish = {
          ...sourceData,
          venue_id: targetId,
          created_at: new Date(),
          updated_at: new Date()
        };

        delete newDish.id; // Remove old ID

        if (dryRun) {
          console.log(`    [DRY RUN] Would create: ${newDish.name}`);
        } else {
          const docRef = await db.collection('dishes').add(newDish);
          console.log(`    Created: ${newDish.name} (${docRef.id})`);
        }

        totalDishesCreated++;
      }

      totalVenuesUpdated++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Venues updated: ${totalVenuesUpdated}`);
  console.log(`Dishes created: ${totalDishesCreated}`);

  if (dryRun) {
    console.log('\nThis was a DRY RUN. Run with --execute to apply changes.');
  }
}

const execute = process.argv.includes('--execute');
copyDiscoveredToVenues(!execute)
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
