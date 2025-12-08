// Base scraper
export { BaseScraper } from './base/BaseScraper.js';
export type { ScraperResult, ScraperOptions } from './base/BaseScraper.js';

// Scrapers
export { GoogleSheetsScraper } from './scrapers/GoogleSheetsScraper.js';
export type { GoogleSheetsScraperConfig } from './scrapers/GoogleSheetsScraper.js';

export { WebMenuScraper } from './scrapers/WebMenuScraper.js';
export type { WebMenuScraperConfig } from './scrapers/WebMenuScraper.js';

// Delivery Platform Scrapers
export { WoltScraper } from './scrapers/delivery/WoltScraper.js';
export type { WoltScraperConfig } from './scrapers/delivery/WoltScraper.js';

export { UberEatsScraper } from './scrapers/delivery/UberEatsScraper.js';
export type { UberEatsScraperConfig } from './scrapers/delivery/UberEatsScraper.js';

// Browser-based scrapers (requires puppeteer)
export { WoltBrowserScraper } from './scrapers/delivery/WoltBrowserScraper.js';
export type { WoltBrowserScraperConfig } from './scrapers/delivery/WoltBrowserScraper.js';

// Discovery tools
export { GoogleSearchDiscovery } from './scrapers/discovery/GoogleSearchDiscovery.js';
export type { GoogleSearchDiscoveryConfig } from './scrapers/discovery/GoogleSearchDiscovery.js';

// Retail scrapers
export { CoopScraper } from './scrapers/retail/CoopScraper.js';
export type { CoopScraperConfig } from './scrapers/retail/CoopScraper.js';

export { MigrosScraper } from './scrapers/retail/MigrosScraper.js';
export type { MigrosScraperConfig } from './scrapers/retail/MigrosScraper.js';

export { ReweScraper } from './scrapers/retail/ReweScraper.js';
export type { ReweScraperConfig } from './scrapers/retail/ReweScraper.js';

export { EdekaScraper } from './scrapers/retail/EdekaScraper.js';
export type { EdekaScraperConfig } from './scrapers/retail/EdekaScraper.js';

export { SainsburysScraper } from './scrapers/retail/SainsburysScraper.js';
export type { SainsburysScraperConfig } from './scrapers/retail/SainsburysScraper.js';

export { WaitroseScraper } from './scrapers/retail/WaitroseScraper.js';
export type { WaitroseScraperConfig } from './scrapers/retail/WaitroseScraper.js';

export { AlbertHeijnScraper } from './scrapers/retail/AlbertHeijnScraper.js';
export type { AlbertHeijnScraperConfig } from './scrapers/retail/AlbertHeijnScraper.js';

export { LieferandoScraper } from './scrapers/delivery/LieferandoScraper.js';
export type { LieferandoScraperConfig } from './scrapers/delivery/LieferandoScraper.js';

export { DeliverooScraper } from './scrapers/delivery/DeliverooScraper.js';
export type { DeliverooScraperConfig } from './scrapers/delivery/DeliverooScraper.js';

export { GlovoScraper } from './scrapers/delivery/GlovoScraper.js';
export type { GlovoScraperConfig } from './scrapers/delivery/GlovoScraper.js';

export { CarrefourScraper } from './scrapers/retail/CarrefourScraper.js';
export type { CarrefourScraperConfig } from './scrapers/retail/CarrefourScraper.js';

// Browser utilities
export * from './browser/BrowserScraper.js';

// Utilities
export { createHttpClient, fetchWithRetry, fetchJSON, fetchHTML } from './utils/http.js';
export type { HttpClientOptions } from './utils/http.js';

export { createQueue, processWithQueue, sleep, jitter } from './utils/queue.js';
export type { QueueOptions } from './utils/queue.js';
