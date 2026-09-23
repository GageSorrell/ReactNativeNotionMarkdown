/**
 * @module react-native-notion-markdown/scripts/build-mermaid
 *
 * @file      build-mermaid.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { dirname, resolve } from "node:path";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const result = await build({
    stdin:
    {
        contents: `import mermaid from "mermaid";
window.__renderMarkdownMermaid = async (source, id) => {
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral" });
  return (await mermaid.render(id, source)).svg;
};`,
        resolveDir: root,
        sourcefile: "mermaid-entry.js"
    },
    bundle: true,
    minify: true,
    platform: "browser",
    format: "iife",
    target: "es2018",
    write: false
});

const script = new TextDecoder().decode(result.outputFiles[0].contents);

await writeFile(
    resolve(root, "src/renderer/ui/mermaidRuntime.ts"),
    [
        "/* eslint-disable */",
        "/** Bundled offline Mermaid runtime.  Regenerate with `npm run build`. */",
        `export const MERMAID_RUNTIME = ${ JSON.stringify(script) };\n`
    ].join("\n")
);
