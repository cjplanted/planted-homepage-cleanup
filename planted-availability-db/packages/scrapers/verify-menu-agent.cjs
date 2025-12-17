#!/usr/bin/env node
/**
 * Menu Verification Agent
 *
 * Crawls restaurant websites to verify planted products are actually on the menu.
 * Does NOT rely on news articles or press releases - only trusts actual menu data.
 *
 * Usage:
 *   node verify-menu-agent.cjs                           # Check all unverified venues
 *   node verify-menu-agent.cjs --venue=<id>              # Check specific venue
 *   node verify-menu-agent.cjs --url=https://example.com # Check a specific URL
 *   node verify-menu-agent.cjs --execute                 # Actually update database
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Try to load pdf-parse for PDF analysis
let pdfParse = null;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  console.log('Note: pdf-parse not installed. Run: npm install pdf-parse');
}

// Planted product keywords to search for
const PLANTED_KEYWORDS = [
  'planted',
  'planted.chicken',
  'planted.steak',
  'planted.kebab',
  'planted.pulled',
  'planted.schnitzel',
  'planted.duck',
  'planted.bratwurst',
  'eatplanted',
  'eat planted',
  // German variations
  'pflanzliches steak',
  'pflanzliches schnitzel',
  // Common menu descriptions
  'plant-based chicken',
  'vegan chicken',
  'vegan steak',
  'vegan schnitzel',
];

// Menu page patterns to look for
const MENU_PATH_PATTERNS = [
  '/menu',
  '/speisekarte',
  '/carte',
  '/karte',
  '/essen',
  '/food',
  '/dishes',
  '/gerichte',
  '/angebot',
  '/mittag',
  '/lunch',
  '/dinner',
  '/abend',
];

// Subpages to also crawl (restaurants often have menu on subpages)
const SUBPAGE_PATTERNS = [
  '/restaurant',
  '/restaurant/',
  '/en',
  '/en/',
  '/de',
  '/de/',
  '/bar',
  '/cuisine',
  '/kulinarik',
];

// Common PDF menu paths to try directly
const COMMON_PDF_PATHS = [
  '/media/menu.pdf',
  '/media/speisekarte.pdf',
  '/media/restaurant.pdf',
  '/media/restaurant_d.pdf',
  '/media/restaurant_en.pdf',
  '/media/restaurant_mo_-_fr_d.pdf',
  '/media/mittag.pdf',
  '/media/lunch.pdf',
  '/media/dinner.pdf',
  '/media/abend.pdf',
  '/downloads/menu.pdf',
  '/downloads/speisekarte.pdf',
  '/assets/menu.pdf',
  '/files/menu.pdf',
  '/pdf/menu.pdf',
  '/menu.pdf',
  '/speisekarte.pdf',
];

// PDF patterns
const PDF_PATTERNS = [
  /href=["']([^"']*\.pdf)["']/gi,
  /src=["']([^"']*\.pdf)["']/gi,
  /data-pdf=["']([^"']+)["']/gi,
];

// Results tracking
const results = {
  verified: [],
  notFound: [],
  errors: [],
  needsManualCheck: [],
};

/**
 * Fetch a PDF and extract text using pdf-parse
 */
async function fetchAndParsePdf(url) {
  if (!pdfParse) {
    return { success: false, error: 'pdf-parse not installed' };
  }

  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/pdf,*/*',
      },
      timeout: 30000,
    };

    const req = protocol.get(url, options, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return fetchAndParsePdf(redirectUrl).then(resolve);
      }

      if (res.statusCode >= 400) {
        resolve({ success: false, error: `HTTP ${res.statusCode}` });
        return;
      }

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const data = await pdfParse(buffer);
          resolve({ success: true, text: data.text, pages: data.numpages });
        } catch (err) {
          resolve({ success: false, error: err.message });
        }
      });
    });

    req.on('error', (err) => resolve({ success: false, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Request timeout' });
    });
  });
}

/**
 * Fetch a URL with proper error handling
 */
function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const requestOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5,de;q=0.3',
        ...options.headers,
      },
      timeout: 15000,
    };

    const req = protocol.get(url, requestOptions, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return fetchUrl(redirectUrl, options).then(resolve).catch(reject);
      }

      if (res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        html: data,
        contentType: res.headers['content-type'] || '',
        url: res.req?.res?.responseUrl || url,
      }));
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Extract text content from HTML, removing scripts, styles, etc.
 */
function extractText(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Search for planted keywords in text
 */
function searchForPlanted(text, url) {
  const textLower = text.toLowerCase();
  const found = [];

  for (const keyword of PLANTED_KEYWORDS) {
    const keywordLower = keyword.toLowerCase();
    let index = textLower.indexOf(keywordLower);

    while (index !== -1) {
      // Extract context around the match (50 chars before and after)
      const start = Math.max(0, index - 50);
      const end = Math.min(text.length, index + keyword.length + 50);
      const context = text.substring(start, end).trim();

      found.push({
        keyword,
        context,
        url,
      });

      index = textLower.indexOf(keywordLower, index + 1);
    }
  }

  return found;
}

/**
 * Find menu links on a page
 */
function findMenuLinks(html, baseUrl) {
  const links = [];
  const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].toLowerCase();

    // Check if link text suggests a menu
    const isMenuLink =
      text.includes('menu') ||
      text.includes('speisekarte') ||
      text.includes('carte') ||
      text.includes('karte') ||
      text.includes('essen') ||
      text.includes('food') ||
      text.includes('dishes') ||
      text.includes('gerichte');

    // Check if href suggests a menu
    const isMenuPath = MENU_PATH_PATTERNS.some(p => href.toLowerCase().includes(p));

    if (isMenuLink || isMenuPath) {
      try {
        const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
        links.push(fullUrl);
      } catch (e) {
        // Invalid URL, skip
      }
    }
  }

  return [...new Set(links)];
}

/**
 * Find PDF links on a page
 */
function findPdfLinks(html, baseUrl) {
  const pdfs = [];

  for (const pattern of PDF_PATTERNS) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      try {
        const pdfUrl = match[1].startsWith('http')
          ? match[1]
          : new URL(match[1], baseUrl).href;
        pdfs.push(pdfUrl);
      } catch (e) {
        // Invalid URL, skip
      }
    }
  }

  return [...new Set(pdfs)];
}

/**
 * Verify a single venue's menu
 */
async function verifyVenueMenu(venue) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Verifying: ${venue.name} (${venue.city})`);
  console.log(`Website: ${venue.website || 'Not provided'}`);
  console.log('='.repeat(60));

  if (!venue.website) {
    console.log('No website URL - cannot verify');
    results.needsManualCheck.push({
      venue,
      reason: 'No website URL provided',
    });
    return { status: 'no_website', found: [] };
  }

  const allFound = [];
  const checkedUrls = new Set();
  const checkedPdfs = new Set();
  const urlsToCheck = [venue.website];
  const pdfsToCheck = [];

  // Also try common menu paths
  for (const path of MENU_PATH_PATTERNS) {
    try {
      const menuUrl = new URL(path, venue.website).href;
      urlsToCheck.push(menuUrl);
    } catch (e) {
      // Skip invalid URLs
    }
  }

  // Try subpages too
  for (const path of SUBPAGE_PATTERNS) {
    try {
      const subUrl = new URL(path, venue.website).href;
      urlsToCheck.push(subUrl);
    } catch (e) {
      // Skip invalid URLs
    }
  }

  // Try common PDF paths directly
  for (const path of COMMON_PDF_PATHS) {
    try {
      const pdfUrl = new URL(path, venue.website).href;
      pdfsToCheck.push(pdfUrl);
    } catch (e) {
      // Skip invalid URLs
    }
  }

  while (urlsToCheck.length > 0 && checkedUrls.size < 10) {
    const url = urlsToCheck.shift();

    if (checkedUrls.has(url)) continue;
    checkedUrls.add(url);

    console.log(`\nChecking: ${url}`);

    try {
      const { html, contentType } = await fetchUrl(url);

      // Skip PDFs for now (would need pdf-parse)
      if (contentType.includes('pdf')) {
        console.log('  [PDF] Skipping - PDF parsing not implemented');
        results.needsManualCheck.push({
          venue,
          reason: 'Menu is in PDF format',
          url,
        });
        continue;
      }

      // Extract and search text
      const text = extractText(html);
      const found = searchForPlanted(text, url);

      if (found.length > 0) {
        console.log(`  FOUND ${found.length} planted mentions!`);
        found.forEach(f => {
          console.log(`    - "${f.keyword}" in: "...${f.context}..."`);
        });
        allFound.push(...found);
      } else {
        console.log('  No planted keywords found on this page');
      }

      // Find more menu links to check
      const menuLinks = findMenuLinks(html, url);
      const pdfLinks = findPdfLinks(html, url);

      if (menuLinks.length > 0) {
        console.log(`  Found ${menuLinks.length} menu links to check`);
        urlsToCheck.push(...menuLinks);
      }

      if (pdfLinks.length > 0) {
        console.log(`  Found ${pdfLinks.length} PDF menus to check`);
        // Add discovered PDFs at the FRONT (higher priority than common paths)
        pdfsToCheck.unshift(...pdfLinks);
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 1000));

    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }

  // Now check PDFs
  if (pdfsToCheck.length > 0 && pdfParse) {
    console.log(`\nChecking ${pdfsToCheck.length} PDF menus...`);

    for (const pdfUrl of pdfsToCheck) {
      if (checkedPdfs.has(pdfUrl)) continue;
      checkedPdfs.add(pdfUrl);

      // Limit to 10 PDFs
      if (checkedPdfs.size > 10) break;

      console.log(`  PDF: ${pdfUrl.substring(0, 70)}...`);

      const pdfResult = await fetchAndParsePdf(pdfUrl);

      if (pdfResult.success) {
        console.log(`    Parsed ${pdfResult.pages} pages`);
        const found = searchForPlanted(pdfResult.text, pdfUrl);

        if (found.length > 0) {
          console.log(`    FOUND ${found.length} planted mentions!`);
          found.forEach(f => {
            console.log(`      - "${f.keyword}" in: "...${f.context.substring(0, 80)}..."`);
          });
          allFound.push(...found);
        } else {
          console.log(`    No planted keywords found`);
        }
      } else {
        console.log(`    Error: ${pdfResult.error}`);
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 500));
    }
  } else if (pdfsToCheck.length > 0 && !pdfParse) {
    console.log(`\nFound ${pdfsToCheck.length} PDFs but pdf-parse not installed`);
    pdfsToCheck.slice(0, 5).forEach(pdf => {
      results.needsManualCheck.push({
        venue,
        reason: 'PDF menu found (pdf-parse not installed)',
        url: pdf,
      });
    });
  }

  // Determine result
  if (allFound.length > 0) {
    console.log(`\n[VERIFIED] Found ${allFound.length} planted mentions on website`);
    results.verified.push({ venue, found: allFound });
    return { status: 'verified', found: allFound };
  } else {
    console.log(`\n[NOT FOUND] No planted mentions found on website`);
    results.notFound.push({ venue, checkedUrls: [...checkedUrls] });
    return { status: 'not_found', found: [] };
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const EXECUTE = args.includes('--execute');
  const urlArg = args.find(a => a.startsWith('--url='));
  const venueArg = args.find(a => a.startsWith('--venue='));

  console.log('\n' + '='.repeat(60));
  console.log('MENU VERIFICATION AGENT');
  console.log('='.repeat(60));
  console.log(`Mode: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`);

  // If just checking a URL
  if (urlArg) {
    const url = urlArg.split('=')[1];
    console.log(`\nChecking URL: ${url}`);

    const fakeVenue = { name: 'URL Check', city: 'N/A', website: url };
    await verifyVenueMenu(fakeVenue);
    printSummary();
    return;
  }

  // Otherwise, check venues from database
  const admin = require('firebase-admin');
  const { getFirestore } = require('firebase-admin/firestore');
  const path = require('path');

  admin.initializeApp({
    credential: admin.credential.cert(path.resolve(__dirname, '../../service-account.json'))
  });
  const db = getFirestore();

  // Get venues to verify
  let venuesQuery = db.collection('venues');

  if (venueArg) {
    // Check specific venue
    const venueId = venueArg.split('=')[1];
    const venueDoc = await db.collection('venues').doc(venueId).get();
    if (!venueDoc.exists) {
      console.log('Venue not found:', venueId);
      return;
    }
    const venues = [{ id: venueDoc.id, ...venueDoc.data() }];
    await processVenues(db, venues, EXECUTE);
  } else {
    // Check all venues needing verification
    const venuesSnap = await db.collection('venues')
      .where('verification_status', '==', 'needs_menu_verification')
      .get();

    if (venuesSnap.empty) {
      console.log('\nNo venues need verification.');

      // Also check venues with websites but no verification status
      const allVenuesSnap = await db.collection('venues')
        .where('status', '==', 'active')
        .get();

      const withWebsite = allVenuesSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(v => v.website && !v.verification_status)
        .slice(0, 5); // Limit to 5 for initial run

      if (withWebsite.length > 0) {
        console.log(`\nFound ${withWebsite.length} venues with websites to verify:`);
        await processVenues(db, withWebsite, EXECUTE);
      }
    } else {
      const venues = venuesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log(`\nFound ${venues.length} venues needing verification:`);
      await processVenues(db, venues, EXECUTE);
    }
  }

  printSummary();
}

async function processVenues(db, venues, execute) {
  for (const venue of venues) {
    const result = await verifyVenueMenu(venue);

    if (execute && venue.id) {
      try {
        if (result.status === 'verified') {
          await db.collection('venues').doc(venue.id).update({
            verification_status: 'verified_on_menu',
            verification_date: new Date(),
            verification_found: result.found.map(f => ({
              keyword: f.keyword,
              context: f.context.substring(0, 200),
              url: f.url,
            })),
            updated_at: new Date(),
          });
          console.log('  [DB] Updated as verified');
        } else if (result.status === 'not_found') {
          await db.collection('venues').doc(venue.id).update({
            verification_status: 'not_found_on_menu',
            verification_date: new Date(),
            verification_note: 'Planted products not found on current website menu. May be seasonal or discontinued.',
            updated_at: new Date(),
          });
          console.log('  [DB] Updated as not found');
        }
      } catch (err) {
        console.log('  [DB] Error updating:', err.message);
      }
    }
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  console.log(`\nVerified (planted found on website): ${results.verified.length}`);
  results.verified.forEach(r => {
    console.log(`  - ${r.venue.name} (${r.venue.city}): ${r.found.length} mentions`);
  });

  console.log(`\nNot Found (planted not on website): ${results.notFound.length}`);
  results.notFound.forEach(r => {
    console.log(`  - ${r.venue.name} (${r.venue.city})`);
  });

  console.log(`\nNeeds Manual Check: ${results.needsManualCheck.length}`);
  results.needsManualCheck.forEach(r => {
    console.log(`  - ${r.venue.name} (${r.venue.city}): ${r.reason}`);
    if (r.url) console.log(`    URL: ${r.url}`);
  });
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
