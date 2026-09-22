import { readFileSync, readdirSync } from "node:fs"
import { join, relative, resolve } from "node:path"

const root = resolve("dist")
const htmlFiles = []
const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) visit(path)
        else if (entry.name.endsWith(".html")) htmlFiles.push(path)
    }
}
visit(root)
const htmlByPath = new Set(htmlFiles.map((path) => `/${relative(root, path).replaceAll("\\", "/")}`))
const idsByPath = new Map(htmlFiles.map((path) => [`/${relative(root, path).replaceAll("\\", "/")}`, new Set([...readFileSync(path, "utf8").matchAll(/\bid="([^\"]+)"/g)].map((match) => match[1]))]))
const errors = []
for (const file of htmlFiles) {
    const source = readFileSync(file, "utf8")
    if (/<(?:a|code)[^>]+(?:href|src)="module:|>module:[^<]+</.test(source)) errors.push(`${relative(root, file)} contains an unresolved module: reference`)
    for (const match of source.matchAll(/href="(\/[^"#]+)(?:#([^" ]+))?"/g)) {
        const href = match[1]
        if (/\.(?:css|js|svg|png|ico|woff2?)(?:\?.*)?$/.test(href)) continue
        const target = href.endsWith("/") ? `${href}index.html` : href.endsWith(".html") ? href : `${href}/index.html`
        if (!htmlByPath.has(target)) errors.push(`${relative(root, file)} links to missing ${href}`)
        else if (match[2] && !idsByPath.get(target)?.has(match[2])) errors.push(`${relative(root, file)} links to missing fragment ${href}#${match[2]}`)
    }
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1) }
console.log(`Verified ${htmlFiles.length} HTML files and internal links.`)
