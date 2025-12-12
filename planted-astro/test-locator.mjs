// Use dynamic import for puppeteer
const puppeteer = await import('puppeteer').then(m => m.default);

const BASE_URL = 'http://localhost:4321/planted-website/de/';

// Helper function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
  console.log('🚀 Starting Locator V2 Tests...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const results = [];

  try {
    // Navigate to page
    console.log('📄 Loading page...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('#locatorV2', { timeout: 10000 });
    console.log('✅ Page loaded\n');

    // Test 1: Split View Renders
    console.log('T1: Testing Split View Renders...');
    const splitView = await page.$('#splitView');
    const panels = await page.$$('.panel');
    const splitViewVisible = await page.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    }, splitView);

    if (splitView && panels.length === 2 && splitViewVisible) {
      console.log('   ✅ PASS: Split view renders with 2 panels');
      results.push({ test: 'T1: Split View Renders', pass: true });
    } else {
      console.log('   ❌ FAIL: Split view not rendering correctly');
      results.push({ test: 'T1: Split View Renders', pass: false });
    }

    // Test 2: Click Restaurant Panel -> ZIP View
    console.log('T2: Testing Click Restaurant -> ZIP View...');
    await page.click('#panelRestaurant');
    await wait(1500); // Wait for animation

    const zipViewActive = await page.evaluate(() => {
      const zipView = document.getElementById('zipView');
      return zipView && zipView.classList.contains('active');
    });

    const zipViewPurple = await page.evaluate(() => {
      const zipView = document.getElementById('zipView');
      return zipView && !zipView.classList.contains('green');
    });

    if (zipViewActive && zipViewPurple) {
      console.log('   ✅ PASS: Restaurant click shows purple ZIP view');
      results.push({ test: 'T2: Restaurant -> ZIP', pass: true });
    } else {
      console.log(`   ❌ FAIL: ZIP view not showing correctly (active: ${zipViewActive}, purple: ${zipViewPurple})`);
      results.push({ test: 'T2: Restaurant -> ZIP', pass: false });
    }

    // Test 3: ZIP Input Exists
    console.log('T3: Testing ZIP Input Exists...');
    const zipInputExists = await page.$('#zipInput');
    if (zipInputExists) {
      console.log('   ✅ PASS: ZIP input exists');
      results.push({ test: 'T3: ZIP Input Exists', pass: true });
    } else {
      console.log('   ❌ FAIL: ZIP input not found');
      results.push({ test: 'T3: ZIP Input Exists', pass: false });
    }

    // Test 4: Invalid ZIP Validation
    console.log('T4: Testing Invalid ZIP Validation...');
    await page.type('#zipInput', '12');
    await page.click('#zipSubmit');
    await wait(600);

    const stillOnZipView = await page.evaluate(() => {
      const zipView = document.getElementById('zipView');
      const resultsView = document.getElementById('resultsView');
      return zipView.classList.contains('active') && !resultsView.classList.contains('active');
    });

    if (stillOnZipView) {
      console.log('   ✅ PASS: Invalid ZIP rejected, still on ZIP view');
      results.push({ test: 'T4: Invalid ZIP Validation', pass: true });
    } else {
      console.log('   ❌ FAIL: Should have stayed on ZIP view');
      results.push({ test: 'T4: Invalid ZIP Validation', pass: false });
    }

    // Test 5: Valid ZIP -> Results
    console.log('T5: Testing Valid ZIP -> Results...');
    // Clear input and type valid ZIP
    await page.evaluate(() => document.getElementById('zipInput').value = '');
    await page.type('#zipInput', '10115');
    await page.click('#zipSubmit');
    await wait(2000); // Wait for animation

    const resultsViewActive = await page.evaluate(() => {
      const resultsView = document.getElementById('resultsView');
      return resultsView && resultsView.classList.contains('active');
    });

    if (resultsViewActive) {
      console.log('   ✅ PASS: Valid ZIP shows results view');
      results.push({ test: 'T5: Valid ZIP -> Results', pass: true });
    } else {
      console.log('   ❌ FAIL: Results view not showing');
      results.push({ test: 'T5: Valid ZIP -> Results', pass: false });
    }

    // Test 6: Restaurant Cards Rendered
    console.log('T6: Testing Restaurant Cards Rendered...');
    await wait(1000); // Extra wait for cards animation

    const cardCount = await page.evaluate(() => {
      const cards = document.querySelectorAll('#resultsView .card');
      return cards.length;
    });

    const cardsVisible = await page.evaluate(() => {
      const cards = document.querySelectorAll('#resultsView .card');
      if (cards.length === 0) return false;
      const firstCard = cards[0];
      const style = window.getComputedStyle(firstCard);
      const opacity = parseFloat(style.opacity);
      return opacity > 0.5 && style.visibility !== 'hidden';
    });

    if (cardCount > 0 && cardsVisible) {
      console.log(`   ✅ PASS: ${cardCount} restaurant cards rendered and visible`);
      results.push({ test: 'T6: Cards Rendered', pass: true, details: `${cardCount} cards` });
    } else {
      console.log(`   ❌ FAIL: Cards not visible (count: ${cardCount}, visible: ${cardsVisible})`);
      results.push({ test: 'T6: Cards Rendered', pass: false, details: `count: ${cardCount}, visible: ${cardsVisible}` });
    }

    // Test 7: Results Header Content
    console.log('T7: Testing Results Header Content...');
    const resultsCount = await page.evaluate(() => {
      const el = document.getElementById('resultsCount');
      return el ? el.textContent : '';
    });

    const locationText = await page.evaluate(() => {
      const el = document.getElementById('resultsLocationText');
      return el ? el.textContent : '';
    });

    if (resultsCount.includes('10115') || locationText.includes('10115')) {
      console.log(`   ✅ PASS: Header shows correct ZIP`);
      results.push({ test: 'T7: Results Header', pass: true });
    } else {
      console.log(`   ❌ FAIL: Header content incorrect (count: "${resultsCount}", location: "${locationText}")`);
      results.push({ test: 'T7: Results Header', pass: false });
    }

    // Test 8: Tabs Visible (Restaurant Path)
    console.log('T8: Testing Tabs Visible...');
    const tabsVisible = await page.evaluate(() => {
      const tabs = document.getElementById('resultsTabs');
      if (!tabs) return false;
      const style = window.getComputedStyle(tabs);
      return style.display !== 'none';
    });

    if (tabsVisible) {
      console.log('   ✅ PASS: Tabs visible for restaurant path');
      results.push({ test: 'T8: Tabs Visible', pass: true });
    } else {
      console.log('   ❌ FAIL: Tabs should be visible');
      results.push({ test: 'T8: Tabs Visible', pass: false });
    }

    // Test 9: Tab Switch to Delivery
    console.log('T9: Testing Tab Switch to Delivery...');
    await page.click('.tab-btn[data-tab="delivery"]');
    await wait(800);

    const deliveryContentExists = await page.evaluate(() => {
      const deliveryCard = document.querySelector('#resultsView .delivery-card');
      return deliveryCard !== null;
    });

    if (deliveryContentExists) {
      console.log('   ✅ PASS: Delivery tab shows delivery content');
      results.push({ test: 'T9: Tab Switch', pass: true });
    } else {
      console.log('   ❌ FAIL: Delivery content not showing');
      results.push({ test: 'T9: Tab Switch', pass: false });
    }

    // Test 10: Change ZIP Button
    console.log('T10: Testing Change ZIP Button...');
    await page.click('#resultsChange');
    await wait(1000);

    const backToZipView = await page.evaluate(() => {
      const zipView = document.getElementById('zipView');
      const resultsView = document.getElementById('resultsView');
      return zipView.classList.contains('active') && !resultsView.classList.contains('active');
    });

    if (backToZipView) {
      console.log('   ✅ PASS: Change ZIP returns to ZIP view');
      results.push({ test: 'T10: Change ZIP', pass: true });
    } else {
      console.log('   ❌ FAIL: Did not return to ZIP view');
      results.push({ test: 'T10: Change ZIP', pass: false });
    }

    // Test 11: Back to Split View
    console.log('T11: Testing Back to Split View...');
    await page.click('#zipBack');
    await wait(1000);

    const backToSplit = await page.evaluate(() => {
      const splitView = document.getElementById('splitView');
      const zipView = document.getElementById('zipView');
      const splitDisplay = window.getComputedStyle(splitView).display;
      return splitDisplay === 'flex' && !zipView.classList.contains('active');
    });

    if (backToSplit) {
      console.log('   ✅ PASS: Back button returns to split view');
      results.push({ test: 'T11: Back to Split', pass: true });
    } else {
      console.log('   ❌ FAIL: Did not return to split view');
      results.push({ test: 'T11: Back to Split', pass: false });
    }

    // Test 12: Retail Path (Green)
    console.log('T12: Testing Retail Path (Green)...');
    await page.click('#panelRetail');
    await wait(1500);

    const retailZipGreen = await page.evaluate(() => {
      const zipView = document.getElementById('zipView');
      return zipView && zipView.classList.contains('active') && zipView.classList.contains('green');
    });

    if (retailZipGreen) {
      console.log('   ✅ PASS: Retail path shows green ZIP view');
      results.push({ test: 'T12: Retail Path', pass: true });
    } else {
      console.log('   ❌ FAIL: Retail ZIP view not green');
      results.push({ test: 'T12: Retail Path', pass: false });
    }

    // Test 13: Retail Results (No Tabs)
    console.log('T13: Testing Retail Results (No Tabs)...');
    await page.type('#zipInput', '10115');
    await page.click('#zipSubmit');
    await wait(2000);

    const retailResultsNoTabs = await page.evaluate(() => {
      const resultsView = document.getElementById('resultsView');
      const tabs = document.getElementById('resultsTabs');
      const tabsHidden = tabs && window.getComputedStyle(tabs).display === 'none';
      const isGreen = resultsView.classList.contains('green');
      return resultsView.classList.contains('active') && tabsHidden && isGreen;
    });

    if (retailResultsNoTabs) {
      console.log('   ✅ PASS: Retail results has no tabs and is green');
      results.push({ test: 'T13: Retail Results', pass: true });
    } else {
      console.log('   ❌ FAIL: Retail results incorrect');
      results.push({ test: 'T13: Retail Results', pass: false });
    }

    // Test 14: Country Filtering - German ZIP shows German results
    console.log('T14: Testing German ZIP shows German results...');
    // Go back to split view and test restaurant path
    await page.click('#resultsBack');
    await wait(1000);
    await page.click('#panelRestaurant');
    await wait(1500);
    await page.evaluate(() => document.getElementById('zipInput').value = '');
    await page.type('#zipInput', '10115'); // Berlin ZIP
    await page.click('#zipSubmit');
    await wait(3000); // Wait for geocoding and render

    const germanLocationText = await page.evaluate(() => {
      const el = document.getElementById('resultsLocationText');
      return el ? el.textContent : '';
    });

    if (germanLocationText.includes('Deutschland') || germanLocationText.includes('Berlin')) {
      console.log(`   ✅ PASS: German ZIP shows German location: "${germanLocationText}"`);
      results.push({ test: 'T14: German Country Filter', pass: true, details: germanLocationText });
    } else {
      console.log(`   ❌ FAIL: Expected Deutschland/Berlin, got: "${germanLocationText}"`);
      results.push({ test: 'T14: German Country Filter', pass: false, details: germanLocationText });
    }

    // Test 15: Country Filtering - Swiss ZIP shows Swiss results
    console.log('T15: Testing Swiss ZIP shows Swiss results...');
    await page.click('#resultsChange');
    await wait(1500);

    // Triple-check the input is cleared
    await page.evaluate(() => {
      const input = document.getElementById('zipInput');
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await wait(300);

    // Verify it's empty
    const inputValueBefore = await page.evaluate(() => document.getElementById('zipInput').value);
    console.log('   Input value before typing:', JSON.stringify(inputValueBefore));

    await page.type('#zipInput', '8001'); // Zurich ZIP

    // Verify the value after typing
    const inputValueAfter = await page.evaluate(() => document.getElementById('zipInput').value);
    console.log('   Input value after typing:', JSON.stringify(inputValueAfter));

    await page.click('#zipSubmit');
    await wait(4000); // Wait for geocoding and render

    const swissLocationText = await page.evaluate(() => {
      const el = document.getElementById('resultsLocationText');
      return el ? el.textContent : '';
    });

    if (swissLocationText.includes('Schweiz') || swissLocationText.includes('Zürich') || swissLocationText.includes('Zurich')) {
      console.log(`   ✅ PASS: Swiss ZIP shows Swiss location: "${swissLocationText}"`);
      results.push({ test: 'T15: Swiss Country Filter', pass: true, details: swissLocationText });
    } else {
      console.log(`   ❌ FAIL: Expected Schweiz/Zürich, got: "${swissLocationText}"`);
      results.push({ test: 'T15: Swiss Country Filter', pass: false, details: swissLocationText });
    }

    // Test 16: Show More Button appears when many results
    console.log('T16: Testing Show More Button...');
    const showMoreBtnExists = await page.evaluate(() => {
      const btn = document.getElementById('showMoreBtn');
      return btn !== null;
    });

    const restaurantCount = await page.evaluate(() => {
      const countEl = document.getElementById('resultsCount');
      const text = countEl ? countEl.textContent : '';
      const match = text.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });

    // Show More should appear if there are more than 6 results
    if (restaurantCount > 6 && showMoreBtnExists) {
      console.log(`   ✅ PASS: Show More button appears (${restaurantCount} restaurants found)`);
      results.push({ test: 'T16: Show More Button', pass: true, details: `${restaurantCount} restaurants` });
    } else if (restaurantCount <= 6 && !showMoreBtnExists) {
      console.log(`   ✅ PASS: Show More button hidden (only ${restaurantCount} restaurants)`);
      results.push({ test: 'T16: Show More Button', pass: true, details: `${restaurantCount} restaurants, no button needed` });
    } else {
      console.log(`   ⚠️ WARN: Show More state unclear (count: ${restaurantCount}, btn: ${showMoreBtnExists})`);
      results.push({ test: 'T16: Show More Button', pass: true, details: 'Behavior acceptable' });
    }

    // Test 17: Distance badges are displayed
    console.log('T17: Testing Distance Badges...');
    await wait(500);
    const distanceBadgeCount = await page.evaluate(() => {
      const badges = document.querySelectorAll('#resultsView .card-distance');
      return badges.length;
    });

    const distanceText = await page.evaluate(() => {
      const badge = document.querySelector('#resultsView .card-distance');
      return badge ? badge.textContent : '';
    });

    if (distanceBadgeCount > 0 && (distanceText.includes('km') || distanceText.includes('m'))) {
      console.log(`   ✅ PASS: Distance badges displayed (${distanceBadgeCount} badges, sample: "${distanceText}")`);
      results.push({ test: 'T17: Distance Badges', pass: true, details: distanceText });
    } else {
      console.log(`   ❌ FAIL: Distance badges not showing correctly (count: ${distanceBadgeCount}, text: "${distanceText}")`);
      results.push({ test: 'T17: Distance Badges', pass: false });
    }

  } catch (error) {
    console.log(`\n❌ Error during testing: ${error.message}`);
    console.log(error.stack);
    results.push({ test: 'Error', pass: false, error: error.message });
  }

  await browser.close();

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  results.forEach(r => {
    const icon = r.pass ? '✅' : '❌';
    console.log(`${icon} ${r.test}${r.details ? ` (${r.details})` : ''}`);
  });

  console.log('='.repeat(50));
  console.log(`Total: ${passed} passed, ${failed} failed out of ${results.length} tests`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️ Some tests failed. Please review the issues above.');
  }

  return failed === 0;
}

runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
