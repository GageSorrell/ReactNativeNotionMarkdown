/**
 *
 *
 * @module @react-native-notion-markdown/api-reference/generator
 *
 * @file      generator.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { spawn } from "node:child_process"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join, resolve } from "node:path"
import { discoverExports } from "./discovery.js"
import { extractModules } from "./extract.js"
import { dataDirectory, PACKAGE_NAME, REFERENCE_CONFIG, REFERENCE_SCHEMA_VERSION, repositoryRoot } from "./config.js"
import { generatorDigest, gitRevision, sha256, snapshotId, writeChecksums } from "./snapshot.js"
import type { ReferenceManifest, ReferencePackage } from "./model.js"

const require = createRequire(import.meta.url)

async function run(command: string, args: readonly string[], cwd: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", shell: false })
    child.on("error", reject)
    child.on("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`${command} exited with ${code ?? "unknown status"}`)))
  })
}

async function runTypeDoc(output: string, entryPoints: readonly string[]): Promise<void> {
  const typedocPackage = require.resolve("typedoc/package.json")
  const typedocBin = join(resolve(typedocPackage, ".."), "bin/typedoc")
  const referenceTsConfig = resolve(repositoryRoot(), "Script/ApiReference/typedoc.tsconfig.json")
  await run(process.execPath, [typedocBin, "--json", output.replaceAll("\\", "/"), "--tsconfig", referenceTsConfig.replaceAll("\\", "/"), "--entryPointStrategy", "Resolve", "--excludePrivate", "--excludeProtected", "--excludeInternal", "--skipErrorChecking", ...entryPoints.map((entryPoint) => entryPoint.replaceAll("\\", "/"))], repositoryRoot())
}

export async function generate(version: string, sourceRef = "HEAD"): Promise<ReferenceManifest> {
  if (!REFERENCE_CONFIG.channels.includes(version)) throw new Error(`Unsupported API reference version: ${version}`)
  const modules = discoverExports()
  const revision = gitRevision(sourceRef)
  const output = dataDirectory(version)
  await rm(output, { recursive: true, force: true })
  await mkdir(join(output, "modules"), { recursive: true })
  const typedocPath = join(output, "typedoc.json")
  await runTypeDoc(typedocPath, modules.map((module) => module.sourcePath))
  const typedoc = JSON.parse(await readFile(typedocPath, "utf8")) as unknown
  const records = extractModules(typedoc, modules, revision)
  const id = snapshotId(version, { [version]: revision })
  const packageJson = JSON.parse(await readFile(resolve(repositoryRoot(), "Package/react-native-notion-markdown/package.json"), "utf8")) as { description?: string }
  const description = packageJson.description ?? "Native foundation for Markdown-formatted content in React Native."
  const manifest: ReferenceManifest = {
    schemaVersion: REFERENCE_SCHEMA_VERSION,
    version,
    snapshotId: id,
    generatorDigest: generatorDigest(),
    package: { id: `${version}/${PACKAGE_NAME}`, name: PACKAGE_NAME, group: REFERENCE_CONFIG.group, description, repository: REFERENCE_CONFIG.repository, npm: `https://www.npmjs.com/package/${PACKAGE_NAME}`, sourceRevision: revision },
    modules: records.map((record) => ({ id: record.id, slug: record.slug, label: record.label, exportPath: record.exportPath, file: `modules/${record.slug}.json`, sourceRevision: record.sourceRevision }))
  }
  await writeFile(join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(join(output, "source-revisions.json"), `${JSON.stringify({ version, revisions: { [version]: revision } }, null, 2)}\n`)
  for (const record of records) await writeFile(join(output, "modules", `${record.slug}.json`), `${JSON.stringify(record, null, 2)}\n`)
  writeChecksums(version)
  return manifest
}

export async function generatePackage(version: string): Promise<ReferencePackage> {
  const manifest = await generate(version)
  return { id: manifest.package.id, version, name: manifest.package.name, group: manifest.package.group, description: manifest.package.description, repository: manifest.package.repository, npm: manifest.package.npm, sourceRevision: manifest.package.sourceRevision, snapshotId: manifest.snapshotId, modules: [] }
}
