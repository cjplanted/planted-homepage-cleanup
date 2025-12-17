#!/usr/bin/env node
/**
 * Fetch Dish Images for ALL Cities
 * Comprehensive script to find and update dish images from delivery platforms
 *
 * Usage:
 *   node fetch-all-dish-images.cjs                    # Dry run - show analysis
 *   node fetch-all-dish-images.cjs --execute         # Actually fetch and update images
 *   node fetch-all-dish-images.cjs --city=Berlin     # Process specific city only
 *   node fetch-all-dish-images.cjs --venue=<id>      # Process specific venue only
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const https = require('https');
const http = require('http');

// Initialize Firebase Admin
initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

const EXECUTE = process.argv.includes('--execute');
const cityArg = process.argv.find(a => a.startsWith('--city='));
const SPECIFIC_CITY = cityArg ? cityArg.split('=')[1].toLowerCase() : null;
const venueArg = process.argv.find(a => a.startsWith('--venue='));
const SPECIFIC_VENUE = venueArg ? venueArg.split('=')[1] : null;

// City coordinates for filtering
const CITY_COORDS = {
  zurich: { country: 'CH', lat: { min: 47.3, max: 47.5 }, lng: { min: 8.4, max: 8.7 } },
  berlin: { country: 'DE', lat: { min: 52.3, max: 52.7 }, lng: { min: 13.2, max: 13.6 } },
  munich: { country: 'DE', lat: { min: 48.0, max: 48.3 }, lng: { min: 11.4, max: 11.7 } },
  vienna: { country: 'AT', lat: { min: 48.1, max: 48.3 }, lng: { min: 16.2, max: 16.5 } },
  hamburg: { country: 'DE', lat: { min: 53.4, max: 53.7 }, lng: { min: 9.8, max: 10.2 } },
};

// Fetch page content with retries
function fetchPage(url, retries = 3) {
  return new Promise((resolve, reject) => {
    const attemptFetch = (attempt) => {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: 15000
      };

      const req = protocol.get(url, options, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          return fetchPage(redirectUrl, retries - 1).then(resolve).catch(reject);
        }

        if (res.statusCode >= 400) {
          if (attempt < retries) {
            setTimeout(() => attemptFetch(attempt + 1), 1000 * attempt);
            return;
          }
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });

      req.on('error', (err) => {
        if (attempt < retries) {
          setTimeout(() => attemptFetch(attempt + 1), 1000 * attempt);
        } else {
          reject(err);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        if (attempt < retries) {
          attemptFetch(attempt + 1);
        } else {
          reject(new Error('Request timeout'));
        }
      });
    };

    attemptFetch(1);
  });
}

// Normalize dish name for matching
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]/g, '')
    .replace(/planted/g, '')
    .replace(/chicken/g, '')
    .replace(/kebab/g, '')
    .replace(/kebap/g, '');
}

// Calculate similarity between two names
function calculateSimilarity(name1, name2) {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  if (n1 === n2) return 1;
  if (n1.includes(n2) || n2.includes(n1)) return 0.8;

  // Count matching words
  const words1 = name1.toLowerCase().split(/\s+/);
  const words2 = name2.toLowerCase().split(/\s+/);
  const matchingWords = words1.filter(w => words2.includes(w) && w.length > 2).length;
  const totalWords = Math.max(words1.length, words2.length);

  return matchingWords / totalWords;
}

// Extract dish images from Uber Eats page
function extractUberEatsImages(html, dishNames) {
  const images = new Map();
  const allMenuItems = [];

  // Try to extract from __NEXT_DATA__
  const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]);
      const findMenuItems = (obj, items = []) => {
        if (!obj || typeof obj !== 'object') return items;

        // Look for menu items with images
        if (obj.title && obj.imageUrl) {
          items.push({ name: obj.title, imageUrl: obj.imageUrl });
        }
        if (obj.name && obj.imageUrl) {
          items.push({ name: obj.name, imageUrl: obj.imageUrl });
        }
        if (obj.itemDescription && obj.imageUrl) {
          items.push({ name: obj.itemDescription, imageUrl: obj.imageUrl });
        }

        for (const key of Object.keys(obj)) {
          findMenuItems(obj[key], items);
        }
        return items;
      };

      const menuItems = findMenuItems(data);
      allMenuItems.push(...menuItems);
    } catch (e) {
      // Fall through to regex extraction
    }
  }

  // Also try regex extraction for Uber Eats CDN images
  const imgPattern = /https:\/\/tb-static\.uber\.com\/prod\/image-proc\/processed_images\/[^"'\s]+/g;
  const cdnImages = [...new Set(html.match(imgPattern) || [])];

  // Match dishes to images
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
      images.set(dishName, bestMatch);
    }
  }

  // If we couldn't match by name but have CDN images, use them as fallback
  if (images.size === 0 && cdnImages.length > 0) {
    let i = 0;
    for (const dishName of dishNames) {
      if (i < cdnImages.length) {
        images.set(dishName, cdnImages[i]);
        i++;
      }
    }
  }

  return images;
}

// Extract dish images from Wolt page
function extractWoltImages(html, dishNames) {
  const images = new Map();
  const allMenuItems = [];

  // Wolt uses __NEXT_DATA__
  const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]);
      const findMenuItems = (obj, items = []) => {
        if (!obj || typeof obj !== 'object') return items;

        if (obj.name && obj.image) {
          items.push({ name: obj.name, imageUrl: obj.image });
        }
        if (obj.title && obj.image) {
          items.push({ name: obj.title, imageUrl: obj.image });
        }

        for (const key of Object.keys(obj)) {
          findMenuItems(obj[key], items);
        }
        return items;
      };

      const menuItems = findMenuItems(data);
      allMenuItems.push(...menuItems);
    } catch (e) {
      // Continue
    }
  }

  // Match dishes to images
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
      images.set(dishName, bestMatch);
    }
  }

  return images;
}

// Extract dish images from Just Eat / Lieferando page
function extractJustEatImages(html, dishNames) {
  const images = new Map();
  const allMenuItems = [];

  // Try JSON-LD
  const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([^<]+)<\/script>/g);
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1]);
      if (data.hasMenu && data.hasMenu.hasMenuSection) {
        for (const section of data.hasMenu.hasMenuSection) {
          if (section.hasMenuItem) {
            for (const item of section.hasMenuItem) {
              if (item.name && item.image) {
                allMenuItems.push({ name: item.name, imageUrl: item.image });
              }
            }
          }
        }
      }
    } catch (e) {
      // Continue
    }
  }

  // Match dishes to images
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
      images.set(dishName, bestMatch);
    }
  }

  // Fallback: look for cloudinary or just-eat CDN images
  if (images.size === 0) {
    const imgPattern = /https:\/\/[^"'\s]*(?:cloudinary|jet\.com|just-eat)[^"'\s]*\.(?:jpg|jpeg|png|webp)[^"'\s]*/gi;
    const cdnImages = [...new Set(html.match(imgPattern) || [])];

    let i = 0;
    for (const dishName of dishNames) {
      if (!images.has(dishName) && i < cdnImages.length) {
        images.set(dishName, cdnImages[i]);
        i++;
      }
    }
  }

  return images;
}

// Generic image extraction
function extractGenericImages(html, dishNames) {
  const images = new Map();

  // Try to find any food-related images
  const imgPattern = /https:\/\/[^"'\s]*\.(?:jpg|jpeg|png|webp)[^"'\s]*/gi;
  const allImages = [...new Set(html.match(imgPattern) || [])]
    .filter(url =>
      !url.includes('logo') &&
      !url.includes('icon') &&
      !url.includes('badge') &&
      !url.includes('avatar') &&
      (url.includes('food') || url.includes('menu') || url.includes('dish') ||
       url.includes('product') || url.includes('cloudinary') || url.includes('cdn'))
    );

  let i = 0;
  for (const dishName of dishNames) {
    if (i < allImages.length) {
      images.set(dishName, allImages[i]);
      i++;
    }
  }

  return images;
}

// Detect platform from URL
function detectPlatform(url) {
  if (url.includes('ubereats.com')) return 'uber-eats';
  if (url.includes('wolt.com')) return 'wolt';
  if (url.includes('lieferando') || url.includes('just-eat') || url.includes('eat.ch')) return 'just-eat';
  if (url.includes('deliveroo')) return 'deliveroo';
  return 'unknown';
}

// Check if venue is in a city
function isVenueInCity(venue, cityName) {
  const coords = CITY_COORDS[cityName];
  if (!coords) return false;

  if (venue.address?.country !== coords.country) return false;

  const lat = venue.location?.latitude || venue.location?._latitude || 0;
  const lng = venue.location?.longitude || venue.location?._longitude || 0;

  return lat >= coords.lat.min && lat <= coords.lat.max &&
         lng >= coords.lng.min && lng <= coords.lng.max;
}

// Main function
async function fetchAllDishImages() {
  console.log('\n=== FETCH ALL DISH IMAGES ===\n');
  console.log(`Mode: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`);
  if (SPECIFIC_CITY) console.log(`City filter: ${SPECIFIC_CITY}`);
  if (SPECIFIC_VENUE) console.log(`Venue filter: ${SPECIFIC_VENUE}`);
  console.log('');

  // Get all active venues
  const venuesSnap = await db.collection('venues')
    .where('status', '==', 'active')
    .get();

  let allVenues = venuesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`Total active venues: ${allVenues.length}`);

  // Get all dishes
  const dishesSnap = await db.collection('dishes').get();
  const allDishes = dishesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`Total dishes: ${allDishes.length}`);

  // Filter dishes without images
  const dishesWithoutImages = allDishes.filter(d => !d.image_url);
  console.log(`Dishes without images: ${dishesWithoutImages.length}`);

  // Filter by city if specified
  if (SPECIFIC_CITY) {
    allVenues = allVenues.filter(v => isVenueInCity(v, SPECIFIC_CITY));
    console.log(`Venues in ${SPECIFIC_CITY}: ${allVenues.length}`);
  }

  if (SPECIFIC_VENUE) {
    allVenues = allVenues.filter(v => v.id === SPECIFIC_VENUE);
    console.log(`Specific venue: ${allVenues.length}`);
  }

  // Group dishes by venue
  const dishesByVenue = new Map();
  for (const dish of dishesWithoutImages) {
    if (!dishesByVenue.has(dish.venue_id)) {
      dishesByVenue.set(dish.venue_id, []);
    }
    dishesByVenue.get(dish.venue_id).push(dish);
  }

  // Process venues with missing images
  const venuesWithMissingImages = allVenues.filter(v => dishesByVenue.has(v.id));
  console.log(`\nVenues with dishes needing images: ${venuesWithMissingImages.length}\n`);

  // Stats tracking
  const stats = {
    totalVenues: venuesWithMissingImages.length,
    totalDishes: 0,
    imagesFound: 0,
    imagesFailed: 0,
    byPlatform: {},
    byCity: {},
  };

  // Process each venue
  for (const venue of venuesWithMissingImages) {
    const venueDishes = dishesByVenue.get(venue.id) || [];
    if (venueDishes.length === 0) continue;

    stats.totalDishes += venueDishes.length;

    // Determine city
    let cityName = 'unknown';
    for (const [city, coords] of Object.entries(CITY_COORDS)) {
      if (isVenueInCity(venue, city)) {
        cityName = city;
        break;
      }
    }
    if (!stats.byCity[cityName]) {
      stats.byCity[cityName] = { total: 0, found: 0 };
    }
    stats.byCity[cityName].total += venueDishes.length;

    const platforms = venue.delivery_platforms || [];
    if (platforms.length === 0) {
      console.log(`\n[SKIP] ${venue.name} - No delivery platforms (${venueDishes.length} dishes)`);
      stats.imagesFailed += venueDishes.length;
      continue;
    }

    console.log(`\n[${cityName.toUpperCase()}] ${venue.name} (${venueDishes.length} dishes need images)`);

    // Try each platform
    let imagesFound = false;
    for (const platform of platforms) {
      if (!platform.url) continue;

      const platformType = detectPlatform(platform.url);
      if (!stats.byPlatform[platformType]) {
        stats.byPlatform[platformType] = { tried: 0, found: 0 };
      }
      stats.byPlatform[platformType].tried++;

      console.log(`   Trying ${platform.platform || platformType}: ${platform.url.substring(0, 60)}...`);

      try {
        const html = await fetchPage(platform.url);
        const dishNames = venueDishes.map(d => d.name);

        let images = new Map();
        switch (platformType) {
          case 'uber-eats':
            images = extractUberEatsImages(html, dishNames);
            break;
          case 'wolt':
            images = extractWoltImages(html, dishNames);
            break;
          case 'just-eat':
            images = extractJustEatImages(html, dishNames);
            break;
          default:
            images = extractGenericImages(html, dishNames);
        }

        if (images.size > 0) {
          console.log(`   Found ${images.size} images`);
          stats.byPlatform[platformType].found += images.size;

          for (const dish of venueDishes) {
            const imageUrl = images.get(dish.name);
            if (imageUrl) {
              console.log(`     [OK] ${dish.name}`);
              stats.imagesFound++;
              stats.byCity[cityName].found++;

              if (EXECUTE) {
                try {
                  await db.collection('dishes').doc(dish.id).update({
                    image_url: imageUrl,
                    image_source: platformType,
                    updated_at: new Date()
                  });
                  console.log(`         Updated in database`);
                } catch (err) {
                  console.log(`         ERROR updating: ${err.message}`);
                }
              }
            } else {
              console.log(`     [--] ${dish.name} - no match found`);
              stats.imagesFailed++;
            }
          }

          imagesFound = true;
          break; // Got images, no need to try other platforms
        } else {
          console.log(`   No images extracted from ${platformType}`);
        }
      } catch (err) {
        console.log(`   Error fetching ${platform.platform || platformType}: ${err.message}`);
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 1500));
    }

    if (!imagesFound) {
      stats.imagesFailed += venueDishes.length;
      for (const dish of venueDishes) {
        console.log(`     [!!] ${dish.name} - no platform images available`);
      }
    }
  }

  // Print summary
  console.log('\n\n=== SUMMARY ===\n');
  console.log(`Total venues processed: ${stats.totalVenues}`);
  console.log(`Total dishes needing images: ${stats.totalDishes}`);
  console.log(`Images ${EXECUTE ? 'updated' : 'found'}: ${stats.imagesFound} (${Math.round(stats.imagesFound / stats.totalDishes * 100)}%)`);
  console.log(`Images not found: ${stats.imagesFailed}`);

  console.log('\nBy City:');
  for (const [city, data] of Object.entries(stats.byCity)) {
    console.log(`  ${city}: ${data.found}/${data.total} (${Math.round(data.found / data.total * 100)}%)`);
  }

  console.log('\nBy Platform:');
  for (const [platform, data] of Object.entries(stats.byPlatform)) {
    console.log(`  ${platform}: ${data.found} found from ${data.tried} attempts`);
  }

  if (!EXECUTE && stats.imagesFound > 0) {
    console.log('\n[TIP] Run with --execute to update the database');
  }

  console.log('\nDone!');
}

fetchAllDishImages()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
