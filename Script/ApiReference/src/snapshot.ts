/**
 *
 *
 * @module @react-native-notion-markdown/api-reference/snapshot
 *
 * @file      snapshot.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { basename, dirname, join, relative, resolve } from "node:path"
import { create } from "tar"
import { dataDirectory, REFERENCE_CONFIG, REFERENCE_SCHEMA_VERSION, repositoryRoot } from "./config.js"
import type { ReferenceManifest, ReferenceModule, ReferencePackage } from "./model.js"

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}

export function gitRevision(ref = "HEAD"): string {
  return execFileSync("git", ["rev-parse", "--verify", ref], { cwd: repositoryRoot(), encoding: "utf8" }).trim()
}

export function generatorDigest(): string {
  const root = resolve(repositoryRoot(), "Script/ApiReference/src")
  const files: string[] = []
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory).sort()) {
      const path = join(directory, entry)
      if (statSync(path).isDirectory()) visit(path)
      else if (path.endsWith(".ts")) files.push(path)
    }
  }
  visit(root)
  return sha256(files.map((file) => `${relative(root, file)}\0${readFileSync(file).toString("utf8")}`).join("\0"))
}

export function snapshotId(version: string, revisions: Readonly<Record<string, string>>): string {
  const identity = JSON.stringify({ schemaVersion: REFERENCE_SCHEMA_VERSION, version, revisions: Object.fromEntries(Object.entries(revisions).sort(([a], [b]) => a.localeCompare(b))), generatorDigest: generatorDigest() })
  return `api-reference-${sha256(identity)}`
}

export function readManifest(version: string): ReferenceManifest {
  const path = join(dataDirectory(version), "manifest.json")
  if (!existsSync(path)) throw new Error(`Reference dataset is missing: ${path}`)
  return JSON.parse(readFileSync(path, "utf8")) as ReferenceManifest
}

export function readPackage(version: string): ReferencePackage {
  const manifest = readManifest(version)
  const modules = manifest.modules.map((module) => JSON.parse(readFileSync(join(dataDirectory(version), module.file), "utf8")) as ReferenceModule)
  return { id: manifest.package.id, version, name: manifest.package.name, group: manifest.package.group, description: manifest.package.description, repository: manifest.package.repository, npm: `https://www.npmjs.com/package/${manifest.package.name}`, sourceRevision: manifest.package.sourceRevision, snapshotId: manifest.snapshotId, modules }
}

export function writeChecksums(version: string): void {
  const root = dataDirectory(version)
  const files: Record<string, string> = {}
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory).sort()) {
      const path = join(directory, entry)
      if (statSync(path).isDirectory()) visit(path)
      else if (basename(path) !== "checksums.json") files[relative(root, path).replaceAll("\\", "/")] = sha256(readFileSync(path))
    }
  }
  visit(root)
  readFileSync(join(root, "manifest.json"))
  writeFileSync(join(root, "checksums.json"), `${JSON.stringify(files, null, 2)}\n`)
}

export function validateDataset(version: string): ReferenceManifest {
  const root = dataDirectory(version)
  const manifest = readManifest(version)
  if (manifest.schemaVersion !== REFERENCE_SCHEMA_VERSION) throw new Error(`Unsupported reference schema: ${manifest.schemaVersion}`)
  if (manifest.version !== version) throw new Error(`Dataset version mismatch: ${manifest.version}`)
  if (manifest.package.name !== REFERENCE_CONFIG.name) throw new Error(`Unexpected package: ${manifest.package.name}`)
  if (manifest.modules.length !== REFERENCE_CONFIG.modules.length) throw new Error(`Expected ${REFERENCE_CONFIG.modules.length} modules, found ${manifest.modules.length}`)
  const checksumsPath = join(root, "checksums.json")
  if (!existsSync(checksumsPath)) throw new Error("Reference checksums are missing.")
  const checksums = JSON.parse(readFileSync(checksumsPath, "utf8")) as Record<string, string>
  for (const [file, expected] of Object.entries(checksums)) {
    const path = resolve(root, file)
    const safeRelative = relative(root, path).replaceAll("\\", "/")
    if (safeRelative.startsWith("../") || safeRelative === ".." || safeRelative !== file) throw new Error(`Unsafe checksum path: ${file}`)
    if (!existsSync(path) || sha256(readFileSync(path)) !== expected) throw new Error(`Reference checksum mismatch: ${file}`)
  }
  const actualId = snapshotId(version, { [version]: manifest.package.sourceRevision })
  if (manifest.snapshotId !== actualId) throw new Error(`Snapshot identity mismatch: expected ${actualId}, found ${manifest.snapshotId}`)
  for (const module of manifest.modules) {
    if (!module.file.startsWith("modules/") || module.file.includes("..")) throw new Error(`Unsafe module path: ${module.file}`)
    const record = JSON.parse(readFileSync(join(root, module.file), "utf8")) as ReferenceModule
    if (record.slug !== module.slug || record.sourceRevision !== module.sourceRevision) throw new Error(`Module manifest mismatch: ${module.slug}`)
  }
  return manifest
}

export async function packageSnapshot(version: string, output?: string): Promise<string> {
  validateDataset(version)
  const destination = resolve(output ?? join(repositoryRoot(), `Documentation/.data/api-reference/api-reference-${version}.tar.gz`))
  mkdirSync(dirname(destination), { recursive: true })
  await create({ cwd: dirname(dataDirectory(version)), file: destination, gzip: true, portable: true }, [version])
  return destination
}
