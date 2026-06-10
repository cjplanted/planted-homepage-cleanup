/**
 * Shopify CDN image helpers.
 *
 * The Shopify CDN resizes images on the fly via the `width` query param.
 * Originals can exceed 1 MB; requesting a bounded width typically cuts
 * transfer size by 50-70% with no visible quality loss.
 */

const SHOPIFY_CDN = 'cdn.shopify.com';

/** Returns the URL constrained to `width` px (no-op for non-Shopify URLs). */
export function shopifyImage(url: string, width: number): string {
    if (!url || !url.includes(SHOPIFY_CDN)) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}width=${width}`;
}

/** Builds a srcset string for the given widths (empty for non-Shopify URLs). */
export function shopifySrcset(url: string, widths: number[]): string {
    if (!url || !url.includes(SHOPIFY_CDN)) return '';
    return widths.map((w) => `${shopifyImage(url, w)} ${w}w`).join(', ');
}
