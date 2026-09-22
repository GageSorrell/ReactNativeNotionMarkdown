/**
 *
 *
 * @module @react-native-notion-markdown/documentation/features/docs/rehype-heading-links
 *
 * @file      rehype-heading-links.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/** @module @react-native-notion-markdown/documentation/features/docs/rehype-heading-links @file rehype-heading-links.ts @author Gage Sorrell <gage@sorrell.sh> @copyright (c) 2026 Gage Sorrell @license MIT */
import type { Element, Root } from "hast"
export function rehypeHeadingLinks() { return (tree: Root) => walk(tree) }
function walk(parent: Root | Element): void { for (const child of parent.children) { if (child.type !== "element") continue; const id = child.properties.id; if (/^h[1-6]$/.test(child.tagName) && typeof id === "string") { child.children.unshift({ type: "element", tagName: "a", properties: { ariaLabel: "Link to this section", className: ["heading-permalink"], href: `#${id}` }, children: [{ type: "element", tagName: "svg", properties: { viewBox: "0 0 24 24", ariaHidden: "true" }, children: [{ type: "element", tagName: "path", properties: { d: "M8 12h8M12 8v8", stroke: "currentColor", strokeWidth: "2", fill: "none" }, children: [] }] }] } satisfies Element); continue } walk(child) } }
