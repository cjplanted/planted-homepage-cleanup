#!/usr/bin/env node
import { GoogleSheetsScraper } from './scrapers/GoogleSheetsScraper.js';
import { WebMenuScraper } from './scrapers/WebMenuScraper.js';
import { WoltScraper } from './scrapers/delivery/WoltScraper.js';
import { UberEatsScraper } from './scrapers/delivery/UberEatsScraper.js';
import { WoltBrowserScraper } from './scrapers/delivery/WoltBrowserScraper.js';
import { GoogleSearchDiscovery } from './scrapers/discovery/GoogleSearchDiscovery.js';
import { CoopScraper } from './scrapers/retail/CoopScraper.js';
import { MigrosScraper } from './scrapers/retail/MigrosScraper.js';
import { LieferandoScraper } from './scrapers/delivery/LieferandoScraper.js';
import { ReweScraper } from './scrapers/retail/ReweScraper.js';
import { EdekaScraper } from './scrapers/retail/EdekaScraper.js';
import { SainsburysScraper } from './scrapers/retail/SainsburysScraper.js';
import { WaitroseScraper } from './scrapers/retail/WaitroseScraper.js';
import { AlbertHeijnScraper } from './scrapers/retail/AlbertHeijnScraper.js';
import { DeliverooScraper } from './scrapers/delivery/DeliverooScraper.js';
import { GlovoScraper } from './scrapers/delivery/GlovoScraper.js';
import { CarrefourScraper } from './scrapers/retail/CarrefourScraper.js';
import type { ScraperOptions } from './base/BaseScraper.js';

interface CliArgs {
  scraper: string;
  dryRun: boolean;
  verbose: boolean;
  maxItems?: number;
  config?: string;
  city?: string;
  slow?: boolean;  // Heavy throttling for local IP
  ultraSlow?: boolean;  // Very heavy throttling (60-120s delays, 1 search/city)
  headful?: boolean;  // Show browser window
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    scraper: '',
    dryRun: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--dry-run' || arg === '-d') {
      result.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      result.verbose = true;
    } else if (arg === '--max-items' || arg === '-m') {
      result.maxItems = parseInt(args[++i], 10);
    } else if (arg === '--config' || arg === '-c') {
      result.config = args[++i];
    } else if (arg === '--city') {
      result.city = args[++i];
    } else if (arg === '--slow' || arg === '-s') {
      result.slow = true;
    } else if (arg === '--ultra-slow' || arg === '-u') {
      result.ultraSlow = true;
    } else if (arg === '--headful' || arg === '--show') {
      result.headful = true;
    } else if (!arg.startsWith('-')) {
      result.scraper = arg;
    }
  }

  return result;
}

function printUsage(): void {
  console.log(`
Planted Availability Database - Scraper CLI

Usage: pnpm scrape <scraper-name> [options]

Available scrapers:
  google-sheets    Import venues from Google Sheets
  web-menu         Scrape menu data from websites
  wolt             Scrape Wolt for Planted dishes (DE/AT) [API]
  wolt-browser     Scrape Wolt using browser automation [FREE]
  ubereats         Scrape Uber Eats for Planted dishes (DE/AT)
  google-search    Discover Planted partners via Google search [DISCOVERY]
  coop             Scrape Coop Switzerland for Planted products [RETAIL]
  migros           Scrape Migros Switzerland for Planted products [RETAIL]
  rewe             Scrape REWE Germany for Planted products [RETAIL]
  edeka            Scrape EDEKA Germany for Planted products [RETAIL]
  sainsburys       Scrape Sainsbury's UK for Planted products [RETAIL]
  waitrose         Scrape Waitrose UK for Planted products [RETAIL]
  albert-heijn     Scrape Albert Heijn Netherlands for Planted products [RETAIL]
  lieferando       Scrape Lieferando for Planted restaurants (DE/AT/NL) [DELIVERY]
  deliveroo        Scrape Deliveroo for Planted restaurants (UK/FR) [DELIVERY]
  glovo            Scrape Glovo for Planted restaurants (ES/IT) [DELIVERY]
  carrefour        Scrape Carrefour for Planted products (FR/ES/IT) [RETAIL]

Options:
  -d, --dry-run     Run without saving to database
  -v, --verbose     Enable verbose logging
  -m, --max-items   Maximum items to process
  -c, --config      Path to config file (JSON)
  --city            Single city to scrape (berlin, munich, hamburg, etc.)
  -s, --slow        Heavy throttling (30-60s delays) for residential IP
  -u, --ultra-slow  Very heavy throttling (60-120s delays, 1 search/city)
  --headful, --show Show browser window (for debugging)

Environment variables:
  GOOGLE_SHEETS_API_KEY     API key for Google Sheets scraper
  GOOGLE_SHEETS_ID          Spreadsheet ID for Google Sheets scraper
  GOOGLE_SHEETS_NAME        Sheet name (default: "Venues")

Examples:
  pnpm scrape google-sheets --dry-run --verbose
  pnpm scrape web-menu -c ./config/menus.json -m 10
  pnpm scrape wolt --city Berlin -v --dry-run
  pnpm scrape wolt-browser --city berlin --slow --headful -v
  pnpm scrape ubereats --dry-run --verbose
  pnpm scrape google-search --city berlin --slow --headful -v
`);
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (!args.scraper) {
    printUsage();
    process.exit(1);
  }

  const options: ScraperOptions = {
    dryRun: args.dryRun,
    verbose: args.verbose,
    maxItems: args.maxItems,
  };

  console.log(`\n🚀 Starting scraper: ${args.scraper}`);
  console.log(`   Options: dry-run=${args.dryRun}, verbose=${args.verbose}`);
  if (args.maxItems) console.log(`   Max items: ${args.maxItems}`);
  console.log('');

  try {
    let result;

    switch (args.scraper) {
      case 'google-sheets': {
        const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
        const sheetName = process.env.GOOGLE_SHEETS_NAME || 'Venues';

        if (!apiKey || !spreadsheetId) {
          console.error('Error: Missing GOOGLE_SHEETS_API_KEY or GOOGLE_SHEETS_ID environment variables');
          process.exit(1);
        }

        const scraper = new GoogleSheetsScraper({
          apiKey,
          spreadsheetId,
          sheetName,
        });

        result = await scraper.run(options);
        break;
      }

      case 'web-menu': {
        if (!args.config) {
          console.error('Error: Config file required for web-menu scraper (-c ./config.json)');
          process.exit(1);
        }

        // Load config from file
        const { readFileSync } = await import('fs');
        const configData = JSON.parse(readFileSync(args.config, 'utf-8'));

        const scraper = new WebMenuScraper(configData);
        result = await scraper.run(options);
        break;
      }

      case 'wolt': {
        // Wolt scraper for Germany and Austria
        const cityMap: Record<string, { name: string; country: string; lat: number; lon: number }> = {
          berlin: { name: 'Berlin', country: 'DE', lat: 52.5200, lon: 13.4050 },
          munich: { name: 'Munich', country: 'DE', lat: 48.1351, lon: 11.5820 },
          hamburg: { name: 'Hamburg', country: 'DE', lat: 53.5511, lon: 9.9937 },
          frankfurt: { name: 'Frankfurt', country: 'DE', lat: 50.1109, lon: 8.6821 },
          stuttgart: { name: 'Stuttgart', country: 'DE', lat: 48.7758, lon: 9.1829 },
          cologne: { name: 'Cologne', country: 'DE', lat: 50.9375, lon: 6.9603 },
          dusseldorf: { name: 'Dusseldorf', country: 'DE', lat: 51.2277, lon: 6.7735 },
          vienna: { name: 'Vienna', country: 'AT', lat: 48.2082, lon: 16.3738 },
          salzburg: { name: 'Salzburg', country: 'AT', lat: 47.8095, lon: 13.0550 },
          graz: { name: 'Graz', country: 'AT', lat: 47.0707, lon: 15.4395 },
        };

        let cities;
        if (args.city) {
          const cityKey = args.city.toLowerCase();
          if (!cityMap[cityKey]) {
            console.error(`Unknown city: ${args.city}`);
            console.error(`Available cities: ${Object.keys(cityMap).join(', ')}`);
            process.exit(1);
          }
          cities = [cityMap[cityKey]];
        }

        const woltScraper = new WoltScraper(cities ? { cities } : undefined);
        result = await woltScraper.run(options);
        break;
      }

      case 'ubereats': {
        // Uber Eats scraper for Germany and Austria
        const uberEatsScraper = new UberEatsScraper();
        result = await uberEatsScraper.run(options);
        break;
      }

      case 'wolt-browser': {
        // Browser-based Wolt scraper (FREE - no proxy needed)
        console.log('Using browser-based scraper (puppeteer with stealth)...');

        // City mapping for browser scraper
        const browserCityMap: Record<string, { name: string; country: string; lat: number; lon: number; woltSlug: string }> = {
          berlin: { name: 'Berlin', country: 'DE', lat: 52.52, lon: 13.405, woltSlug: 'berlin' },
          munich: { name: 'Munich', country: 'DE', lat: 48.1351, lon: 11.582, woltSlug: 'munich' },
          hamburg: { name: 'Hamburg', country: 'DE', lat: 53.5511, lon: 9.9937, woltSlug: 'hamburg' },
          frankfurt: { name: 'Frankfurt', country: 'DE', lat: 50.1109, lon: 8.6821, woltSlug: 'frankfurt' },
          vienna: { name: 'Vienna', country: 'AT', lat: 48.2082, lon: 16.3738, woltSlug: 'vienna' },
          zurich: { name: 'Zurich', country: 'CH', lat: 47.3769, lon: 8.5417, woltSlug: 'zurich' },
        };

        let browserCities;
        if (args.city) {
          const cityKey = args.city.toLowerCase();
          if (!browserCityMap[cityKey]) {
            console.error(`Unknown city: ${args.city}`);
            console.error(`Available cities: ${Object.keys(browserCityMap).join(', ')}`);
            process.exit(1);
          }
          browserCities = [browserCityMap[cityKey]];
          console.log(`Scraping single city: ${args.city}`);
        }

        // Slow mode: 30-60 second delays (safe for residential IP)
        // Normal mode: 3-7 second delays
        const minDelay = args.slow ? 30000 : 3000;
        const maxDelay = args.slow ? 60000 : 7000;

        if (args.slow) {
          console.log('SLOW MODE: 30-60 second delays between requests');
        }
        if (args.headful) {
          console.log('HEADFUL MODE: Browser window will be visible');
        }

        const woltBrowserScraper = new WoltBrowserScraper({
          cities: browserCities,
          headless: !args.headful,
          minDelay,
          maxDelay,
          maxVenuesPerCity: 5,  // Limit to 5 venues per city to be respectful
        });
        result = await woltBrowserScraper.run(options);
        break;
      }

      case 'google-search': {
        // Google Search-based discovery tool
        console.log('Using Google Search discovery tool...');

        // City mapping for search discovery
        const searchCityMap: Record<string, { name: string; country: string }> = {
          berlin: { name: 'Berlin', country: 'DE' },
          munich: { name: 'Munich', country: 'DE' },
          hamburg: { name: 'Hamburg', country: 'DE' },
          frankfurt: { name: 'Frankfurt', country: 'DE' },
          vienna: { name: 'Vienna', country: 'AT' },
          zurich: { name: 'Zurich', country: 'CH' },
          geneva: { name: 'Geneva', country: 'CH' },
          basel: { name: 'Basel', country: 'CH' },
        };

        let searchCities;
        if (args.city) {
          const cityKey = args.city.toLowerCase();
          if (!searchCityMap[cityKey]) {
            console.error(`Unknown city: ${args.city}`);
            console.error(`Available cities: ${Object.keys(searchCityMap).join(', ')}`);
            process.exit(1);
          }
          searchCities = [searchCityMap[cityKey]];
          console.log(`Searching single city: ${args.city}`);
        }

        // Ultra-slow mode: 60-120 second delays, 1 search per city (very conservative)
        // Slow mode: 15-30 second delays, 2 searches per city
        // Normal mode: 5-15 second delays, 4 searches per city
        let searchMinDelay = 5000;
        let searchMaxDelay = 15000;
        let maxSearchesPerCity = 4;

        if (args.ultraSlow) {
          searchMinDelay = 60000;
          searchMaxDelay = 120000;
          maxSearchesPerCity = 1;
          console.log('ULTRA-SLOW MODE: 60-120 second delays, 1 search per city');
        } else if (args.slow) {
          searchMinDelay = 15000;
          searchMaxDelay = 30000;
          maxSearchesPerCity = 2;
          console.log('SLOW MODE: 15-30 second delays, 2 searches per city');
        }

        if (args.headful) {
          console.log('HEADFUL MODE: Browser window will be visible');
        }

        const googleSearchDiscovery = new GoogleSearchDiscovery({
          cities: searchCities,
          headless: !args.headful,
          minDelay: searchMinDelay,
          maxDelay: searchMaxDelay,
          maxSearchesPerCity,
        });
        result = await googleSearchDiscovery.run(options);
        break;
      }

      case 'coop': {
        // Coop Switzerland retail scraper
        console.log('Using browser-based Coop Switzerland scraper...');
        console.log('Target: https://www.coop.ch/en/brands/planted/c/BRAND_planted');

        // Slow mode: 30-60 second delays (safe for residential IP)
        // Normal mode: 3-7 second delays
        const coopMinDelay = args.slow ? 30000 : 3000;
        const coopMaxDelay = args.slow ? 60000 : 7000;

        if (args.slow) {
          console.log('SLOW MODE: 30-60 second delays between requests');
        }
        if (args.headful) {
          console.log('HEADFUL MODE: Browser window will be visible');
        }

        const coopScraper = new CoopScraper({
          headless: !args.headful,
          minDelay: coopMinDelay,
          maxDelay: coopMaxDelay,
          maxProducts: args.maxItems || 50,
        });
        result = await coopScraper.run(options);
        break;
      }

      case 'migros': {
        // Migros Switzerland retail scraper
        console.log('Using browser-based Migros Switzerland scraper...');
        console.log('Target: https://www.migros.ch/en/brand/planted');

        // Slow mode: 30-60 second delays (safe for residential IP)
        // Normal mode: 3-7 second delays
        const migrosMinDelay = args.slow ? 30000 : 3000;
        const migrosMaxDelay = args.slow ? 60000 : 7000;

        if (args.slow) {
          console.log('SLOW MODE: 30-60 second delays between requests');
        }
        if (args.headful) {
          console.log('HEADFUL MODE: Browser window will be visible');
        }

        const migrosScraper = new MigrosScraper({
          headless: !args.headful,
          minDelay: migrosMinDelay,
          maxDelay: migrosMaxDelay,
          maxProducts: args.maxItems || 50,
        });
        result = await migrosScraper.run(options);
        break;
      }

      case 'rewe': {
        // REWE Germany retail scraper
        console.log('Using browser-based REWE scraper...');
        console.log('Target: shop.rewe.de (Germany)');

        const reweMinDelay = args.slow ? 30000 : 3000;
        const reweMaxDelay = args.slow ? 60000 : 7000;

        if (args.slow) {
          console.log('SLOW MODE: 30-60 second delays between requests');
        }
        if (args.headful) {
          console.log('HEADFUL MODE: Browser window will be visible');
        }

        const reweScraper = new ReweScraper({
          headless: !args.headful,
          minDelay: reweMinDelay,
          maxDelay: reweMaxDelay,
          maxProducts: args.maxItems || 50,
        });
        result = await reweScraper.run(options);
        break;
      }

      case 'edeka': {
        // EDEKA Germany retail scraper
        console.log('Using browser-based EDEKA scraper...');
        console.log('Target: edeka24.de (Germany)');
        console.log('Note: EDEKA has 11,000+ physical stores with Planted products');

        const edekaMinDelay = args.slow ? 30000 : 3000;
        const edekaMaxDelay = args.slow ? 60000 : 7000;

        if (args.slow) {
          console.log('SLOW MODE: 30-60 second delays between requests');
        }
        if (args.headful) {
          console.log('HEADFUL MODE: Browser window will be visible');
        }

        const edekaScraper = new EdekaScraper({
          headless: !args.headful,
          minDelay: edekaMinDelay,
          maxDelay: edekaMaxDelay,
          maxProducts: args.maxItems || 50,
        });
        result = await edekaScraper.run(options);
        break;
      }

      case 'sainsburys': {
        // Sainsbury's UK retail scraper
        console.log("Using browser-based Sainsbury's scraper...");
        console.log('Target: sainsburys.co.uk (UK)');
        console.log("Note: Sainsbury's has ~1,400 stores across the UK");

        const sainsburysMinDelay = args.slow ? 30000 : 3000;
        const sainsburysMaxDelay = args.slow ? 60000 : 7000;

        if (args.slow) {
          console.log('SLOW MODE: 30-60 second delays between requests');
        }
        if (args.headful) {
          console.log('HEADFUL MODE: Browser window will be visible');
        }

        const sainsburysScraper = new SainsburysScraper({
          headless: !args.headful,
          minDelay: sainsburysMinDelay,
          maxDelay: sainsburysMaxDelay,
          maxProducts: args.maxItems || 50,
        });
        result = await sainsburysScraper.run(options);
        break;
      }

      case 'waitrose': {
        // Waitrose UK retail scraper
        console.log('Using browser-based Waitrose scraper...');
        console.log('Target: waitrose.com (UK)');
        console.log('Note: Waitrose has ~380 stores across the UK');

        const waitroseMinDelay = args.slow ? 30000 : 3000;
        const waitroseMaxDelay = args.slow ? 60000 : 7000;

        if (args.slow) {
          console.log('SLOW MODE: 30-60 second delays between requests');
        }
        if (args.headful) {
          console.log('HEADFUL MODE: Browser window will be visible');
        }

        const waitroseScraper = new WaitroseScraper({
          headless: !args.headful,
          minDelay: waitroseMinDelay,
          maxDelay: waitroseMaxDelay,
          maxProducts: args.maxItems || 50,
        });
        result = await waitroseScraper.run(options);
        break;
      }

      case 'albert-heijn': {
        // Albert Heijn Netherlands retail scraper
        console.log('Using browser-based Albert Heijn scraper...');
        console.log('Target: ah.nl (Netherlands)');
        console.log('Note: Albert Heijn has ~1,000+ stores across the Netherlands');

        const ahMinDelay = args.slow ? 30000 : 3000;
        const ahMaxDelay = args.slow ? 60000 : 7000;

        if (args.slow) {
          console.log('SLOW MODE: 30-60 second delays between requests');
        }
        if (args.headful) {
          console.log('HEADFUL MODE: Browser window will be visible');
        }

        const ahScraper = new AlbertHeijnScraper({
          headless: !args.headful,
          minDelay: ahMinDelay,
          maxDelay: ahMaxDelay,
          maxProducts: args.maxItems || 50,
        });
        result = await ahScraper.run(options);
        break;
      }

      case 'deliveroo': {
        // Deliveroo (UK/FR) delivery platform scraper
        console.log('Using browser-based Deliveroo scraper...');
        console.log('Targets: deliveroo.co.uk (UK), deliveroo.fr (FR)');

        // City mapping for Deliveroo
        const deliverooCityMap: Record<string, { name: string; country: 'UK' | 'FR'; slug: string }> = {
          london: { name: 'London', country: 'UK', slug: 'london' },
          manchester: { name: 'Manchester', country: 'UK', slug: 'manchester' },
          birmingham: { name: 'Birmingham', country: 'UK', slug: 'birmingham' },
          paris: { name: 'Paris', country: 'FR', slug: 'paris' },
          lyon: { name: 'Lyon', country: 'FR', slug: 'lyon' },
          marseille: { name: 'Marseille', country: 'FR', slug: 'marseille' },
        };

        let deliverooCities;
        if (args.city) {
          const cityKey = args.city.toLowerCase();
          if (!deliverooCityMap[cityKey]) {
            console.error(`Unknown city: ${args.city}`);
            console.error(`Available cities: ${Object.keys(deliverooCityMap).join(', ')}`);
            process.exit(1);
          }
          deliverooCities = [deliverooCityMap[cityKey]];
          console.log(`Scraping single city: ${args.city}`);
        }

        const deliverooMinDelay = args.slow ? 30000 : 3000;
        const deliverooMaxDelay = args.slow ? 60000 : 7000;

        if (args.slow) {
          console.log('SLOW MODE: 30-60 second delays between requests');
        }
        if (args.headful) {
          console.log('HEADFUL MODE: Browser window will be visible');
        }

        const deliverooScraper = new DeliverooScraper({
          cities: deliverooCities,
          headless: !args.headful,
          minDelay: deliverooMinDelay,
          maxDelay: deliverooMaxDelay,
          maxVenuesPerCity: args.maxItems || 10,
        });
        result = await deliverooScraper.run(options);
        break;
      }

      case 'lieferando': {
        // Lieferando (DE/AT/NL) delivery platform scraper
        console.log('Using browser-based Lieferando scraper...');
        console.log('Targets: lieferando.de (DE), lieferando.at (AT), thuisbezorgd.nl (NL)');

        // City mapping for Lieferando
        const lieferandoCityMap: Record<string, { name: string; country: 'DE' | 'AT' | 'NL'; postalCode: string; slug: string }> = {
          berlin: { name: 'Berlin', country: 'DE', postalCode: '10115', slug: 'berlin' },
          munich: { name: 'Munich', country: 'DE', postalCode: '80331', slug: 'muenchen' },
          hamburg: { name: 'Hamburg', country: 'DE', postalCode: '20095', slug: 'hamburg' },
          frankfurt: { name: 'Frankfurt', country: 'DE', postalCode: '60311', slug: 'frankfurt-am-main' },
          stuttgart: { name: 'Stuttgart', country: 'DE', postalCode: '70173', slug: 'stuttgart' },
          cologne: { name: 'Cologne', country: 'DE', postalCode: '50667', slug: 'koeln' },
          dusseldorf: { name: 'Düsseldorf', country: 'DE', postalCode: '40213', slug: 'duesseldorf' },
          vienna: { name: 'Vienna', country: 'AT', postalCode: '1010', slug: 'wien' },
        };

        let lieferandoCities;
        if (args.city) {
          const cityKey = args.city.toLowerCase();
          if (!lieferandoCityMap[cityKey]) {
            console.error(`Unknown city: ${args.city}`);
            console.error(`Available cities: ${Object.keys(lieferandoCityMap).join(', ')}`);
            process.exit(1);
          }
          lieferandoCities = [lieferandoCityMap[cityKey]];
          console.log(`Scraping single city: ${args.city}`);
        }

        // Slow mode: 30-60 second delays (safe for residential IP)
        // Normal mode: 3-7 second delays
        const lieferandoMinDelay = args.slow ? 30000 : 3000;
        const lieferandoMaxDelay = args.slow ? 60000 : 7000;

        if (args.slow) {
          console.log('SLOW MODE: 30-60 second delays between requests');
        }
        if (args.headful) {
          console.log('HEADFUL MODE: Browser window will be visible');
        }

        const lieferandoScraper = new LieferandoScraper({
          cities: lieferandoCities,
          headless: !args.headful,
          minDelay: lieferandoMinDelay,
          maxDelay: lieferandoMaxDelay,
          maxVenuesPerCity: args.maxItems || 10,
        });
        result = await lieferandoScraper.run(options);
        break;
      }

      case 'glovo': {
        // Glovo (ES/IT) delivery platform scraper
        console.log('Using browser-based Glovo scraper...');
        console.log('Targets: glovoapp.com (ES, IT)');

        // City mapping for Glovo
        const glovoCityMap: Record<string, { name: string; country: 'ES' | 'IT'; slug: string }> = {
          madrid: { name: 'Madrid', country: 'ES', slug: 'madrid' },
          barcelona: { name: 'Barcelona', country: 'ES', slug: 'barcelona' },
          valencia: { name: 'Valencia', country: 'ES', slug: 'valencia' },
          milan: { name: 'Milan', country: 'IT', slug: 'milano' },
          rome: { name: 'Rome', country: 'IT', slug: 'roma' },
          turin: { name: 'Turin', country: 'IT', slug: 'torino' },
        };

        let glovoCities;
        if (args.city) {
          const cityKey = args.city.toLowerCase();
          if (!glovoCityMap[cityKey]) {
            console.error(`Unknown city: ${args.city}`);
            console.error(`Available cities: ${Object.keys(glovoCityMap).join(', ')}`);
            process.exit(1);
          }
          glovoCities = [glovoCityMap[cityKey]];
          console.log(`Scraping single city: ${args.city}`);
        }

        const glovoMinDelay = args.slow ? 30000 : 3000;
        const glovoMaxDelay = args.slow ? 60000 : 7000;

        if (args.slow) {
          console.log('SLOW MODE: 30-60 second delays between requests');
        }
        if (args.headful) {
          console.log('HEADFUL MODE: Browser window will be visible');
        }

        const glovoScraper = new GlovoScraper({
          cities: glovoCities,
          headless: !args.headful,
          minDelay: glovoMinDelay,
          maxDelay: glovoMaxDelay,
          maxVenuesPerCity: args.maxItems || 10,
        });
        result = await glovoScraper.run(options);
        break;
      }

      case 'carrefour': {
        // Carrefour (FR/ES/IT) multi-market retail scraper
        console.log('Using browser-based Carrefour scraper...');
        console.log('Targets: carrefour.fr (FR), carrefour.es (ES), carrefour.it (IT)');

        const carrefourMinDelay = args.slow ? 30000 : 3000;
        const carrefourMaxDelay = args.slow ? 60000 : 7000;

        if (args.slow) {
          console.log('SLOW MODE: 30-60 second delays between requests');
        }
        if (args.headful) {
          console.log('HEADFUL MODE: Browser window will be visible');
        }

        const carrefourScraper = new CarrefourScraper({
          headless: !args.headful,
          minDelay: carrefourMinDelay,
          maxDelay: carrefourMaxDelay,
          maxProducts: args.maxItems || 50,
        });
        result = await carrefourScraper.run(options);
        break;
      }

      default:
        console.error(`Unknown scraper: ${args.scraper}`);
        printUsage();
        process.exit(1);
    }

    // Print results
    console.log('\n📊 Results:');
    console.log(`   Created:   ${result.stats.created}`);
    console.log(`   Updated:   ${result.stats.updated}`);
    console.log(`   Unchanged: ${result.stats.unchanged}`);
    console.log(`   Failed:    ${result.stats.failed}`);

    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      result.errors.slice(0, 10).forEach((e) => console.log(`   - ${e}`));
      if (result.errors.length > 10) {
        console.log(`   ... and ${result.errors.length - 10} more`);
      }
    }

    console.log(`\n${result.success ? '✅ Completed successfully' : '❌ Completed with errors'}\n`);
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
