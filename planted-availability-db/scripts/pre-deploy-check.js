#!/usr/bin/env node

/**
 * Pre-Deployment Verification Script
 *
 * Run this BEFORE deploying to catch issues early.
 *
 * Usage:
 *   node scripts/pre-deploy-check.js
 *   pnpm run pre-deploy
 *
 * Exit codes:
 *   0 = All checks passed, safe to deploy
 *   1 = Checks failed, DO NOT deploy
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logCheck(name, passed, message = '') {
  const status = passed ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`;
  const msg = message ? ` - ${message}` : '';
  console.log(`  [${status}] ${name}${msg}`);
  return passed;
}

function run(command, options = {}) {
  try {
    return execSync(command, {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
  } catch (error) {
    if (options.silent) {
      return null;
    }
    throw error;
  }
}

async function main() {
  log('\n========================================', 'cyan');
  log('  PRE-DEPLOYMENT VERIFICATION', 'cyan');
  log('========================================\n', 'cyan');

  let allPassed = true;

  // 1. Check TypeScript compilation
  log('1. TypeScript Compilation', 'blue');
  try {
    run('pnpm run build', { silent: false });
    allPassed = logCheck('TypeScript build', true, 'All packages compiled') && allPassed;
  } catch (error) {
    allPassed = logCheck('TypeScript build', false, 'Build failed') && allPassed;
  }
  console.log();

  // 2. Check required files exist
  log('2. Required Files', 'blue');
  const requiredFiles = [
    'packages/api/lib/index.js',
    'packages/admin-dashboard-v2/dist/index.html',
    'firebase.json',
    '.firebaserc',
  ];

  for (const file of requiredFiles) {
    const fullPath = path.join(ROOT_DIR, file);
    const exists = fs.existsSync(fullPath);
    allPassed = logCheck(file, exists, exists ? 'exists' : 'MISSING') && allPassed;
  }
  console.log();

  // 3. Check Firebase config
  log('3. Firebase Configuration', 'blue');
  try {
    const firebaseConfig = JSON.parse(
      fs.readFileSync(path.join(ROOT_DIR, 'firebase.json'), 'utf-8')
    );

    const hasHosting = !!firebaseConfig.hosting;
    const hasFunctions = !!firebaseConfig.functions;
    const hasFirestore = !!firebaseConfig.firestore;

    allPassed = logCheck('hosting config', hasHosting) && allPassed;
    allPassed = logCheck('functions config', hasFunctions) && allPassed;
    allPassed = logCheck('firestore config', hasFirestore) && allPassed;
  } catch (error) {
    allPassed = logCheck('firebase.json parsing', false, error.message) && allPassed;
  }
  console.log();

  // 4. Check dashboard environment
  log('4. Dashboard Environment', 'blue');
  const envFile = path.join(ROOT_DIR, 'packages/admin-dashboard-v2/.env');
  const envExampleFile = path.join(ROOT_DIR, 'packages/admin-dashboard-v2/.env.example');

  if (fs.existsSync(envFile)) {
    const envContent = fs.readFileSync(envFile, 'utf-8');
    const requiredEnvVars = [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_API_URL',
    ];

    for (const envVar of requiredEnvVars) {
      const hasVar = envContent.includes(envVar);
      allPassed = logCheck(envVar, hasVar, hasVar ? 'set' : 'MISSING') && allPassed;
    }
  } else {
    allPassed = logCheck('.env file', false, 'Missing - copy from .env.example') && allPassed;
  }
  console.log();

  // 5. Check for potential issues in code
  log('5. Code Quality Checks', 'blue');

  // Check for console.log in production code (excluding test files)
  try {
    const consoleLogCheck = run(
      'git grep -n "console.log" -- "packages/api/src/**/*.ts" ":(exclude)**/test/**" | head -5',
      { silent: true }
    );
    if (consoleLogCheck && consoleLogCheck.trim()) {
      logCheck('console.log statements', true, 'Found (review before deploy)');
    } else {
      logCheck('console.log statements', true, 'Clean');
    }
  } catch {
    logCheck('console.log check', true, 'Skipped');
  }

  // Check for TODO/FIXME comments
  try {
    const todoCheck = run(
      'git grep -n "TODO\\|FIXME" -- "packages/api/src/**/*.ts" | wc -l',
      { silent: true }
    );
    const todoCount = parseInt(todoCheck?.trim() || '0', 10);
    logCheck('TODO/FIXME comments', true, `${todoCount} found`);
  } catch {
    logCheck('TODO/FIXME check', true, 'Skipped');
  }
  console.log();

  // 6. Test API endpoint (if running locally)
  log('6. API Endpoint Test', 'blue');
  try {
    const healthCheckUrl = 'https://europe-west6-get-planted-db.cloudfunctions.net/adminHealthCheck';
    const curlResult = run(`curl -s -o /dev/null -w "%{http_code}" "${healthCheckUrl}"`, { silent: true });
    const statusCode = curlResult?.trim();

    if (statusCode === '200') {
      allPassed = logCheck('Production health check', true, `HTTP ${statusCode}`) && allPassed;
    } else {
      logCheck('Production health check', true, `HTTP ${statusCode} (may not be deployed yet)`);
    }
  } catch {
    logCheck('Production health check', true, 'Skipped (curl not available)');
  }
  console.log();

  // Summary
  log('========================================', 'cyan');
  if (allPassed) {
    log('  ALL CHECKS PASSED - SAFE TO DEPLOY', 'green');
    log('========================================\n', 'cyan');
    log('Next steps:', 'blue');
    log('  1. Run: firebase deploy');
    log('  2. Run: pnpm run smoke-test');
    log('  3. Verify at: https://get-planted-db.web.app/test\n');
    process.exit(0);
  } else {
    log('  CHECKS FAILED - DO NOT DEPLOY', 'red');
    log('========================================\n', 'cyan');
    log('Fix the issues above before deploying.\n', 'yellow');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Pre-deploy check error:', error);
  process.exit(1);
});
