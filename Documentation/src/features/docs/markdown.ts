/**
 *
 *
 * @module @react-native-notion-markdown/documentation/features/docs/markdown
 *
 * @file      markdown.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/** @module @react-native-notion-markdown/documentation/features/docs/markdown @file markdown.ts @author Gage Sorrell <gage@sorrell.sh> @copyright (c) 2026 Gage Sorrell @license MIT */
export interface DocsPageMarkdownInput { readonly title: string; readonly body: string }
export function docsPageToMarkdown(input: DocsPageMarkdownInput): string { return `# ${input.title}\n\n${docsBodyToMarkdown(input.body)}` }
export function docsBodyToMarkdown(body: string): string { return body.replace(/<\/?(?:Aside|Steps|Tabs|TabItem)[^>]*>/g, "").replace(/<Badge\s+text=["']([^"']+)["'][^>]*\/?>(?:<\/Badge>)?/g, "**$1**").trim() + "\n" }
export function markdownSlugForDocId(id: string): string { return `${id.replace(/\/index$/, "")}.md` }
