#!/usr/bin/env node
/**
 * Test Lieferando page structure to find the right selectors
 */

const puppeteer = require('puppeteer');

async function testLieferandoSelectors() {
  const testUrl = 'https://www.lieferando.at/en/menu/fat-monk-wien-schottengasse';

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log(`Navigating to: ${testUrl}`);
  await page.goto(testUrl, { waitUntil: 'networkidle2', timeout: 30000 });

  console.log('Page loaded, waiting 3 seconds for JS to render...');
  await new Promise(r => setTimeout(r, 3000));

  // Try to find menu elements
  console.log('\nTesting selectors:');

  const selectors = [
    'article',
    'button',
    'li',
    '[data-qa]',
    '[data-testid]',
    '[class*="menu"]',
    '[class*="Menu"]',
    '[class*="item"]',
    '[class*="Item"]',
    '[class*="product"]',
    '[class*="Product"]',
    '[class*="dish"]',
    '[class*="Dish"]',
    'h3',
    'h4',
  ];

  for (const selector of selectors) {
    const count = await page.evaluate(sel => {
      return document.querySelectorAll(sel).length;
    }, selector);

    if (count > 0) {
      console.log(`  ${selector}: ${count} elements`);
    }
  }

  // Get a sample of the page structure
  console.log('\n\nPage structure sample (first 5000 chars):');
  const html = await page.content();
  console.log(html.substring(0, 5000));

  console.log('\n\nTaking screenshot...');
  await page.screenshot({ path: 'lieferando-test.png', fullPage: true });

  console.log('Press Ctrl+C to close browser');
  await new Promise(r => setTimeout(r, 60000)); // Keep browser open for 60 seconds

  await browser.close();
}

testLieferandoSelectors()
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
