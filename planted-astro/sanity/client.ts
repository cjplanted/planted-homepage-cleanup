import { createClient } from '@sanity/client';

// Sanity client for fetching data
// Get your project ID and dataset from https://www.sanity.io/manage
export const sanityClient = createClient({
    projectId: import.meta.env.PUBLIC_SANITY_PROJECT_ID || 'YOUR_PROJECT_ID',
    dataset: import.meta.env.PUBLIC_SANITY_DATASET || 'production',
    apiVersion: '2024-01-01',
    useCdn: true, // Use CDN for faster responses in production
});

// Preview client (for draft content)
export const previewClient = createClient({
    projectId: import.meta.env.PUBLIC_SANITY_PROJECT_ID || 'YOUR_PROJECT_ID',
    dataset: import.meta.env.PUBLIC_SANITY_DATASET || 'production',
    apiVersion: '2024-01-01',
    useCdn: false,
    token: import.meta.env.SANITY_API_TOKEN, // Required for preview
});

// Helper to get the appropriate client
export function getClient(preview = false) {
    return preview ? previewClient : sanityClient;
}
