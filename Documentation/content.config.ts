/**
 *
 *
 * @module @react-native-notion-markdown/documentation/content.config
 *
 * @file      content.config.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { file, glob } from "astro/loaders";
import { z } from "astro/zod";
import { defineCollection, reference } from "astro:content";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const docsSidebar = defineCollection({
    loader: file("./src/content/docs/sidebar-config.json"),
    schema: z.record(z.string(), z.number())
});

const docsOnboarding = defineCollection({
    loader: file("./src/content/docs/onboarding-groups.json"),
    schema: z.array(
        z.object({
            isOpenByDefault: z.boolean().optional(),
            items: z.array(reference("docs")),
            label: z.string()
        })
    )
});

const docs = defineCollection({
    loader: glob({
        base: "./src/content/docs",
        pattern: "**/[^_]*.{md,mdx}"
    }),
    schema: z.object({
        description: z.string().optional(),
        draft: z.boolean().optional(),
        sidebar: z
            .object({
                hidden: z.boolean().optional(),
                label: z.string().optional(),
                order: z.number().optional()
            })
            .optional(),
        tableOfContents: z
            .union([
                z.boolean(),
                z.object({
                    maxHeadingLevel: z.number().optional(),
                    minHeadingLevel: z.number().optional()
                })
            ])
            .optional(),
        title: z.string()
    })
});

const apiDeclaration = z.object({
    id: z.string(),
    name: z.string(),
    kind: z.string(),
    category: z.enum([ "Classes", "Functions", "Interfaces", "Types", "Variables", "Enums", "Other" ]),
    anchor: z.string(),
    signature: z.string(),
    description: z.string(),
    examples: z.array(z.string()),
    since: z.string().optional(),
    see: z.array(z.string()),
    source: z.object({ file: z.string(), line: z.number().optional(), character: z.number().optional(), revision: z.string(), url: z.string() }).optional(),
    children: z.array(z.any())
});

const apiReference = defineCollection({
    schema: z.object({
            kind: z.enum([ "landing", "package", "module" ]),
            version: z.string(),
            packageName: z.string(),
            packageSlug: z.string(),
            moduleSlug: z.string().optional(),
            title: z.string(),
            label: z.string(),
            description: z.string(),
            group: z.string(),
            repository: z.string(),
            npm: z.string(),
            sourceRevision: z.string(),
            snapshotId: z.string(),
            sourceFile: z.string().optional(),
            exportPath: z.string().optional(),
            modules: z.array(z.object({ slug: z.string(), label: z.string(), href: z.string() })).optional(),
            symbolLinks: z.record(z.string(), z.string()).optional(),
            declarations: z.array(apiDeclaration).optional()
        }),
    loader: {
        name: "api-reference",
        async load({ store }) {
            const dataRoot = resolve(process.cwd(), ".data/api-reference");
            if (!existsSync(dataRoot)) return;
            for (const version of readdirSync(dataRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
                const versionRoot = join(dataRoot, version.name);
                const manifestPath = join(versionRoot, "manifest.json");
                if (!existsSync(manifestPath)) continue;
                const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
                validateApiDataset(versionRoot, manifest);
                const packageSlug = manifest.package.name;
                const records = manifest.modules.map((module: { file: string }) => JSON.parse(readFileSync(join(versionRoot, module.file), "utf8")));
                const symbolLinks: Record<string, string> = {};
                const addSymbols = (declarations: Array<{ name: string; anchor: string; children?: Array<{ name: string; anchor: string }> }>, href: string) => { for (const declaration of declarations) { symbolLinks[declaration.name] ??= `${href}#${declaration.anchor}`; for (const child of declaration.children ?? []) symbolLinks[child.name] ??= `${href}#${child.anchor}`; } };
                for (const record of records) addSymbols(record.declarations, `/docs/${version.name}/api/${packageSlug}/${record.slug}`);
                store.set({ id: `${version.name}/api`, data: { kind: "landing", version: version.name, packageName: manifest.package.name, packageSlug, title: "API References", label: "References", description: "Generated API references for react-native-notion-markdown.", group: manifest.package.group, repository: manifest.package.repository, npm: manifest.package.npm, sourceRevision: manifest.package.sourceRevision, snapshotId: manifest.snapshotId, modules: [ ...manifest.modules.map((module: { slug: string; label: string }) => ({ slug: module.slug, label: module.label, href: `/docs/${version.name}/api/${packageSlug}/${module.slug}` })) ] } });
                store.set({ id: `${version.name}/api/${packageSlug}`, data: { kind: "package", version: version.name, packageName: manifest.package.name, packageSlug, title: manifest.package.name, label: manifest.package.name, description: manifest.package.description, group: manifest.package.group, repository: manifest.package.repository, npm: manifest.package.npm, sourceRevision: manifest.package.sourceRevision, snapshotId: manifest.snapshotId, modules: [ ...manifest.modules.map((module: { slug: string; label: string }) => ({ slug: module.slug, label: module.label, href: `/docs/${version.name}/api/${packageSlug}/${module.slug}` })) ], symbolLinks } });
                for (const module of manifest.modules) {
                    const record = records.find((item: { slug: string }) => item.slug === module.slug);
                    store.set({ id: `${version.name}/api/${packageSlug}/${module.slug}`, data: { kind: "module", version: version.name, packageName: manifest.package.name, packageSlug, moduleSlug: module.slug, title: record.title, label: record.label, description: record.description, group: manifest.package.group, repository: manifest.package.repository, npm: manifest.package.npm, sourceRevision: manifest.package.sourceRevision, snapshotId: manifest.snapshotId, sourceFile: record.sourceFile, exportPath: record.exportPath, modules: [ ...manifest.modules.map((item: { slug: string; label: string }) => ({ slug: item.slug, label: item.label, href: `/docs/${version.name}/api/${packageSlug}/${item.slug}` })) ], declarations: record.declarations } });
                    store.set({ id: `${version.name}/api/${packageSlug}/${module.slug}`, data: { kind: "module", version: version.name, packageName: manifest.package.name, packageSlug, moduleSlug: module.slug, title: record.title, label: record.label, description: record.description, group: manifest.package.group, repository: manifest.package.repository, npm: manifest.package.npm, sourceRevision: manifest.package.sourceRevision, snapshotId: manifest.snapshotId, sourceFile: record.sourceFile, exportPath: record.exportPath, modules: [ ...manifest.modules.map((item: { slug: string; label: string }) => ({ slug: item.slug, label: item.label, href: `/docs/${version.name}/api/${packageSlug}/${item.slug}` })) ], symbolLinks, declarations: record.declarations } });
                }
            }
        }
    }
});

function validateApiDataset(versionRoot: string, manifest: { schemaVersion: number; version: string; snapshotId: string; package: { name: string; repository: string; sourceRevision: string }; modules: Array<{ slug: string; file: string; sourceRevision: string }> }): void {
    if (manifest.schemaVersion !== 1 || manifest.version.length === 0 || !/^api-reference-[0-9a-f]{64}$/.test(manifest.snapshotId)) throw new Error(`Invalid API reference manifest in ${versionRoot}`);
    if (manifest.package.name !== "react-native-notion-markdown" || !manifest.package.repository.startsWith("https://") || !/^[0-9a-f]{40}$/.test(manifest.package.sourceRevision)) throw new Error(`Invalid API reference package metadata in ${versionRoot}`);
    const root = resolve(versionRoot);
    const safePath = (relativePath: string): string => { const candidate = resolve(root, relativePath); if (relative(root, candidate).startsWith("..") || relativePath.includes("\\")) throw new Error(`Unsafe API reference path: ${relativePath}`); return candidate; };
    const checksumsPath = safePath("checksums.json");
    if (!existsSync(checksumsPath)) throw new Error(`Missing API reference checksums in ${versionRoot}`);
    const checksums = JSON.parse(readFileSync(checksumsPath, "utf8")) as Record<string, string>;
    for (const [relativePath, checksum] of Object.entries(checksums)) { const path = safePath(relativePath); if (!existsSync(path) || createHash("sha256").update(readFileSync(path)).digest("hex") !== checksum) throw new Error(`API reference checksum mismatch: ${relativePath}`); }
    for (const module of manifest.modules) { if (!module.file.startsWith("modules/") || module.file.includes("..")) throw new Error(`Unsafe API reference module path: ${module.file}`); const record = JSON.parse(readFileSync(safePath(module.file), "utf8")) as { sourceRevision?: string; sourceFile?: string }; if (record.sourceRevision !== manifest.package.sourceRevision || record.sourceFile?.includes("..")) throw new Error(`API reference revision or source path mismatch: ${module.slug}`); }
}

export const collections = { docs, docsSidebar, docsOnboarding, apiReference };
