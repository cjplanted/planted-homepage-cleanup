/**
 * Planted Locations Scraper
 *
 * Scrapes restaurant data from https://locations.eatplanted.com/
 * This is a Quasar (Vue.js) SPA that loads data dynamically.
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs';

interface PlantedLocation {
  id?: string;
  name: string;
  type?: string;
  address?: {
    street?: string;
    city?: string;
    postal_code?: string;
    country?: string;
    full_address?: string;
  };
  coordinates?: {
    lat: number;
    lng: number;
  };
  website?: string;
  phone?: string;
  categories?: string[];
  raw_data?: unknown;
}

async function scrapePlantedLocations(): Promise<PlantedLocation[]> {
  console.log('🌱 Starting Planted Locations Scraper...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  const capturedData: unknown[] = [];
  const networkRequests: { url: string; data?: unknown }[] = [];

  // Intercept network requests to find API calls
  await page.setRequestInterception(true);

  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('api') || url.includes('json') || url.includes('graphql') || url.includes('firestore')) {
      console.log(`📡 Request: ${url}`);
    }
    request.continue();
  });

  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    // Capture JSON responses that might contain location data
    if (contentType.includes('application/json') || url.includes('.json')) {
      try {
        const data = await response.json();
        console.log(`📥 JSON Response from: ${url}`);
        networkRequests.push({ url, data });

        // Check if this looks like location data
        if (Array.isArray(data) && data.length > 0) {
          console.log(`   Found array with ${data.length} items`);
          capturedData.push(...data);
        } else if (data.locations || data.results || data.data || data.items || data.stores) {
          const locations = data.locations || data.results || data.data || data.items || data.stores;
          if (Array.isArray(locations)) {
            console.log(`   Found ${locations.length} locations in response`);
            capturedData.push(...locations);
          }
        }
      } catch {
        // Not JSON or parsing failed
      }
    }
  });

  // Navigate to the page
  console.log('🌐 Navigating to https://locations.eatplanted.com/...\n');
  await page.goto('https://locations.eatplanted.com/', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });

  // Wait for the app to load
  await page.waitForSelector('#q-app', { timeout: 10000 });
  console.log('✅ Page loaded\n');

  // Wait a bit for dynamic content
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Try to extract data from the DOM
  console.log('🔍 Extracting data from DOM...\n');

  const domData = await page.evaluate(() => {
    const locations: unknown[] = [];

    // Look for Vue/Quasar data stores
    const app = document.querySelector('#q-app');
    if (app && (app as any).__vue__) {
      console.log('Found Vue instance');
      const vue = (app as any).__vue__;
      if (vue.$store?.state) {
        return { source: 'vuex', data: vue.$store.state };
      }
    }

    // Check window for any global data
    const windowData: Record<string, unknown> = {};
    for (const key of Object.keys(window)) {
      if (key.toLowerCase().includes('location') ||
          key.toLowerCase().includes('store') ||
          key.toLowerCase().includes('data') ||
          key.toLowerCase().includes('planted')) {
        try {
          windowData[key] = (window as any)[key];
        } catch {}
      }
    }

    // Extract visible location cards/markers
    const locationElements = document.querySelectorAll('[class*="location"], [class*="store"], [class*="marker"], .q-card');
    locationElements.forEach((el) => {
      const nameEl = el.querySelector('h1, h2, h3, h4, .name, [class*="title"]');
      const addressEl = el.querySelector('.address, [class*="address"]');

      if (nameEl) {
        locations.push({
          name: nameEl.textContent?.trim(),
          address: addressEl?.textContent?.trim(),
          html: el.innerHTML.substring(0, 500),
        });
      }
    });

    // Try to find map markers
    const mapContainer = document.querySelector('[class*="map"], #map, .leaflet-container, [class*="google"]');

    return {
      source: 'dom',
      locationElements: locations.length,
      windowData,
      hasMap: !!mapContainer,
      bodyText: document.body.innerText.substring(0, 2000),
    };
  });

  console.log('DOM extraction result:', JSON.stringify(domData, null, 2).substring(0, 1000));

  // Take a screenshot for debugging
  await page.screenshot({ path: '/tmp/planted-locations.png', fullPage: true });
  console.log('\n📸 Screenshot saved to /tmp/planted-locations.png');

  // Try scrolling to load more content
  console.log('\n🔄 Scrolling to load more content...');
  await page.evaluate(async () => {
    const scrollHeight = document.body.scrollHeight;
    for (let i = 0; i < scrollHeight; i += 500) {
      window.scrollTo(0, i);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Try clicking on map or list elements to trigger data loading
  console.log('\n🖱️ Trying to interact with the page...');

  try {
    // Click on any "show all" or "view list" buttons
    const buttons = await page.$$('button, .q-btn, [role="button"]');
    for (const button of buttons.slice(0, 5)) {
      const text = await button.evaluate(el => el.textContent?.toLowerCase() || '');
      if (text.includes('list') || text.includes('all') || text.includes('show')) {
        console.log(`   Clicking button: "${text.trim()}"`);
        await button.click().catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (err) {
    console.log('   No interactive elements found');
  }

  // Final wait for any data to load
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Get final page content
  const finalContent = await page.content();

  // Save raw HTML for analysis
  fs.writeFileSync('/tmp/planted-locations.html', finalContent);
  console.log('\n📄 HTML saved to /tmp/planted-locations.html');

  // Save network requests
  fs.writeFileSync('/tmp/planted-network.json', JSON.stringify(networkRequests, null, 2));
  console.log('📊 Network requests saved to /tmp/planted-network.json');

  // Save captured data
  fs.writeFileSync('/tmp/planted-data.json', JSON.stringify(capturedData, null, 2));
  console.log('💾 Captured data saved to /tmp/planted-data.json');

  await browser.close();

  // Process captured data into our format
  const processedLocations: PlantedLocation[] = capturedData.map((item: any, index) => ({
    id: item.id || item._id || `location_${index}`,
    name: item.name || item.title || item.locationName || 'Unknown',
    type: item.type || item.category || item.locationType,
    address: {
      street: item.street || item.address?.street,
      city: item.city || item.address?.city,
      postal_code: item.postalCode || item.postal_code || item.zip || item.address?.postalCode,
      country: item.country || item.address?.country,
      full_address: item.fullAddress || item.formattedAddress || item.address,
    },
    coordinates: item.lat && item.lng ? {
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lng),
    } : item.coordinates || item.location || item.position,
    website: item.website || item.url,
    phone: item.phone || item.telephone,
    categories: item.categories || item.tags,
    raw_data: item,
  }));

  console.log(`\n✅ Found ${processedLocations.length} locations`);

  return processedLocations;
}

// Run the scraper
scrapePlantedLocations()
  .then(locations => {
    console.log('\n📋 Results:');
    console.log(JSON.stringify(locations.slice(0, 5), null, 2));

    if (locations.length === 0) {
      console.log('\n⚠️  No locations found via network. Check /tmp/planted-locations.html for manual analysis.');
    }
  })
  .catch(err => {
    console.error('❌ Scraper error:', err);
    process.exit(1);
  });
