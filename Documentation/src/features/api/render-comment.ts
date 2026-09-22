/**
 *
 *
 * @module @react-native-notion-markdown/documentation/features/api/render-comment
 *
 * @file      render-comment.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import rehypeRaw from "rehype-raw"
import rehypeStringify from "rehype-stringify"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"

export function renderApiComment(value: string, symbolLinks: Readonly<Record<string, string>> = {}): string {
    const resolve = (name: string): string => symbolLinks[name.trim()] ?? `#${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
    const source = value.replace(/\{@linkcode\s+([^}]+)\}/g, (_, name: string) => `[\`${name.trim()}\`](${resolve(name)})`).replace(/\{@link\s+([^}]+)\}/g, (_, name: string) => `[${name.trim()}](${resolve(name)})`)
    return String(unified().use(remarkParse).use(remarkGfm).use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw).use(rehypeStringify).processSync(source))
}
