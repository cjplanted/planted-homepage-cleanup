#!/usr/bin/env node
/**
 * Puppeteer-Based Dish Image Scraper
 *
 * Scrapes dish images from JS-rendered delivery platform pages (Lieferando, Just Eat)
 * that cannot be scraped with simple HTTP requests.
 *
 * Usage:
 *   node puppeteer-dish-scraper.cjs                          # Dry run - show what would be scraped
 *   node puppeteer-dish-scraper.cjs --execute                # Actually scrape and update images
 *   node puppeteer-dish-scraper.cjs --venue=<id>             # Process specific venue only
 *   node puppeteer-dish-scraper.cjs --platform=lieferando    # Process specific platform only
 *
 * Remaining dishes needing images (from T023):
 * - Vienna: FAT MONK (4 dishes) - Lieferando
 * - Munich: dean&david Pasing (5 dishes), Werksviertel (5 dishes) - Just Eat
 * - Berlin: Beets & Roots (8 dishes) - Just Eat
 * - Zurich: Hiltl (12 dishes), mit&ohne (6 dishes) - Just Eat
 */

const admin = require('firebase-admin');
const path = require('path');
const puppeteer = require('puppeteer');

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
const venueArg = process.argv.find(a => a.startsWith('--venue='));
const platformArg = process.argv.find(a => a.startsWith('--platform='));
const SPECIFIC_VENUE = venueArg ? venueArg.split('=')[1] : null;
const SPECIFIC_PLATFORM = platformArg ? platformArg.split('=')[1] : null;

// User agents for rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];

let currentUserAgentIndex = 0;

function getNextUserAgent() {
  const ua = USER_AGENTS[currentUserAgentIndex];
  currentUserAgentIndex = (currentUserAgentIndex + 1) % USER_AGENTS.length;
  return ua;
}

/**
 * Extract dish images from Lieferando page (JS-rendered React app)
 */
async function extractLieferandoImages(page, dishNames) {
  console.log('    Waiting for Lieferando menu to load...');

  try {
    // Wait longer for React app to render
    await new Promise(r => setTimeout(r, 5000));

    // Scroll to load lazy images
    await scrollToBottom(page);
    await new Promise(r => setTimeout(r, 2000));

    // Extract menu items with images
    const menuItems = await page.evaluate(() => {
      const items = [];
      const seenNames = new Set();

      // Look for article elements (Lieferando uses articles for menu items)
      const containers = document.querySelectorAll('article, li, button, [role="button"], div[class*="meal"], div[class*="item"]');

      containers.forEach(container => {
        // Find dish name (look in all headings)
        let name = '';
        const nameEl = container.querySelector('h1, h2, h3, h4, h5, h6, p, span[class*="name"], span[class*="title"]');
        if (nameEl) {
          name = nameEl.textContent.trim();
          // Clean up the name
          name = name.split('\n')[0].trim(); // Take first line only
        }

        // Find image
        let imageUrl = '';
        const img = container.querySelector('img');
        if (img) {
          imageUrl = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('srcset') || '';
          // If srcset, take first URL
          if (imageUrl.includes(',')) {
            imageUrl = imageUrl.split(',')[0].trim().split(' ')[0];
          }
        }

        // Only add if we have both name and image, and name looks like a dish
        if (name && imageUrl && name.length > 3 && name.length < 100 && !seenNames.has(name.toLowerCase())) {
          seenNames.add(name.toLowerCase());
          items.push({ name, imageUrl });
        }
      });

      return items;
    });

    console.log(`    Found ${menuItems.length} menu items with images`);

    // Debug: Show what we're looking for vs what we found
    if (menuItems.length > 0 && menuItems.length < 50) {
      console.log(`    Available menu items: ${menuItems.map(i => i.name).slice(0, 10).join(', ')}${menuItems.length > 10 ? '...' : ''}`);
    }
    console.log(`    Looking for: ${dishNames.join(', ')}`);

    // Match with our dish names using multiple strategies
    const images = new Map();
    for (const dishName of dishNames) {
      const normalizedDish = dishName.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Extract key words from dish name
      const dishWords = dishName.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);

      for (const item of menuItems) {
        const normalizedItem = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const itemWords = item.name.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);

        // Strategy 1: Direct substring match
        if (normalizedItem.includes(normalizedDish) || normalizedDish.includes(normalizedItem)) {
          console.log(`      Matched "${dishName}" to "${item.name}" (direct)`);
          images.set(dishName, item.imageUrl);
          break;
        }

        // Strategy 2: Check if key words match (e.g., "planted" + "chicken")
        const matchCount = dishWords.filter(word =>
          itemWords.some(iw => iw.includes(word) || word.includes(iw))
        ).length;

        if (matchCount >= 2 || (matchCount >= 1 && dishWords.length === 1)) {
          console.log(`      Matched "${dishName}" to "${item.name}" (keywords: ${matchCount}/${dishWords.length})`);
          images.set(dishName, item.imageUrl);
          break;
        }
      }
    }

    return images;
  } catch (error) {
    console.log(`    Error extracting Lieferando images: ${error.message}`);
    return new Map();
  }
}

/**
 * Extract dish images from Just Eat page (JS-rendered)
 */
async function extractJustEatImages(page, dishNames) {
  console.log('    Waiting for Just Eat menu to load...');

  try {
    // Wait longer for JS to render
    await new Promise(r => setTimeout(r, 5000));

    // Scroll to load lazy images
    await scrollToBottom(page);
    await new Promise(r => setTimeout(r, 2000));

    // Extract menu items with images
    const menuItems = await page.evaluate(() => {
      const items = [];
      const seenNames = new Set();

      // Look for menu item containers (broad selectors)
      const containers = document.querySelectorAll(
        'article, li, button, [role="button"], div[class*="meal"], div[class*="item"], div[class*="product"]'
      );

      containers.forEach(container => {
        // Find dish name
        let name = '';
        const nameEl = container.querySelector('h1, h2, h3, h4, h5, h6, p, span[class*="name"], span[class*="title"]');
        if (nameEl) {
          name = nameEl.textContent.trim();
          // Clean up the name
          name = name.split('\n')[0].trim(); // Take first line only
        }

        // Find image
        let imageUrl = '';
        const img = container.querySelector('img');
        if (img) {
          imageUrl = img.getAttribute('src') || img.getAttribute('data-src') || '';

          // Just Eat sometimes uses srcset for better quality
          const srcset = img.getAttribute('srcset');
          if (srcset) {
            const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
            imageUrl = urls[urls.length - 1] || imageUrl; // Get highest quality
          }
        }

        // Only add if we have both name and image, and name looks like a dish
        if (name && imageUrl && name.length > 3 && name.length < 100 && !seenNames.has(name.toLowerCase())) {
          seenNames.add(name.toLowerCase());
          items.push({ name, imageUrl });
        }
      });

      return items;
    });

    console.log(`    Found ${menuItems.length} menu items with images`);

    // Debug: Show what we're looking for vs what we found
    if (menuItems.length > 0 && menuItems.length < 50) {
      console.log(`    Available menu items: ${menuItems.map(i => i.name).slice(0, 10).join(', ')}${menuItems.length > 10 ? '...' : ''}`);
    }
    console.log(`    Looking for: ${dishNames.join(', ')}`);

    // Match with our dish names using multiple strategies
    const images = new Map();
    for (const dishName of dishNames) {
      const normalizedDish = dishName.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Extract key words from dish name
      const dishWords = dishName.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);

      for (const item of menuItems) {
        const normalizedItem = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const itemWords = item.name.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);

        // Strategy 1: Direct substring match
        if (normalizedItem.includes(normalizedDish) || normalizedDish.includes(normalizedItem)) {
          console.log(`      Matched "${dishName}" to "${item.name}" (direct)`);
          images.set(dishName, item.imageUrl);
          break;
        }

        // Strategy 2: Check if key words match (e.g., "planted" + "chicken")
        const matchCount = dishWords.filter(word =>
          itemWords.some(iw => iw.includes(word) || word.includes(iw))
        ).length;

        if (matchCount >= 2 || (matchCount >= 1 && dishWords.length === 1)) {
          console.log(`      Matched "${dishName}" to "${item.name}" (keywords: ${matchCount}/${dishWords.length})`);
          images.set(dishName, item.imageUrl);
          break;
        }
      }
    }

    return images;
  } catch (error) {
    console.log(`    Error extracting Just Eat images: ${error.message}`);
    return new Map();
  }
}

/**
 * Scroll to bottom of page to trigger lazy loading
 */
async function scrollToBottom(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);

      // Safety timeout
      setTimeout(() => {
        clearInterval(timer);
        resolve();
      }, 10000);
    });
  });
}

/**
 * Check if image URL is valid
 */
async function isValidImageUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

async function scrapeDishImages() {
  console.log('\n=== PUPPETEER DISH IMAGE SCRAPER ===\n');
  console.log(`Mode: ${EXECUTE ? '🔥 EXECUTE' : '🔍 DRY RUN'}`);
  if (SPECIFIC_VENUE) console.log(`Venue: ${SPECIFIC_VENUE}`);
  if (SPECIFIC_PLATFORM) console.log(`Platform: ${SPECIFIC_PLATFORM}`);
  console.log('');

  // Launch browser
  console.log('Launching headless browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1280,800',
    ]
  });

  try {
    // Get all venues
    const venuesSnap = await db.collection('venues')
      .where('status', '==', 'active')
      .get();

    let venues = venuesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filter by specific venue if provided
    if (SPECIFIC_VENUE) {
      venues = venues.filter(v => v.id === SPECIFIC_VENUE);
    }

    // Get all dishes
    const dishesSnap = await db.collection('dishes').get();
    const allDishes = dishesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    let totalUpdated = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    const platformStats = {
      lieferando: { success: 0, failed: 0 },
      'just-eat': { success: 0, failed: 0 }
    };

    for (const venue of venues) {
      const venueDishes = allDishes.filter(d => d.venue_id === venue.id && !d.image_url);
      if (venueDishes.length === 0) {
        totalSkipped++;
        continue;
      }

      const platforms = venue.delivery_platforms || [];
      const jsRenderPlatforms = platforms.filter(p =>
        (p.platform === 'lieferando' || p.platform === 'just-eat') &&
        (!SPECIFIC_PLATFORM || p.platform === SPECIFIC_PLATFORM)
      );

      if (jsRenderPlatforms.length === 0) {
        console.log(`\n⚠️  ${venue.name} - No Lieferando/Just Eat platforms, skipping`);
        totalSkipped++;
        continue;
      }

      console.log(`\n📍 ${venue.name} (${venueDishes.length} dishes need images)`);

      // Try each platform
      for (const platform of jsRenderPlatforms) {
        if (!platform.url) continue;

        console.log(`   Trying ${platform.platform}: ${platform.url}`);

        const page = await browser.newPage();

        try {
          // Set user agent
          await page.setUserAgent(getNextUserAgent());

          // Set viewport
          await page.setViewport({ width: 1280, height: 800 });

          // Navigate to the page
          await page.goto(platform.url, {
            waitUntil: 'networkidle2',
            timeout: 30000,
          });

          const dishNames = venueDishes.map(d => d.name);
          let images = new Map();

          if (platform.platform === 'lieferando') {
            images = await extractLieferandoImages(page, dishNames);
          } else if (platform.platform === 'just-eat') {
            images = await extractJustEatImages(page, dishNames);
          }

          if (images.size > 0) {
            console.log(`   Found ${images.size} images`);

            for (const dish of venueDishes) {
              const imageUrl = images.get(dish.name);
              if (imageUrl && await isValidImageUrl(imageUrl)) {
                console.log(`     ✓ ${dish.name}`);

                if (EXECUTE) {
                  await db.collection('dishes').doc(dish.id).update({
                    image_url: imageUrl
                  });
                }

                totalUpdated++;
                platformStats[platform.platform].success++;
              } else {
                console.log(`     ✗ ${dish.name} - no match or invalid URL`);
                totalFailed++;
                platformStats[platform.platform].failed++;
              }
            }

            break; // Got images from this platform, no need to try others
          } else {
            console.log(`   No images found on ${platform.platform}`);
            totalFailed += venueDishes.length;
            platformStats[platform.platform].failed += venueDishes.length;
          }

        } catch (err) {
          console.log(`   Error processing ${platform.platform}: ${err.message}`);
          totalFailed += venueDishes.length;
          platformStats[platform.platform].failed += venueDishes.length;
        } finally {
          await page.close();
        }

        // Rate limit between requests
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
      }
    }

    console.log('\n\n=== SUMMARY ===');
    console.log(`Images ${EXECUTE ? 'updated' : 'found'}: ${totalUpdated}`);
    console.log(`Failed to match: ${totalFailed}`);
    console.log(`Venues skipped: ${totalSkipped}`);
    console.log('\nPlatform Breakdown:');
    for (const [platform, stats] of Object.entries(platformStats)) {
      if (stats.success > 0 || stats.failed > 0) {
        console.log(`  ${platform}: ${stats.success} success, ${stats.failed} failed`);
      }
    }

    if (!EXECUTE && totalUpdated > 0) {
      console.log('\n💡 Run with --execute to update the database');
    }

  } finally {
    await browser.close();
  }
}

scrapeDishImages()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
