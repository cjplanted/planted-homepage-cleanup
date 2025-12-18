#!/usr/bin/env node
/**
 * Fetch Dish Images from Uber Eats Only
 * Uber Eats is the most reliable for HTTP-based scraping
 *
 * Usage:
 *   node fetch-ubereats-dish-images.cjs                    # Dry run
 *   node fetch-ubereats-dish-images.cjs --execute         # Update database
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const https = require('https');

// Initialize Firebase Admin
initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

const EXECUTE = process.argv.includes('--execute');

// Fetch page with retries
function fetchPage(url, retries = 3) {
  return new Promise((resolve, reject) => {
    const attemptFetch = (attempt) => {
      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: 20000
      };

      https.get(url, options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          return fetchPage(redirectUrl, retries - 1).then(resolve).catch(reject);
        }

        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', (err) => {
        if (attempt < retries) {
          setTimeout(() => attemptFetch(attempt + 1), 1000);
        } else {
          reject(err);
        }
      });
    };

    attemptFetch(1);
  });
}

// Normalize name for matching
function normalizeName(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9äöüß]/g, '')
    .replace(/planted/g, '')
    .replace(/chicken/g, '')
    .replace(/kebab/g, '')
    .replace(/kebap/g, '');
}

// Calculate similarity
function calculateSimilarity(name1, name2) {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  if (n1 === n2) return 1;
  if (n1.includes(n2) || n2.includes(n1)) return 0.8;

  const words1 = name1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const words2 = name2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const matching = words1.filter(w => words2.includes(w)).length;

  return matching / Math.max(words1.length, words2.length);
}

// Extract images from Uber Eats
function extractUberEatsImages(html, dishNames) {
  const images = new Map();
  const allMenuItems = [];

  // Extract from __NEXT_DATA__
  const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]);
      const findMenuItems = (obj, items = []) => {
        if (!obj || typeof obj !== 'object') return items;

        if (obj.title && obj.imageUrl) {
          items.push({ name: obj.title, imageUrl: obj.imageUrl });
        }
        if (obj.name && obj.imageUrl) {
          items.push({ name: obj.name, imageUrl: obj.imageUrl });
        }

        for (const key of Object.keys(obj)) {
          findMenuItems(obj[key], items);
        }
        return items;
      };

      allMenuItems.push(...findMenuItems(data));
    } catch (e) {
      // Fall through
    }
  }

  // Also extract CDN images as fallback
  const imgPattern = /https:\/\/tb-static\.uber\.com\/prod\/image-proc\/processed_images\/[^"'\s]+/g;
  const cdnImages = [...new Set(html.match(imgPattern) || [])];

  // Match dishes to menu items
  for (const dishName of dishNames) {
    let bestMatch = null;
    let bestScore = 0;

    for (const item of allMenuItems) {
      const score = calculateSimilarity(dishName, item.name);
      if (score > bestScore && score > 0.5) {
        bestScore = score;
        bestMatch = item.imageUrl;
      }
    }

    if (bestMatch) {
      images.set(dishName, { url: bestMatch, matched: true });
    }
  }

  // Use CDN images for unmatched dishes
  let cdnIndex = 0;
  for (const dishName of dishNames) {
    if (!images.has(dishName) && cdnIndex < cdnImages.length) {
      images.set(dishName, { url: cdnImages[cdnIndex], matched: false });
      cdnIndex++;
    }
  }

  return images;
}

async function main() {
  console.log('\n=== FETCH UBER EATS DISH IMAGES ===\n');
  console.log(`Mode: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`);
  console.log('');

  // Get all active venues
  const venuesSnap = await db.collection('venues')
    .where('status', '==', 'active')
    .get();

  const allVenues = venuesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Get all dishes
  const dishesSnap = await db.collection('dishes').get();
  const allDishes = dishesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Find dishes without images
  const dishesWithoutImages = allDishes.filter(d => !d.image_url);
  console.log(`Total dishes without images: ${dishesWithoutImages.length}`);

  // Group dishes by venue
  const dishesByVenue = new Map();
  for (const dish of dishesWithoutImages) {
    if (!dishesByVenue.has(dish.venue_id)) {
      dishesByVenue.set(dish.venue_id, []);
    }
    dishesByVenue.get(dish.venue_id).push(dish);
  }

  // Find venues with Uber Eats URLs
  const venuesWithUberEats = allVenues.filter(v => {
    const platforms = v.delivery_platforms || [];
    return platforms.some(p => p.url && p.url.includes('ubereats.com'));
  });

  // Filter to only venues with dishes needing images
  const targetVenues = venuesWithUberEats.filter(v => dishesByVenue.has(v.id));
  console.log(`Venues with Uber Eats and dishes needing images: ${targetVenues.length}`);

  let totalDishes = 0;
  let imagesFound = 0;
  let imagesFailed = 0;

  for (const venue of targetVenues) {
    const venueDishes = dishesByVenue.get(venue.id) || [];
    if (venueDishes.length === 0) continue;

    totalDishes += venueDishes.length;

    const platforms = venue.delivery_platforms || [];
    const uberEatsPlatform = platforms.find(p => p.url && p.url.includes('ubereats.com'));
    if (!uberEatsPlatform) continue;

    console.log(`\n[${venue.name}] (${venueDishes.length} dishes)`);
    console.log(`   URL: ${uberEatsPlatform.url.substring(0, 70)}...`);

    try {
      const html = await fetchPage(uberEatsPlatform.url);
      const dishNames = venueDishes.map(d => d.name);
      const images = extractUberEatsImages(html, dishNames);

      if (images.size > 0) {
        console.log(`   Found ${images.size} images`);

        for (const dish of venueDishes) {
          const imageData = images.get(dish.name);
          if (imageData) {
            const matchType = imageData.matched ? 'MATCH' : 'CDN';
            console.log(`     [${matchType}] ${dish.name}`);
            imagesFound++;

            if (EXECUTE) {
              try {
                await db.collection('dishes').doc(dish.id).update({
                  image_url: imageData.url,
                  image_source: 'uber-eats',
                  updated_at: new Date()
                });
              } catch (err) {
                console.log(`         ERROR: ${err.message}`);
              }
            }
          } else {
            console.log(`     [MISS] ${dish.name}`);
            imagesFailed++;
          }
        }
      } else {
        console.log(`   No images found`);
        imagesFailed += venueDishes.length;
      }
    } catch (err) {
      console.log(`   Error: ${err.message}`);
      imagesFailed += venueDishes.length;
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n\n=== SUMMARY ===');
  console.log(`Total dishes processed: ${totalDishes}`);
  console.log(`Images ${EXECUTE ? 'updated' : 'found'}: ${imagesFound} (${Math.round(imagesFound / totalDishes * 100) || 0}%)`);
  console.log(`Failed: ${imagesFailed}`);

  if (!EXECUTE && imagesFound > 0) {
    console.log('\nRun with --execute to update the database');
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
