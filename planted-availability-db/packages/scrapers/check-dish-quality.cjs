#!/usr/bin/env node
/**
 * Dish Data Quality Checker
 *
 * Analyzes all dishes in the 'dishes' collection and identifies data quality issues:
 * - Missing required fields (name, venue_id, status)
 * - Invalid prices (negative, zero, missing currency)
 * - Missing planted_products array
 * - Empty descriptions
 * - Invalid status values
 * - Orphaned dishes (venue_id pointing to non-existent venue)
 *
 * Usage:
 *   node check-dish-quality.cjs                    # Check all dishes
 *   node check-dish-quality.cjs --fix              # Fix critical issues
 *   node check-dish-quality.cjs --venue-id=ABC123  # Check specific venue's dishes
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

// Valid status values from schema
const VALID_STATUSES = ['active', 'inactive', 'deleted', 'pending'];

// Valid currency codes (ISO 4217 - common ones)
const VALID_CURRENCIES = ['CHF', 'EUR', 'GBP', 'USD'];

// Track issues by category
const issues = {
  missingName: [],
  missingVenueId: [],
  missingStatus: [],
  invalidStatus: [],
  missingPrice: [],
  invalidPrice: [],
  missingCurrency: [],
  invalidCurrency: [],
  missingPlantedProducts: [],
  emptyPlantedProducts: [],
  emptyDescription: [],
  orphanedDish: [],
  missingAvailability: [],
};

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    fix: args.includes('--fix'),
    venueId: args.find(a => a.startsWith('--venue-id='))?.split('=')[1],
  };
}

async function getAllVenueIds() {
  const venuesSnap = await db.collection('venues').get();
  return new Set(venuesSnap.docs.map(doc => doc.id));
}

function validateDish(dish, dishId, validVenueIds) {
  const dishIssues = [];

  // Required fields
  if (!dish.name || dish.name.trim() === '') {
    issues.missingName.push({ id: dishId, venue_id: dish.venue_id });
    dishIssues.push('missing_name');
  }

  if (!dish.venue_id || dish.venue_id.trim() === '') {
    issues.missingVenueId.push({ id: dishId, name: dish.name });
    dishIssues.push('missing_venue_id');
  } else if (!validVenueIds.has(dish.venue_id)) {
    issues.orphanedDish.push({
      id: dishId,
      name: dish.name,
      venue_id: dish.venue_id
    });
    dishIssues.push('orphaned_venue_id');
  }

  if (!dish.status) {
    issues.missingStatus.push({ id: dishId, name: dish.name, venue_id: dish.venue_id });
    dishIssues.push('missing_status');
  } else if (!VALID_STATUSES.includes(dish.status)) {
    issues.invalidStatus.push({
      id: dishId,
      name: dish.name,
      venue_id: dish.venue_id,
      status: dish.status
    });
    dishIssues.push('invalid_status');
  }

  // Price validation
  if (!dish.price) {
    issues.missingPrice.push({ id: dishId, name: dish.name, venue_id: dish.venue_id });
    dishIssues.push('missing_price');
  } else {
    if (typeof dish.price.amount !== 'number' || dish.price.amount <= 0) {
      issues.invalidPrice.push({
        id: dishId,
        name: dish.name,
        venue_id: dish.venue_id,
        price: dish.price.amount
      });
      dishIssues.push('invalid_price');
    }

    if (!dish.price.currency) {
      issues.missingCurrency.push({ id: dishId, name: dish.name, venue_id: dish.venue_id });
      dishIssues.push('missing_currency');
    } else if (!VALID_CURRENCIES.includes(dish.price.currency)) {
      issues.invalidCurrency.push({
        id: dishId,
        name: dish.name,
        venue_id: dish.venue_id,
        currency: dish.price.currency
      });
      dishIssues.push('invalid_currency');
    }
  }

  // Planted products validation
  if (!dish.planted_products) {
    issues.missingPlantedProducts.push({ id: dishId, name: dish.name, venue_id: dish.venue_id });
    dishIssues.push('missing_planted_products');
  } else if (!Array.isArray(dish.planted_products) || dish.planted_products.length === 0) {
    issues.emptyPlantedProducts.push({ id: dishId, name: dish.name, venue_id: dish.venue_id });
    dishIssues.push('empty_planted_products');
  }

  // Description validation
  if (!dish.description || dish.description.trim() === '') {
    issues.emptyDescription.push({ id: dishId, name: dish.name, venue_id: dish.venue_id });
    dishIssues.push('empty_description');
  }

  // Availability validation
  if (!dish.availability) {
    issues.missingAvailability.push({ id: dishId, name: dish.name, venue_id: dish.venue_id });
    dishIssues.push('missing_availability');
  }

  return dishIssues;
}

async function fixCriticalIssues() {
  console.log('\n' + '='.repeat(60));
  console.log('FIXING CRITICAL ISSUES');
  console.log('='.repeat(60));

  const batch = db.batch();
  let fixCount = 0;

  // Fix missing status (set to 'active')
  for (const issue of issues.missingStatus) {
    const docRef = db.collection('dishes').doc(issue.id);
    batch.update(docRef, { status: 'active' });
    console.log(`  ✓ Set status='active' for dish ${issue.id} (${issue.name})`);
    fixCount++;
  }

  // Fix invalid status (set to 'active')
  for (const issue of issues.invalidStatus) {
    const docRef = db.collection('dishes').doc(issue.id);
    batch.update(docRef, { status: 'active' });
    console.log(`  ✓ Fixed invalid status '${issue.status}' → 'active' for dish ${issue.id} (${issue.name})`);
    fixCount++;
  }

  // Fix missing planted_products (set to empty array with warning)
  for (const issue of issues.missingPlantedProducts) {
    const docRef = db.collection('dishes').doc(issue.id);
    batch.update(docRef, { planted_products: [] });
    console.log(`  ⚠ Set planted_products=[] for dish ${issue.id} (${issue.name}) - NEEDS MANUAL REVIEW`);
    fixCount++;
  }

  // Fix missing availability (set to permanent)
  for (const issue of issues.missingAvailability) {
    const docRef = db.collection('dishes').doc(issue.id);
    batch.update(docRef, { availability: { type: 'permanent' } });
    console.log(`  ✓ Set availability={type:'permanent'} for dish ${issue.id} (${issue.name})`);
    fixCount++;
  }

  if (fixCount > 0) {
    await batch.commit();
    console.log(`\n✓ Fixed ${fixCount} critical issues`);
  } else {
    console.log('\n  No critical issues to fix');
  }

  // Report issues that need manual intervention
  const manualIssues = [
    ...issues.missingName,
    ...issues.missingVenueId,
    ...issues.missingPrice,
    ...issues.invalidPrice,
    ...issues.missingCurrency,
    ...issues.emptyPlantedProducts,
    ...issues.orphanedDish,
  ];

  if (manualIssues.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('ISSUES REQUIRING MANUAL INTERVENTION');
    console.log('='.repeat(60));

    if (issues.orphanedDish.length > 0) {
      console.log(`\n⚠ ${issues.orphanedDish.length} orphaned dishes (venue doesn't exist):`);
      issues.orphanedDish.slice(0, 5).forEach(d => {
        console.log(`  - ${d.name} (${d.id}) → venue_id: ${d.venue_id}`);
      });
      if (issues.orphanedDish.length > 5) {
        console.log(`  ... and ${issues.orphanedDish.length - 5} more`);
      }
    }

    if (issues.missingName.length > 0) {
      console.log(`\n⚠ ${issues.missingName.length} dishes with missing name`);
    }

    if (issues.missingVenueId.length > 0) {
      console.log(`\n⚠ ${issues.missingVenueId.length} dishes with missing venue_id`);
    }

    if (issues.missingPrice.length > 0 || issues.invalidPrice.length > 0) {
      console.log(`\n⚠ ${issues.missingPrice.length + issues.invalidPrice.length} dishes with price issues`);
    }

    if (issues.emptyPlantedProducts.length > 0) {
      console.log(`\n⚠ ${issues.emptyPlantedProducts.length} dishes with empty planted_products array`);
    }
  }

  return fixCount;
}

async function checkDishQuality() {
  const { fix, venueId } = parseArgs();

  console.log('\n' + '='.repeat(60));
  console.log(fix ? 'DISH QUALITY CHECK (WITH FIX)' : 'DISH QUALITY CHECK (READ-ONLY)');
  if (venueId) console.log(`   Filtering by venue_id: ${venueId}`);
  console.log('='.repeat(60) + '\n');

  // Get all valid venue IDs
  console.log('Loading venues...');
  const validVenueIds = await getAllVenueIds();
  console.log(`✓ Loaded ${validVenueIds.size} venues\n`);

  // Query dishes
  console.log('Loading dishes...');
  let dishesQuery = db.collection('dishes');
  if (venueId) {
    dishesQuery = dishesQuery.where('venue_id', '==', venueId);
  }
  const dishesSnap = await dishesQuery.get();
  console.log(`✓ Loaded ${dishesSnap.size} dishes\n`);

  // Analyze each dish
  console.log('Analyzing dishes...');
  let checkedCount = 0;
  let issueCount = 0;

  for (const doc of dishesSnap.docs) {
    const dish = doc.data();
    const dishIssues = validateDish(dish, doc.id, validVenueIds);

    if (dishIssues.length > 0) {
      issueCount++;
    }

    checkedCount++;
    if (checkedCount % 100 === 0) {
      process.stdout.write(`\r  Checked ${checkedCount}/${dishesSnap.size} dishes...`);
    }
  }

  console.log(`\r✓ Analyzed ${checkedCount} dishes\n`);

  // Summary
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total dishes: ${dishesSnap.size}`);
  console.log(`Dishes with issues: ${issueCount} (${(issueCount / dishesSnap.size * 100).toFixed(1)}%)`);
  console.log(`Clean dishes: ${dishesSnap.size - issueCount} (${((dishesSnap.size - issueCount) / dishesSnap.size * 100).toFixed(1)}%)`);

  // Issue breakdown
  console.log('\n' + '='.repeat(60));
  console.log('ISSUE BREAKDOWN');
  console.log('='.repeat(60));

  const issueCategories = [
    { name: 'Missing name', count: issues.missingName.length, severity: 'CRITICAL' },
    { name: 'Missing venue_id', count: issues.missingVenueId.length, severity: 'CRITICAL' },
    { name: 'Orphaned dishes (venue not found)', count: issues.orphanedDish.length, severity: 'CRITICAL' },
    { name: 'Missing status', count: issues.missingStatus.length, severity: 'HIGH' },
    { name: 'Invalid status', count: issues.invalidStatus.length, severity: 'HIGH' },
    { name: 'Missing price', count: issues.missingPrice.length, severity: 'CRITICAL' },
    { name: 'Invalid price (≤0)', count: issues.invalidPrice.length, severity: 'HIGH' },
    { name: 'Missing currency', count: issues.missingCurrency.length, severity: 'HIGH' },
    { name: 'Invalid currency code', count: issues.invalidCurrency.length, severity: 'MEDIUM' },
    { name: 'Missing planted_products', count: issues.missingPlantedProducts.length, severity: 'CRITICAL' },
    { name: 'Empty planted_products array', count: issues.emptyPlantedProducts.length, severity: 'HIGH' },
    { name: 'Empty description', count: issues.emptyDescription.length, severity: 'LOW' },
    { name: 'Missing availability', count: issues.missingAvailability.length, severity: 'MEDIUM' },
  ];

  issueCategories.forEach(cat => {
    if (cat.count > 0) {
      const percentage = (cat.count / dishesSnap.size * 100).toFixed(1);
      console.log(`[${cat.severity}] ${cat.name}: ${cat.count} (${percentage}%)`);
    }
  });

  // Show examples of issues
  if (issues.orphanedDish.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('ORPHANED DISHES (Examples)');
    console.log('='.repeat(60));
    issues.orphanedDish.slice(0, 10).forEach(d => {
      console.log(`  ${d.name} (${d.id})`);
      console.log(`    → venue_id: ${d.venue_id} (NOT FOUND)`);
    });
    if (issues.orphanedDish.length > 10) {
      console.log(`  ... and ${issues.orphanedDish.length - 10} more`);
    }
  }

  if (issues.emptyPlantedProducts.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('EMPTY PLANTED_PRODUCTS (Examples)');
    console.log('='.repeat(60));
    issues.emptyPlantedProducts.slice(0, 10).forEach(d => {
      console.log(`  ${d.name} (${d.id}) at venue ${d.venue_id}`);
    });
    if (issues.emptyPlantedProducts.length > 10) {
      console.log(`  ... and ${issues.emptyPlantedProducts.length - 10} more`);
    }
  }

  if (issues.invalidPrice.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('INVALID PRICES (Examples)');
    console.log('='.repeat(60));
    issues.invalidPrice.slice(0, 10).forEach(d => {
      console.log(`  ${d.name} (${d.id}): price=${d.price}`);
    });
    if (issues.invalidPrice.length > 10) {
      console.log(`  ... and ${issues.invalidPrice.length - 10} more`);
    }
  }

  // Apply fixes if requested
  if (fix) {
    await fixCriticalIssues();
  } else if (issueCount > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('To fix auto-fixable issues, run:');
    console.log('  node check-dish-quality.cjs --fix');
    console.log('='.repeat(60));
  }

  return {
    total: dishesSnap.size,
    withIssues: issueCount,
    clean: dishesSnap.size - issueCount,
    issues,
  };
}

checkDishQuality()
  .then(result => {
    console.log('\n✓ Done\n');
    process.exit(result.withIssues > 0 ? 0 : 0); // Always exit 0 for reporting
  })
  .catch(e => {
    console.error('\n✗ Fatal error:', e);
    process.exit(1);
  });
