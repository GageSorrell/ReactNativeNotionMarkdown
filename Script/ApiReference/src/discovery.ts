/**
 *
 *
 * @module @react-native-notion-markdown/api-reference/discovery
 *
 * @file      discovery.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { existsSync, readFileSync } from "node:fs"
import { relative, resolve, sep } from "node:path"
import { packageDirectory, REFERENCE_CONFIG, relativeToRepository, sourcePathForModule, type ReferenceModuleConfig } from "./config.js"

export interface DiscoveredModule extends ReferenceModuleConfig {
  readonly sourcePath: string
  readonly sourceFile: string
}

function assertSafePackagePath(path: string): void {
  const root = resolve(packageDirectory())
  const candidate = resolve(path)
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`
  if (candidate !== root && !candidate.startsWith(prefix)) throw new Error(`Resolved export escapes package root: ${candidate}`)
  if (!existsSync(candidate)) throw new Error(`Export target does not exist: ${candidate}`)
}

export function discoverExports(): readonly DiscoveredModule[] {
  const packageJson = JSON.parse(readFileSync(resolve(packageDirectory(), "package.json"), "utf8")) as { exports?: Record<string, unknown> }
  const exports = packageJson.exports ?? {}
  const modules = REFERENCE_CONFIG.modules.map((module) => {
    if (module.exportPath === "./package.json") throw new Error("package.json is never a code-bearing reference module.")
    if (!(module.exportPath in exports)) throw new Error(`Configured export is missing from package.json: ${module.exportPath}`)
    const sourcePath = sourcePathForModule(module)
    assertSafePackagePath(sourcePath)
    return { ...module, sourcePath, sourceFile: relativeToRepository(sourcePath) }
  })
  const configured = new Set(modules.map((module) => module.exportPath))
  for (const exportPath of Object.keys(exports)) {
    if (exportPath !== "./package.json" && !configured.has(exportPath)) throw new Error(`Unconfigured code-bearing export: ${exportPath}`)
  }
  return modules
}

export function sourcePathFromRepositoryRelative(path: string): string {
  const candidate = resolve(process.cwd(), path)
  const packageRoot = resolve(packageDirectory())
  const relativePath = relative(packageRoot, candidate)
  if (relativePath.startsWith("..")) throw new Error(`Unsafe package source path: ${path}`)
  return candidate
}
