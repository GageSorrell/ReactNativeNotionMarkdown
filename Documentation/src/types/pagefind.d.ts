/**
 *
 *
 * @module @react-native-notion-markdown/documentation/types/pagefind.d
 *
 * @file      pagefind.d.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/** @module @react-native-notion-markdown/documentation/types/pagefind @file pagefind.d.ts @author Gage Sorrell <gage@sorrell.sh> @copyright (c) 2026 Gage Sorrell @license MIT */
export interface PagefindSubResult { readonly url: string; readonly title?: string; readonly excerpt?: string }
export interface PagefindSearchResult { readonly url: string; readonly excerpt: string; readonly meta?: { readonly title?: string; readonly content_type?: string; readonly version?: string; readonly package?: string; readonly module?: string }; readonly sub_results?: readonly PagefindSubResult[] }
export interface PagefindModule { search(query: string, options?: { readonly filters?: Record<string, string | readonly string[]> }): Promise<{ results: Array<{ data(): Promise<PagefindSearchResult> }> }> }
declare module "*.pagefind.js" { const pagefind: PagefindModule; export = pagefind }
