#!/usr/bin/env node
/**
 * Dish Review CLI
 *
 * Interactive CLI for reviewing discovered dishes and providing feedback.
 * Feedback is used for reinforcement learning to improve extraction accuracy.
 *
 * Usage:
 *   pnpm run review-dishes [options]
 *
 * Options:
 *   --batch, -b <n>       Number of dishes to review (default: 10)
 *   --chain <id>          Filter by chain ID
 *   --country <code>      Filter by country (CH, DE, AT)
 *   --status <status>     Filter by status (discovered, verified)
 *   --min-confidence <n>  Minimum confidence score (0-100)
 *   --help, -h            Show help
 *
 * Interactive Commands:
 *   y, yes, +             Verify dish (correct)
 *   n, no, -              Reject dish (not Planted)
 *   p                     Wrong product (enter correct one)
 *   r                     Wrong price
 *   s, skip               Skip this dish
 *   o, open               Open source URL in browser
 *   q, quit               Exit
 *   ?, help               Show help
 */

import * as readline from 'readline';
import { exec } from 'child_process';
import {
  discoveredDishes,
  dishFeedback,
  dishExtractionStrategies,
} from '@pad/database';
import type {
  ExtractedDish,
  DishFeedbackResultType,
  SupportedCountry,
  PlantedProductSku,
} from '@pad/core';

interface CLIOptions {
  batch: number;
  chain?: string;
  country?: SupportedCountry;
  status?: 'discovered' | 'verified';
  minConfidence?: number;
  help: boolean;
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    batch: 10,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--batch':
      case '-b':
        if (nextArg) {
          options.batch = parseInt(nextArg, 10) || 10;
          i++;
        }
        break;

      case '--chain':
        if (nextArg) {
          options.chain = nextArg;
          i++;
        }
        break;

      case '--country':
        if (nextArg && ['CH', 'DE', 'AT'].includes(nextArg.toUpperCase())) {
          options.country = nextArg.toUpperCase() as SupportedCountry;
          i++;
        }
        break;

      case '--status':
        if (nextArg && ['discovered', 'verified'].includes(nextArg)) {
          options.status = nextArg as 'discovered' | 'verified';
          i++;
        }
        break;

      case '--min-confidence':
        if (nextArg) {
          options.minConfidence = parseInt(nextArg, 10);
          i++;
        }
        break;

      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
Dish Review CLI

Review discovered dishes and provide feedback for learning.

Usage:
  pnpm run review-dishes [options]

Options:
  --batch, -b <n>       Number of dishes to review (default: 10)
  --chain <id>          Filter by chain ID (e.g., dean-david)
  --country <code>      Filter by country: CH, DE, AT
  --status <status>     Filter by status: discovered, verified
  --min-confidence <n>  Minimum confidence score (0-100)
  --help, -h            Show this help

Interactive Commands:
  y, yes, +             Verify dish (correct)
  n, no, -              Reject dish (not Planted / false positive)
  p                     Wrong product (prompts for correct product)
  r                     Wrong price (marks for re-extraction)
  s, skip               Skip this dish
  o, open               Open source URL in browser
  q, quit               Exit review
  ?, help               Show command help

Examples:
  # Review 20 newly discovered dishes
  pnpm run review-dishes --batch 20 --status discovered

  # Review dishes from dean&david chain
  pnpm run review-dishes --chain dean-david

  # Review Swiss dishes with high confidence
  pnpm run review-dishes --country CH --min-confidence 80
`);
}

function showCommandHelp(): void {
  console.log(`
Commands:
  y, yes, +   Verify - dish is correct
  n, no, -    Reject - not a real Planted dish
  p           Wrong product - enter correct product
  r           Wrong price - mark for re-extraction
  s, skip     Skip this dish
  o, open     Open URL in browser
  q, quit     Exit review
  ?, help     Show this help
`);
}

function displayDish(dish: ExtractedDish, index: number, total: number): void {
  console.log('\n' + '='.repeat(60));
  console.log(`Dish ${index + 1}/${total}`);
  console.log('='.repeat(60));

  console.log(`\n📍 Venue: ${dish.venue_name}`);
  if (dish.chain_name) {
    console.log(`   Chain: ${dish.chain_name}`);
  }

  console.log(`\n🍽️  Name: ${dish.name}`);

  if (dish.description) {
    console.log(`   Description: ${dish.description}`);
  }

  if (dish.category) {
    console.log(`   Category: ${dish.category}`);
  }

  console.log(`\n🌱 Product: ${dish.planted_product}`);
  console.log(`   Product Confidence: ${dish.product_confidence}%`);
  console.log(`   Match Reason: ${dish.product_match_reason}`);

  console.log(`\n💰 Prices:`);
  for (const [country, price] of Object.entries(dish.price_by_country)) {
    console.log(`   ${country}: ${price}`);
  }

  console.log(`\n🥗 Dietary:`);
  console.log(`   Vegan: ${dish.is_vegan ? 'Yes' : 'No'}`);
  if (dish.dietary_tags.length > 0) {
    console.log(`   Tags: ${dish.dietary_tags.join(', ')}`);
  }

  console.log(`\n📊 Confidence: ${dish.confidence_score}%`);
  if (dish.confidence_factors.length > 0) {
    for (const factor of dish.confidence_factors) {
      console.log(`   ${factor.factor}: ${factor.score}% - ${factor.reason}`);
    }
  }

  console.log(`\n🔗 Source: ${dish.source_url}`);
  console.log(`   Status: ${dish.status}`);

  console.log('');
}

function openUrl(url: string): void {
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

async function promptForProduct(rl: readline.Interface): Promise<PlantedProductSku | null> {
  const { PLANTED_PRODUCT_SKUS } = await import('@pad/core');

  console.log('\nAvailable products:');
  PLANTED_PRODUCT_SKUS.forEach((p: string, i: number) => {
    console.log(`  ${i + 1}. ${p}`);
  });

  return new Promise((resolve) => {
    rl.question('\nEnter product number or name: ', (answer) => {
      const num = parseInt(answer, 10);
      if (num >= 1 && num <= PLANTED_PRODUCT_SKUS.length) {
        resolve(PLANTED_PRODUCT_SKUS[num - 1] as PlantedProductSku);
      } else {
        const match = PLANTED_PRODUCT_SKUS.find((p: string) =>
          p.toLowerCase().includes(answer.toLowerCase())
        );
        resolve(match as PlantedProductSku || null);
      }
    });
  });
}

async function reviewDish(
  dish: ExtractedDish,
  rl: readline.Interface
): Promise<{ action: 'verify' | 'reject' | 'skip' | 'quit'; feedbackType?: DishFeedbackResultType; correctedProduct?: string }> {
  return new Promise((resolve) => {
    const askQuestion = () => {
      rl.question('Action [y/n/p/r/s/o/q/?]: ', async (answer) => {
        const cmd = answer.toLowerCase().trim();

        switch (cmd) {
          case 'y':
          case 'yes':
          case '+':
            resolve({ action: 'verify', feedbackType: 'correct' });
            break;

          case 'n':
          case 'no':
          case '-':
            resolve({ action: 'reject', feedbackType: 'not_planted' });
            break;

          case 'p':
            const product = await promptForProduct(rl);
            if (product) {
              resolve({
                action: 'verify',
                feedbackType: 'wrong_product',
                correctedProduct: product,
              });
            } else {
              console.log('Invalid product, try again.');
              askQuestion();
            }
            break;

          case 'r':
            resolve({ action: 'verify', feedbackType: 'wrong_price' });
            break;

          case 's':
          case 'skip':
            resolve({ action: 'skip' });
            break;

          case 'o':
          case 'open':
            openUrl(dish.source_url);
            askQuestion();
            break;

          case 'q':
          case 'quit':
            resolve({ action: 'quit' });
            break;

          case '?':
          case 'help':
            showCommandHelp();
            askQuestion();
            break;

          default:
            console.log('Unknown command. Type ? for help.');
            askQuestion();
            break;
        }
      });
    };

    askQuestion();
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  console.log('🍽️  Dish Review CLI\n');

  // Get dishes to review
  let dishes: ExtractedDish[];

  if (options.chain) {
    dishes = await discoveredDishes.getByChain(options.chain);
  } else if (options.status) {
    dishes = await discoveredDishes.getByStatus(options.status, options.batch * 2);
  } else {
    dishes = await discoveredDishes.getPendingReview(options.batch * 2);
  }

  // Apply additional filters
  if (options.country) {
    dishes = dishes.filter((d) => {
      // Check if any price is from the specified country
      return Object.keys(d.price_by_country).includes(options.country!);
    });
  }

  if (options.minConfidence !== undefined) {
    dishes = dishes.filter((d) => d.confidence_score >= options.minConfidence!);
  }

  // Limit to batch size
  dishes = dishes.slice(0, options.batch);

  if (dishes.length === 0) {
    console.log('No dishes found matching criteria.');
    process.exit(0);
  }

  console.log(`Found ${dishes.length} dishes to review.\n`);

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Track stats
  const stats = {
    reviewed: 0,
    verified: 0,
    rejected: 0,
    skipped: 0,
  };

  // Review each dish
  for (let i = 0; i < dishes.length; i++) {
    const dish = dishes[i];

    displayDish(dish, i, dishes.length);

    const result = await reviewDish(dish, rl);

    if (result.action === 'quit') {
      break;
    }

    if (result.action === 'skip') {
      stats.skipped++;
      continue;
    }

    stats.reviewed++;

    // Record feedback
    if (result.feedbackType) {
      await dishFeedback.recordFeedback({
        discovered_dish_id: dish.id,
        strategy_id: dish.discovered_by_strategy_id,
        result_type: result.feedbackType,
        feedback_details: {
          name_correct: result.feedbackType === 'correct' || result.feedbackType === 'wrong_product',
          description_correct: true,
          price_correct: result.feedbackType !== 'wrong_price',
          product_correct: result.feedbackType === 'correct',
          image_correct: true,
          corrected_product: result.correctedProduct,
        },
        reviewed_by: 'cli-user',
      });

      // Update strategy performance
      const wasCorrect = result.feedbackType === 'correct';
      if (dish.discovered_by_strategy_id && dish.discovered_by_strategy_id !== 'claude-extraction') {
        try {
          await dishExtractionStrategies.recordUsage(dish.discovered_by_strategy_id, {
            success: wasCorrect,
            dishes_found: 1,
          });
        } catch {
          // Strategy might not exist
        }
      }
    }

    // Update dish status
    if (result.action === 'verify') {
      await discoveredDishes.verifyDish(dish.id);
      stats.verified++;

      // Update product if corrected
      if (result.correctedProduct) {
        await discoveredDishes.update(dish.id, {
          planted_product: result.correctedProduct,
        });
      }

      console.log('✅ Verified');
    } else if (result.action === 'reject') {
      await discoveredDishes.rejectDish(dish.id, 'Not a Planted dish - false positive');
      stats.rejected++;
      console.log('❌ Rejected');
    }
  }

  rl.close();

  // Show summary
  console.log('\n' + '='.repeat(60));
  console.log('Review Summary');
  console.log('='.repeat(60));
  console.log(`  Reviewed: ${stats.reviewed}`);
  console.log(`  Verified: ${stats.verified}`);
  console.log(`  Rejected: ${stats.rejected}`);
  console.log(`  Skipped: ${stats.skipped}`);

  // Show feedback stats
  const feedbackStats = await dishFeedback.getStats();
  console.log(`\n  Total feedback today: ${feedbackStats.reviewed_today}`);
  console.log(`  Overall success rate: ${feedbackStats.overall_success_rate}%`);

  console.log('\nDone! 🎉');
}

main().catch(console.error);
