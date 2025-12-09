#!/usr/bin/env tsx
/**
 * Interactive CLI for reviewing discovered venues
 *
 * This implements a reinforcement learning feedback loop where:
 * 1. Random unreviewed venues are shown to the user
 * 2. User provides positive (verified) or negative (rejected) feedback
 * 3. Feedback is used to update strategy performance metrics
 *
 * Usage:
 *   pnpm run review
 *   pnpm run review --batch 10
 *   pnpm run review --country DE
 *   pnpm run review --random
 */

import * as readline from 'readline';
import {
  discoveredVenues,
  discoveryStrategies,
  searchFeedback,
} from '@pad/database';
import type { DiscoveredVenueStatus, SupportedCountry } from '@pad/core';

interface ReviewArgs {
  batch: number;
  country?: SupportedCountry;
  random: boolean;
  status: DiscoveredVenueStatus;
}

function parseArgs(): ReviewArgs {
  const args = process.argv.slice(2);
  const result: ReviewArgs = {
    batch: 10,
    country: undefined,
    random: true,
    status: 'discovered',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--batch':
      case '-b':
        if (nextArg) {
          result.batch = parseInt(nextArg, 10);
          i++;
        }
        break;

      case '--country':
      case '-c':
        if (nextArg && ['CH', 'DE', 'AT'].includes(nextArg)) {
          result.country = nextArg as SupportedCountry;
          i++;
        }
        break;

      case '--random':
      case '-r':
        result.random = true;
        break;

      case '--sequential':
      case '-s':
        result.random = false;
        break;

      case '--status':
        if (nextArg) {
          result.status = nextArg as DiscoveredVenueStatus;
          i++;
        }
        break;

      case '--help':
      case '-h':
        console.log(`
Venue Review CLI - Reinforcement Learning Feedback Loop

Usage:
  pnpm run review [options]

Options:
  --batch, -b <n>       Number of venues to review (default: 10)
  --country, -c <code>  Filter by country: CH, DE, AT
  --random, -r          Show venues in random order (default)
  --sequential, -s      Show venues in order of confidence score
  --status <status>     Filter by status (default: discovered)
  --help, -h            Show this help

Commands during review:
  y / yes / +           Verify venue (positive feedback)
  n / no / -            Reject venue (negative feedback)
  s / skip              Skip this venue
  o / open              Open URL in browser
  q / quit              Exit review session
  ? / help              Show help

The feedback will:
  - Update the venue status (verified/rejected)
  - Update strategy success metrics
  - Influence future search queries through reinforcement learning
`);
        process.exit(0);
    }
  }

  return result;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function formatVenueDisplay(venue: Awaited<ReturnType<typeof discoveredVenues.getById>>): string {
  if (!venue) return 'Venue not found';

  const lines: string[] = [];
  lines.push('');
  lines.push('═'.repeat(60));
  lines.push(`  📍 ${venue.name}`);
  lines.push('═'.repeat(60));
  lines.push('');

  // Location
  lines.push(`  📌 Location: ${venue.address.city}, ${venue.address.country}`);
  if (venue.address.street) {
    lines.push(`     Street: ${venue.address.street}`);
  }
  if (venue.address.postal_code) {
    lines.push(`     Postal: ${venue.address.postal_code}`);
  }

  lines.push('');

  // Delivery platforms
  lines.push('  🚚 Delivery Platforms:');
  for (const platform of venue.delivery_platforms) {
    lines.push(`     • ${platform.platform}: ${platform.url}`);
    if (platform.rating) {
      lines.push(`       Rating: ${platform.rating} (${platform.review_count || 0} reviews)`);
    }
  }

  lines.push('');

  // Planted products
  lines.push('  🌱 Planted Products:');
  if (venue.planted_products.length > 0) {
    for (const product of venue.planted_products) {
      lines.push(`     • ${product}`);
    }
  } else {
    lines.push('     (none detected)');
  }

  // Dishes if any
  if (venue.dishes && venue.dishes.length > 0) {
    lines.push('');
    lines.push('  🍽️  Dishes:');
    for (const dish of venue.dishes.slice(0, 3)) {
      const price = dish.price ? ` - ${dish.price}` : '';
      lines.push(`     • ${dish.name}${price}`);
      if (dish.description) {
        lines.push(`       ${dish.description.substring(0, 60)}...`);
      }
    }
    if (venue.dishes.length > 3) {
      lines.push(`     ... and ${venue.dishes.length - 3} more dishes`);
    }
  }

  lines.push('');

  // Chain info
  if (venue.is_chain) {
    lines.push(`  🔗 Chain: ${venue.chain_name || 'Yes'} (confidence: ${venue.chain_confidence || 0}%)`);
  }

  // Confidence
  lines.push('');
  lines.push('  📊 Confidence Score: ' + formatConfidenceBar(venue.confidence_score));

  // Confidence factors
  if (venue.confidence_factors && venue.confidence_factors.length > 0) {
    for (const factor of venue.confidence_factors) {
      lines.push(`     • ${factor.factor}: ${factor.score}% - ${factor.reason}`);
    }
  }

  // Discovery info
  lines.push('');
  lines.push(`  🔍 Discovered by: ${venue.discovered_by_strategy_id}`);
  lines.push(`     Query: ${venue.discovered_by_query}`);
  lines.push(`     Date: ${venue.created_at.toLocaleDateString()}`);

  lines.push('');
  lines.push('─'.repeat(60));

  return lines.join('\n');
}

function formatConfidenceBar(score: number): string {
  const filled = Math.round(score / 5);
  const empty = 20 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  let color: string;
  if (score >= 70) {
    color = '\x1b[32m'; // Green
  } else if (score >= 40) {
    color = '\x1b[33m'; // Yellow
  } else {
    color = '\x1b[31m'; // Red
  }

  return `${color}${bar}\x1b[0m ${score}%`;
}

async function openUrl(url: string): Promise<void> {
  const { exec } = await import('child_process');
  const platform = process.platform;

  let command: string;
  if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else if (platform === 'darwin') {
    command = `open "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  exec(command, (error) => {
    if (error) {
      console.log(`Could not open URL: ${error.message}`);
    }
  });
}

async function updateStrategyFeedback(
  venueId: string,
  strategyId: string,
  wasCorrect: boolean,
  query: string,
  platform: string,
  country: string
): Promise<void> {
  // Update strategy metrics
  if (strategyId && strategyId !== 'claude-generated') {
    try {
      await discoveryStrategies.recordUsage(strategyId, {
        success: wasCorrect,
        was_false_positive: !wasCorrect,
      });
      console.log(`  ✓ Updated strategy ${strategyId} (${wasCorrect ? 'success' : 'false positive'})`);
    } catch (error) {
      // Strategy might not exist
      console.log(`  ⚠ Could not update strategy: ${error}`);
    }
  }

  // Record search feedback
  try {
    await searchFeedback.recordSearch({
      query,
      platform: platform as any,
      country: country as any,
      strategy_id: strategyId || 'claude-generated',
      result_type: wasCorrect ? 'true_positive' : 'false_positive',
      discovered_venue_id: venueId,
    });
    console.log(`  ✓ Recorded search feedback`);
  } catch (error) {
    console.log(`  ⚠ Could not record feedback: ${error}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs();

  console.log('\n🔍 Venue Review - Reinforcement Learning Feedback Loop');
  console.log('======================================================');
  console.log(`Batch size: ${args.batch}`);
  console.log(`Country filter: ${args.country || 'all'}`);
  console.log(`Order: ${args.random ? 'random' : 'by confidence'}`);
  console.log(`Status filter: ${args.status}`);
  console.log('');

  // Get venues to review
  let venues = await discoveredVenues.getByStatus(args.status);

  // Filter by country if specified
  if (args.country) {
    venues = venues.filter((v) => v.address.country === args.country);
  }

  if (venues.length === 0) {
    console.log('No venues to review!');
    process.exit(0);
  }

  console.log(`Found ${venues.length} venues to review.`);

  // Shuffle or sort
  if (args.random) {
    venues = shuffleArray(venues);
  } else {
    venues.sort((a, b) => b.confidence_score - a.confidence_score);
  }

  // Take batch
  const toReview = venues.slice(0, args.batch);

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (question: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer.trim().toLowerCase());
      });
    });
  };

  // Stats
  let reviewed = 0;
  let verified = 0;
  let rejected = 0;
  let skipped = 0;

  // Review loop
  for (let i = 0; i < toReview.length; i++) {
    const venue = toReview[i];

    console.log(`\n[${i + 1}/${toReview.length}]`);
    console.log(formatVenueDisplay(venue));

    let decided = false;
    while (!decided) {
      const answer = await prompt('\n  Is this a valid Planted venue? [y/n/s/o/q/?]: ');

      switch (answer) {
        case 'y':
        case 'yes':
        case '+':
          // Verify venue
          await discoveredVenues.verifyVenue(venue.id);
          await updateStrategyFeedback(
            venue.id,
            venue.discovered_by_strategy_id,
            true,
            venue.discovered_by_query,
            venue.delivery_platforms[0]?.platform || 'unknown',
            venue.address.country
          );
          console.log('\n  ✅ Venue VERIFIED');
          verified++;
          reviewed++;
          decided = true;
          break;

        case 'n':
        case 'no':
        case '-':
          // Reject venue
          const reason = await prompt('  Rejection reason (optional): ');
          await discoveredVenues.rejectVenue(venue.id, reason || 'User rejected');
          await updateStrategyFeedback(
            venue.id,
            venue.discovered_by_strategy_id,
            false,
            venue.discovered_by_query,
            venue.delivery_platforms[0]?.platform || 'unknown',
            venue.address.country
          );
          console.log('\n  ❌ Venue REJECTED');
          rejected++;
          reviewed++;
          decided = true;
          break;

        case 's':
        case 'skip':
          console.log('\n  ⏭️  Skipped');
          skipped++;
          decided = true;
          break;

        case 'o':
        case 'open':
          if (venue.delivery_platforms.length > 0) {
            console.log('\n  🌐 Opening URL...');
            await openUrl(venue.delivery_platforms[0].url);
          } else {
            console.log('\n  ⚠️  No URL available');
          }
          break;

        case 'q':
        case 'quit':
          console.log('\n  👋 Exiting review session...');
          decided = true;
          i = toReview.length; // Exit outer loop
          break;

        case '?':
        case 'help':
          console.log(`
  Commands:
    y / yes / +    Verify venue (positive feedback)
    n / no / -     Reject venue (negative feedback)
    s / skip       Skip this venue
    o / open       Open URL in browser
    q / quit       Exit review session
    ? / help       Show this help
`);
          break;

        default:
          console.log('  Unknown command. Type ? for help.');
      }
    }
  }

  rl.close();

  // Summary
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  📊 Review Session Summary');
  console.log('═'.repeat(60));
  console.log(`  Total reviewed: ${reviewed}`);
  console.log(`  ✅ Verified:    ${verified}`);
  console.log(`  ❌ Rejected:    ${rejected}`);
  console.log(`  ⏭️  Skipped:     ${skipped}`);

  if (reviewed > 0) {
    const precision = Math.round((verified / reviewed) * 100);
    console.log(`  📈 Precision:   ${precision}%`);
  }

  console.log('');
  console.log('  Strategy performance has been updated based on your feedback.');
  console.log('  This will influence future search queries.');
  console.log('');
}

main().catch(console.error);
