/**
 *
 *
 * @module @react-native-notion-markdown/api-reference/cli
 *
 * @file      cli.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { generate } from "./generator.js"
import { dataDirectory, REFERENCE_VERSION, repositoryRoot } from "./config.js"
import { packageSnapshot, snapshotId, validateDataset, gitRevision } from "./snapshot.js"

const argument = (name: string, fallback?: string): string | undefined => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback
}

async function publish(version: string): Promise<void> {
  const manifest = validateDataset(version)
  const archive = await packageSnapshot(version)
  const tag = manifest.snapshotId
  try {
    execFileSync("gh", ["release", "view", tag], { cwd: repositoryRoot(), stdio: "ignore" })
    execFileSync("gh", ["release", "upload", tag, archive, "--clobber"], { cwd: repositoryRoot(), stdio: "inherit" })
  } catch {
    execFileSync("gh", ["release", "create", tag, archive, "--title", tag, "--latest=false", "--notes", `Generated API reference snapshot for ${version}.`], { cwd: repositoryRoot(), stdio: "inherit" })
  }
  const checksum = `${createHash("sha256").update(await readFile(archive)).digest("hex")}  ${archive.split(/[\\/]/).pop()}\n`
  const manifestAsset = join(repositoryRoot(), "Documentation/.data/api-reference/manifest.json")
  await writeFile(manifestAsset, `${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(`${archive}.sha256`, checksum)
  execFileSync("gh", ["release", "upload", tag, `${archive}.sha256`, manifestAsset, "--clobber"], { cwd: repositoryRoot(), stdio: "inherit" })
}

async function restore(tag: string, version: string): Promise<void> {
  const temporary = await mkdtemp(join(tmpdir(), "api-reference-"))
  try {
    execFileSync("gh", ["release", "download", tag, "--pattern", "api-reference-*.tar.gz", "--dir", temporary], { cwd: repositoryRoot(), stdio: "inherit" })
    const filename = (await readdir(temporary)).find((file) => file.endsWith(".tar.gz"))
    if (!filename) throw new Error(`Release ${tag} did not contain an API reference archive.`)
    await rm(dataDirectory(version), { recursive: true, force: true })
    await mkdir(resolve(dataDirectory(version), ".."), { recursive: true })
    const tar = await import("tar")
    await tar.x({ cwd: resolve(dataDirectory(version), ".."), file: join(temporary, filename), filter: (path) => !path.split("/").some((part) => part === ".." || part.includes("\\")) })
    validateDataset(version)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  const [command, subcommand] = process.argv.slice(2)
  const version = argument("--version", REFERENCE_VERSION) ?? REFERENCE_VERSION
  if (command === "generate") {
    const manifest = await generate(version, argument("--source-ref", "HEAD"))
    console.log(JSON.stringify({ snapshotId: manifest.snapshotId, modules: manifest.modules.length }, null, 2))
    return
  }
  if (command === "validate") {
    console.log(JSON.stringify(validateDataset(version), null, 2))
    return
  }
  if (command === "snapshot" && subcommand === "id") {
    const revision = gitRevision(argument("--source-ref", "HEAD"))
    console.log(snapshotId(version, { [version]: revision }))
    return
  }
  if (command === "snapshot" && subcommand === "package") {
    console.log(await packageSnapshot(version, argument("--output")))
    return
  }
  if (command === "snapshot" && subcommand === "publish") {
    await publish(version)
    return
  }
  if (command === "snapshot" && subcommand === "restore") {
    const tag = argument("--tag")
    if (!tag) throw new Error("snapshot restore requires --tag <api-reference-tag>.")
    await restore(tag, version)
    return
  }
  if (command === "snapshot" && subcommand === "resolve") {
    const tag = argument("--tag")
    if (!tag) throw new Error("snapshot resolve requires --tag <api-reference-tag>.")
    const result = execFileSync("gh", ["release", "view", tag, "--json", "tagName,assets"], { cwd: repositoryRoot(), encoding: "utf8" })
    console.log(result)
    return
  }
  throw new Error("Usage: cli.js generate|validate [--version v1] | snapshot id|package|publish|resolve|restore")
}

await main()
