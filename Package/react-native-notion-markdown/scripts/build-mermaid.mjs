import { build } from "esbuild";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const result = await build({
  stdin: {
    contents: `import mermaid from "mermaid";
window.__renderNotionMermaid = async (source, id) => {
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
await writeFile(resolve(root, "src/renderer/ui/mermaidRuntime.ts"), `/** Bundled offline Mermaid runtime. Regenerate with npm run build. */\nexport const MERMAID_RUNTIME = ${JSON.stringify(script)};\n`);
