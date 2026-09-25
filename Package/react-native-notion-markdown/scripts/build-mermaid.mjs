/**
 * @module react-native-notion-markdown/scripts/build-mermaid
 *
 * @file      build-mermaid.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint-disable @stylistic/max-len, @typescript-eslint/typedef */

import { dirname, relative, resolve } from "node:path";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const runtimePath = resolve(root, "src/renderer/ui/mermaidRuntime.ts");
const noticesPath = resolve(root, "ThirdPartyNotices.md");
const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0;

const result = await build({
    absWorkingDir: root,
    bundle: true,
    format: "iife",
    metafile: true,
    minify: true,
    platform: "browser",
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
    target: "es2018",
    write: false
});

const getPackageRoots = () =>
{
    const roots = new Set();

    for (const input of Object.keys(result.metafile.inputs))
    {
        const normalizedInput = input.replaceAll("\\", "/");
        const marker = normalizedInput.lastIndexOf("node_modules/");

        if (marker < 0)
        {
            continue;
        }

        const moduleStart = marker + "node_modules/".length;
        const moduleParts = normalizedInput.slice(moduleStart).split("/");
        const packagePartCount = moduleParts[0].startsWith("@") ? 2 : 1;
        const packagePath = normalizedInput.slice(0, moduleStart)
            + moduleParts.slice(0, packagePartCount).join("/");

        roots.add(resolve(root, packagePath));
    }

    return [ ...roots ];
};

const isLegalFile = (name) =>
{
    const lowerName = name.toLowerCase();

    if ([ "license", "licence", "copying", "copyright", "notice" ].includes(lowerName))
    {
        return true;
    }

    if (/^(license|licence|copying|copyright|notice)\.(md|markdown|txt)$/u.test(lowerName))
    {
        return true;
    }

    return /^(license|licence)-[^.]+(?:\.(md|markdown|txt))?$/u.test(lowerName);
};

const normalizeRepository = (repository) =>
{
    let url = typeof repository === "string" ? repository : repository?.url;

    if (!url)
    {
        return undefined;
    }

    url = url.replace(/^git\+/u, "").replace(/^git:\/\//u, "https://");
    url = url.replace(/^git@github\.com:/u, "https://github.com/");
    url = url.replace(/^github:/u, "https://github.com/").replace(/\.git$/u, "");

    if (/^[^/]+\/[^/]+$/u.test(url))
    {
        url = `https://github.com/${ url }`;
    }

    return url;
};

const packages = await Promise.all(getPackageRoots().map(async (packageRoot) =>
{
    const packageJson = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));
    const entries = await readdir(packageRoot, { withFileTypes: true });
    const legalFileNames = entries
        .filter((entry) => entry.isFile() && isLegalFile(entry.name))
        .map((entry) => entry.name)
        .sort(compareText);

    if (legalFileNames.length === 0)
    {
        throw new Error(`No license or notice file was found for bundled package ${ packageJson.name }@${ packageJson.version }.`);
    }

    const legalFiles = await Promise.all(legalFileNames.map(async (name) => ({
        name,
        text: (await readFile(resolve(packageRoot, name), "utf8")).replaceAll("\r\n", "\n").trim()
    })));

    return {
        legalFiles,
        license: typeof packageJson.license === "string" && packageJson.license.trim()
            ? packageJson.license
            : "See bundled license text",
        name: packageJson.name,
        repository: normalizeRepository(packageJson.repository),
        version: packageJson.version
    };
}));

packages.sort((left, right) => compareText(left.name, right.name) || compareText(left.version, right.version));

const escapeTableCell = (value) => value.replaceAll("|", "\\|");
const packageLink = (packageInfo) => `https://www.npmjs.com/package/${ packageInfo.name }/v/${ packageInfo.version }`;
const componentName = (packageInfo) => `${ packageInfo.name }@${ packageInfo.version }`;
const licenseGroups = new Map();

for (const packageInfo of packages)
{
    for (const legalFile of packageInfo.legalFiles)
    {
        const existingGroup = licenseGroups.get(legalFile.text) ?? [];
        existingGroup.push(`${ componentName(packageInfo) } (${ legalFile.name })`);
        licenseGroups.set(legalFile.text, existingGroup);
    }
}

const eplPackages = packages.filter((packageInfo) => packageInfo.license.split(/\s+OR\s+/u).includes("EPL-2.0"));
const noticeLines = [
    "# Third-Party Notices",
    "",
    "This file is generated from the esbuild metadata for the offline Mermaid renderer by `scripts/build-mermaid.mjs`; do not edit it by hand.",
    "",
    "The `react-native-notion-markdown` distribution includes the following third-party software. The applicable license and notice texts are reproduced below.",
    ""
];

if (eplPackages.length > 0)
{
    noticeLines.push("## EPL-2.0 Source Availability", "");

    for (const packageInfo of eplPackages)
    {
        const repository = packageInfo.repository;
        const sourceUrl = repository?.startsWith("https://github.com/")
            ? `${ repository }/tree/${ packageInfo.version }`
            : repository;

        noticeLines.push(`The corresponding source code for [${ componentName(packageInfo) }](${ packageLink(packageInfo) }) is available from ${ sourceUrl ? `[the upstream source repository at tag ${ packageInfo.version }](${ sourceUrl })` : "the upstream source repository linked from its npm package" }. The npm package page provides an additional versioned download and contact route.`);
        noticeLines.push("");
    }
}

noticeLines.push(
    "## Component Inventory",
    "",
    "| Component | Declared license | Source |",
    "| --- | --- | --- |",
    ...packages.map((packageInfo) => `| ${ escapeTableCell(componentName(packageInfo)) } | ${ escapeTableCell(packageInfo.license) } | [npm](${ packageLink(packageInfo) })${ packageInfo.repository ? ` / [repository](${ packageInfo.repository })` : "" } |`),
    "",
    "## License and Notice Texts",
    ""
);

let groupNumber = 0;

for (const [ licenseText, components ] of licenseGroups)
{
    groupNumber += 1;
    const longestBacktickRun = Math.max(0, ...[ ...licenseText.matchAll(/`+/gu) ].map((match) => match[0].length));
    const fence = "`".repeat(Math.max(4, longestBacktickRun + 1));

    noticeLines.push(
        `### License text ${ groupNumber }`,
        "",
        `Applies to: ${ components.join(", ") }`,
        "",
        `${ fence }text`,
        licenseText,
        fence,
        ""
    );
}

const thirdPartyNotices = `${ noticeLines.join("\n") }\n`;
const embeddedNotices = thirdPartyNotices
    .replaceAll("*/", "* /")
    .replace(/<\/script/giu, "<\\/script");
const bundledScript = new TextDecoder().decode(result.outputFiles[0].contents)
    .replace(/<\/script/giu, "<\\/script");
const script = `/*! Third-party notices for the bundled Mermaid runtime follow.\n${ embeddedNotices }*/\n${ bundledScript }`;
const runtimeModule = [
    "/* eslint-disable */",
    "/** Bundled offline Mermaid runtime. Regenerate with `npm run build`. */",
    `export const MERMAID_RUNTIME: string = ${ JSON.stringify(script) };`,
    "/** Notices for software included in the bundled Mermaid runtime. */",
    `export const MERMAID_THIRD_PARTY_NOTICES: string = ${ JSON.stringify(thirdPartyNotices) };`,
    ""
].join("\n");
const outputs = [
    { contents: runtimeModule, path: runtimePath },
    { contents: thirdPartyNotices, path: noticesPath }
];

if (checkOnly)
{
    const staleFiles = [];

    for (const output of outputs)
    {
        let currentContents;

        try
        {
            currentContents = await readFile(output.path, "utf8");
        }
        catch
        {
            currentContents = undefined;
        }

        if (currentContents !== output.contents)
        {
            staleFiles.push(relative(root, output.path).replaceAll("\\", "/"));
        }
    }

    if (staleFiles.length > 0)
    {
        throw new Error(`Generated Mermaid compliance artifacts are stale: ${ staleFiles.join(", ") }. Run npm run build --workspace react-native-notion-markdown and commit the results.`);
    }
}
else
{
    await Promise.all(outputs.map((output) => writeFile(output.path, output.contents)));
}
