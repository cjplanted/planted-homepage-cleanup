import { reviewHandlers } from './review';
import { syncHandlers } from './sync';
import { scrapingHandlers } from './scraping';
import { authHandlers } from './auth';
import { liveVenuesHandlers } from './liveVenues';

// Export all handlers combined
export const handlers = [
  ...reviewHandlers,
  ...syncHandlers,
  ...scrapingHandlers,
  ...authHandlers,
  ...liveVenuesHandlers,
];
