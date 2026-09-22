/**
 *
 *
 * @module @react-native-notion-markdown/documentation/pages/og/[...slug].png
 *
 * @file      [...slug].png.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { APIRoute } from "astro"
import { getCollection } from "astro:content"
import { Resvg } from "@resvg/resvg-js"

export const prerender = true

export async function getStaticPaths() {
    const entries = await getCollection("apiReference")
    return entries.map((entry) => ({ params: { slug: entry.id.replace(/\/api\//, "/api/") }, props: { entry } }))
}

const escapeXml = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;")

export const GET: APIRoute = ({ props }) => {
    const entry = props.entry as Awaited<ReturnType<typeof getCollection<"apiReference">>>[number]
    const subtitle = entry.data.kind === "module" ? `${entry.data.packageName} · ${entry.data.label}` : entry.data.kind === "package" ? entry.data.packageName : "Generated API references"
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#10151e"/><circle cx="1030" cy="-10" r="280" fill="#233a61" opacity=".9"/><circle cx="1130" cy="580" r="240" fill="#17253d"/><text x="88" y="145" fill="#91b9ff" font-family="monospace" font-size="28">react-native-notion-markdown</text><text x="88" y="260" fill="#f8fafc" font-family="Arial, sans-serif" font-size="64" font-weight="700">${escapeXml(entry.data.title)}</text><text x="88" y="325" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="30">${escapeXml(subtitle)}</text><text x="88" y="540" fill="#91b9ff" font-family="monospace" font-size="24">${escapeXml(entry.data.version)} · API Reference</text></svg>`
    const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng()
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" } })
}
