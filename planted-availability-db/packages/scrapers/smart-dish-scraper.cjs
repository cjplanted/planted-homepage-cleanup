#!/usr/bin/env node
/**
 * Smart Dish Scraper with Fuzzy Matching
 *
 * A generic scraper that works for ALL venues and platforms.
 * Uses Levenshtein distance for fuzzy matching dish names.
 * Updates both image_url AND dish name to match platform.
 *
 * Usage:
 *   node smart-dish-scraper.cjs                    # Dry run - show matches
 *   node smart-dish-scraper.cjs --execute          # Apply changes
 *   node smart-dish-scraper.cjs --venue=<id>       # Single venue
 *   node smart-dish-scraper.cjs --platform=<name>  # Single platform
 *   node smart-dish-scraper.cjs --country=<code>   # Filter by country
 *   node smart-dish-scraper.cjs --city=<name>      # Filter by city
 *   node smart-dish-scraper.cjs --limit=<n>        # Limit venues
 *   node smart-dish-scraper.cjs --threshold=<n>    # Match threshold (0-1, default 0.4)
 *   node smart-dish-scraper.cjs --planted-only     # Only match dishes with planted keywords
 *   node smart-dish-scraper.cjs --strict           # Require planted keyword match (dish has planted -> menu must have planted)
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const https = require('https');
const http = require('http');

// Initialize Firebase
initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

// Parse CLI arguments
const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const VENUE_ID = args.find(a => a.startsWith('--venue='))?.split('=')[1];
const PLATFORM = args.find(a => a.startsWith('--platform='))?.split('=')[1];
const COUNTRY = args.find(a => a.startsWith('--country='))?.split('=')[1];
const CITY = args.find(a => a.startsWith('--city='))?.split('=')[1];
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');
const THRESHOLD = parseFloat(args.find(a => a.startsWith('--threshold='))?.split('=')[1] || '0.4');
const PLANTED_ONLY = args.includes('--planted-only');
const STRICT = args.includes('--strict');

// User agents for rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];
let uaIndex = 0;
function getNextUA() {
  const ua = USER_AGENTS[uaIndex];
  uaIndex = (uaIndex + 1) % USER_AGENTS.length;
  return ua;
}

// =============================================================================
// LEVENSHTEIN DISTANCE & FUZZY MATCHING
// =============================================================================

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshtein(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score (0-1) between two strings
 */
function similarity(a, b) {
  const aLower = a.toLowerCase().replace(/[^a-z0-9]/g, '');
  const bLower = b.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (aLower === bLower) return 1;
  if (aLower.length === 0 || bLower.length === 0) return 0;

  const distance = levenshtein(aLower, bLower);
  const maxLen = Math.max(aLower.length, bLower.length);
  return 1 - (distance / maxLen);
}

/**
 * Extract keywords from a dish name
 */
function extractKeywords(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !['mit', 'und', 'the', 'and', 'with', 'von', 'big', 'small', 'menu'].includes(w));
}

/**
 * Calculate keyword overlap score
 */
function keywordScore(a, b) {
  const kwA = extractKeywords(a);
  const kwB = extractKeywords(b);

  if (kwA.length === 0 || kwB.length === 0) return 0;

  let matches = 0;
  for (const kw of kwA) {
    if (kwB.some(k => k.includes(kw) || kw.includes(k))) {
      matches++;
    }
  }

  return matches / Math.max(kwA.length, kwB.length);
}

/**
 * Check if a name contains planted-related keywords
 */
function hasPlantedKeyword(name) {
  const plantedKeywords = ['planted', 'plant-based', 'vegan', 'veggie', 'pflanzlich'];
  return plantedKeywords.some(kw => name.toLowerCase().includes(kw));
}

/**
 * Find best matching menu item for a dish
 * Returns { menuItem, score, matchType } or null
 */
function findBestMatch(dishName, menuItems, threshold = THRESHOLD) {
  let bestMatch = null;
  let bestScore = 0;
  let matchType = '';

  const dishHasPlanted = hasPlantedKeyword(dishName);

  // If --planted-only mode, filter menu items to only those with planted keywords
  let candidateItems = menuItems;
  if (PLANTED_ONLY) {
    candidateItems = menuItems.filter(item => hasPlantedKeyword(item.name));
    if (candidateItems.length === 0) {
      return null; // No planted items on this platform
    }
  }

  for (const item of candidateItems) {
    const itemHasPlanted = hasPlantedKeyword(item.name);

    // In strict mode, require planted keywords to match
    if (STRICT && dishHasPlanted !== itemHasPlanted) {
      continue;
    }

    // Strategy 1: Direct similarity
    const simScore = similarity(dishName, item.name);
    if (simScore > bestScore) {
      bestScore = simScore;
      bestMatch = item;
      matchType = 'similarity';
    }

    // Strategy 2: Keyword matching
    const kwScore = keywordScore(dishName, item.name);
    if (kwScore > bestScore) {
      bestScore = kwScore;
      bestMatch = item;
      matchType = 'keywords';
    }

    // Strategy 3: Both have planted keywords - strong boost
    if (dishHasPlanted && itemHasPlanted) {
      // Calculate planted-specific similarity (ignoring common words)
      const plantedSim = similarity(
        dishName.replace(/chicken|salad|bowl|wrap/gi, ''),
        item.name.replace(/chicken|salad|bowl|wrap/gi, '')
      );
      const boostedScore = Math.max(simScore, kwScore) + 0.25;
      if (boostedScore > bestScore) {
        bestScore = boostedScore;
        bestMatch = item;
        matchType = 'planted-match';
      }
    }
  }

  if (bestScore >= threshold && bestMatch) {
    return { menuItem: bestMatch, score: bestScore, matchType };
  }

  return null;
}

// =============================================================================
// HTTP FETCHING (for SSR pages like Uber Eats, Wolt)
// =============================================================================

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, {
      headers: {
        'User-Agent': getNextUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject);
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// =============================================================================
// PLATFORM EXTRACTORS
// =============================================================================

/**
 * Extract menu items from Uber Eats HTML (SSR page with __NEXT_DATA__)
 */
function extractUberEats(html) {
  const items = [];

  try {
    // Try __NEXT_DATA__ JSON
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
    if (nextDataMatch) {
      const data = JSON.parse(nextDataMatch[1]);
      const catalog = data?.props?.pageProps?.meta?.catalog;

      if (catalog?.sections) {
        for (const section of catalog.sections) {
          if (section.items) {
            for (const item of section.items) {
              if (item.title && item.imageUrl) {
                items.push({
                  name: item.title,
                  imageUrl: item.imageUrl,
                  price: item.price?.amount
                });
              }
            }
          }
        }
      }
    }

    // Fallback: regex for image URLs with dish context
    if (items.length === 0) {
      const pattern = /"title"\s*:\s*"([^"]+)"[^}]*"imageUrl"\s*:\s*"([^"]+)"/g;
      let match;
      while ((match = pattern.exec(html)) !== null) {
        items.push({ name: match[1], imageUrl: match[2] });
      }
    }
  } catch (e) {
    // Ignore parsing errors
  }

  return items;
}

/**
 * Extract menu items from Wolt HTML (SSR page)
 */
function extractWolt(html) {
  const items = [];

  try {
    // Wolt uses JSON data embedded in the page
    const jsonPattern = /"name"\s*:\s*"([^"]{3,50})"[^}]*"image"\s*:\s*"([^"]+cloudinary[^"]+)"/g;
    let match;
    while ((match = jsonPattern.exec(html)) !== null) {
      items.push({ name: match[1], imageUrl: match[2] });
    }

    // Alternative pattern
    const altPattern = /item[^{]*\{[^}]*"name"\s*:\s*"([^"]+)"[^}]*"(?:image|photo)(?:Url)?"\s*:\s*"([^"]+)"/gi;
    while ((match = altPattern.exec(html)) !== null) {
      if (!items.some(i => i.name === match[1])) {
        items.push({ name: match[1], imageUrl: match[2] });
      }
    }
  } catch (e) {
    // Ignore parsing errors
  }

  return items;
}

/**
 * Extract menu items using Puppeteer (for JS-rendered pages)
 */
async function extractWithPuppeteer(url, platform) {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    console.log('    Puppeteer not available, skipping JS-rendered page');
    return [];
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(getNextUA());
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for JS to render
    await new Promise(r => setTimeout(r, 5000));

    // Scroll to load lazy images
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 300;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight || totalHeight > 5000) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    await new Promise(r => setTimeout(r, 2000));

    // Extract menu items
    const items = await page.evaluate(() => {
      const results = [];
      const seen = new Set();

      // Look for containers that might hold menu items
      const containers = document.querySelectorAll(
        'article, [role="listitem"], li, button, [class*="item"], [class*="product"], [class*="meal"], [class*="dish"]'
      );

      containers.forEach(container => {
        // Find name
        let name = '';
        const nameEl = container.querySelector('h1, h2, h3, h4, h5, h6, [class*="name"], [class*="title"], p');
        if (nameEl) {
          name = nameEl.textContent.trim().split('\n')[0].trim();
        }

        // Find image
        let imageUrl = '';
        const img = container.querySelector('img[src], img[data-src]');
        if (img) {
          imageUrl = img.src || img.dataset.src || '';
        }

        // Validate and add
        if (name && imageUrl && name.length > 2 && name.length < 100 && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          results.push({ name, imageUrl });
        }
      });

      return results;
    });

    return items;
  } finally {
    await browser.close();
  }
}

// =============================================================================
// MAIN SCRAPER
// =============================================================================

/**
 * Scrape menu items from a platform URL
 */
async function scrapeMenuItems(url, platform) {
  // Determine if platform needs Puppeteer (JS-rendered) or HTTP (SSR)
  const jsRenderedPlatforms = ['lieferando', 'just-eat', 'eat.ch'];
  const ssrPlatforms = ['uber-eats', 'wolt'];

  const isJsRendered = jsRenderedPlatforms.some(p => platform.includes(p) || url.includes(p));

  if (isJsRendered) {
    return await extractWithPuppeteer(url, platform);
  }

  // HTTP-based extraction
  try {
    const html = await fetchUrl(url);

    if (platform.includes('uber-eats') || url.includes('ubereats')) {
      return extractUberEats(html);
    } else if (platform.includes('wolt') || url.includes('wolt')) {
      return extractWolt(html);
    }

    // Generic fallback
    return [];
  } catch (e) {
    console.log('    HTTP fetch error: ' + e.message);
    return [];
  }
}

/**
 * Process a single venue
 */
async function processVenue(venue, dishes, stats) {
  const platforms = venue.delivery_platforms || [];
  if (platforms.length === 0) return;

  const dishesNeedingImages = dishes.filter(d => !d.image_url);
  if (dishesNeedingImages.length === 0) return;

  console.log('\n' + '─'.repeat(70));
  console.log('📍 ' + venue.name);
  console.log('   ID: ' + venue.id);
  console.log('   Location: ' + (venue.address?.city || 'Unknown') + ', ' + (venue.address?.country || ''));
  console.log('   Dishes needing images: ' + dishesNeedingImages.length);

  // Filter platforms if specified
  let targetPlatforms = platforms.filter(p => p.url);
  if (PLATFORM) {
    targetPlatforms = targetPlatforms.filter(p => p.platform === PLATFORM || p.url.includes(PLATFORM));
  }

  if (targetPlatforms.length === 0) {
    console.log('   ⚠️  No matching platforms');
    stats.skipped++;
    return;
  }

  // Try each platform
  for (const platform of targetPlatforms) {
    console.log('\n   Platform: ' + platform.platform + ' - ' + platform.url);

    const menuItems = await scrapeMenuItems(platform.url, platform.platform);
    console.log('   Menu items found: ' + menuItems.length);

    if (menuItems.length === 0) {
      stats.platformsFailed++;
      continue;
    }

    // Show sample menu items
    if (menuItems.length > 0 && menuItems.length <= 20) {
      console.log('   Available: ' + menuItems.map(i => '"' + i.name + '"').slice(0, 5).join(', ') + (menuItems.length > 5 ? '...' : ''));
    }

    // Match each dish
    let matchedThisVenue = 0;

    for (const dish of dishesNeedingImages) {
      const match = findBestMatch(dish.name, menuItems, THRESHOLD);

      if (match) {
        const { menuItem, score, matchType } = match;

        console.log('\n   ✓ MATCH [' + (score * 100).toFixed(0) + '% ' + matchType + ']');
        console.log('     DB: "' + dish.name + '"');
        console.log('     Platform: "' + menuItem.name + '"');

        if (EXECUTE) {
          // Update both image_url and name
          const updates = {
            image_url: menuItem.imageUrl,
            name: menuItem.name,  // Update name to match platform
            platform_source: platform.platform,
            updated_at: new Date()
          };

          await db.collection('dishes').doc(dish.id).update(updates);
          console.log('     → Updated in database');
        }

        stats.matched++;
        matchedThisVenue++;
      } else {
        console.log('\n   ✗ NO MATCH: "' + dish.name + '"');
        stats.unmatched++;
        stats.unmatchedDishes.push({
          dishId: dish.id,
          dishName: dish.name,
          venueName: venue.name,
          venueId: venue.id,
          platform: platform.platform
        });
      }
    }

    if (matchedThisVenue > 0) {
      stats.venuesProcessed++;
      break; // Got matches from this platform, no need to try others
    }

    // Rate limit between platforms
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
  }
}

/**
 * Main function
 */
async function main() {
  console.log('\n' + '═'.repeat(70));
  console.log('SMART DISH SCRAPER WITH FUZZY MATCHING');
  console.log('═'.repeat(70));
  console.log('Mode: ' + (EXECUTE ? '🔥 EXECUTE' : '🔍 DRY RUN'));
  console.log('Match threshold: ' + (THRESHOLD * 100) + '%');
  if (VENUE_ID) console.log('Venue: ' + VENUE_ID);
  if (PLATFORM) console.log('Platform: ' + PLATFORM);
  if (COUNTRY) console.log('Country: ' + COUNTRY);
  if (CITY) console.log('City: ' + CITY);
  if (LIMIT) console.log('Limit: ' + LIMIT);
  if (PLANTED_ONLY) console.log('Mode: Planted-only (only match planted items)');
  if (STRICT) console.log('Mode: Strict (require planted keywords to match)');
  console.log('');

  // Fetch venues
  let query = db.collection('venues').where('status', '==', 'active');
  const venuesSnap = await query.get();
  let venues = venuesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Apply filters
  if (VENUE_ID) {
    venues = venues.filter(v => v.id === VENUE_ID);
  }
  if (COUNTRY) {
    venues = venues.filter(v => v.address?.country === COUNTRY);
  }
  if (CITY) {
    venues = venues.filter(v => v.address?.city?.toLowerCase().includes(CITY.toLowerCase()));
  }
  if (LIMIT) {
    venues = venues.slice(0, LIMIT);
  }

  console.log('Venues to process: ' + venues.length);

  // Fetch all dishes
  const dishesSnap = await db.collection('dishes').get();
  const allDishes = dishesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Group dishes by venue
  const dishesByVenue = {};
  for (const dish of allDishes) {
    if (!dishesByVenue[dish.venue_id]) {
      dishesByVenue[dish.venue_id] = [];
    }
    dishesByVenue[dish.venue_id].push(dish);
  }

  // Stats
  const stats = {
    matched: 0,
    unmatched: 0,
    skipped: 0,
    venuesProcessed: 0,
    platformsFailed: 0,
    unmatchedDishes: []
  };

  // Process each venue
  for (const venue of venues) {
    const dishes = dishesByVenue[venue.id] || [];
    if (dishes.length === 0) continue;

    await processVenue(venue, dishes, stats);

    // Rate limit between venues
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
  }

  // Summary
  console.log('\n\n' + '═'.repeat(70));
  console.log('SUMMARY');
  console.log('═'.repeat(70));
  console.log('Venues processed: ' + stats.venuesProcessed);
  console.log('Dishes matched: ' + stats.matched);
  console.log('Dishes unmatched: ' + stats.unmatched);
  console.log('Venues skipped: ' + stats.skipped);
  console.log('Platform fetch failures: ' + stats.platformsFailed);

  if (stats.unmatchedDishes.length > 0) {
    console.log('\n\nUNMATCHED DISHES (for manual review):');
    console.log('─'.repeat(70));

    // Group by venue
    const byVenue = {};
    for (const d of stats.unmatchedDishes) {
      if (!byVenue[d.venueName]) {
        byVenue[d.venueName] = [];
      }
      byVenue[d.venueName].push(d);
    }

    for (const [venueName, dishes] of Object.entries(byVenue)) {
      console.log('\n' + venueName + ':');
      dishes.forEach(d => {
        console.log('  - "' + d.dishName + '" (ID: ' + d.dishId + ')');
      });
    }
  }

  if (!EXECUTE && stats.matched > 0) {
    console.log('\n\n💡 Run with --execute to apply changes');
  }

  console.log('\n');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
