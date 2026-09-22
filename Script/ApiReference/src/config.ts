/**
 *
 *
 * @module @react-native-notion-markdown/api-reference/config
 *
 * @file      config.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { dirname, join, relative, resolve } from "node:path"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

export const REFERENCE_SCHEMA_VERSION = 1
export const REFERENCE_VERSION = "v1"
export const PACKAGE_NAME = "react-native-notion-markdown"
export const PACKAGE_DIRECTORY = "Package/react-native-notion-markdown"
export const REPOSITORY_URL = "https://github.com/GageSorrell/ReactNativeNotionMarkdown"

export interface ReferenceModuleConfig {
  readonly exportPath: string
  readonly slug: string
  readonly label: string
}

export interface ReferencePackageConfig {
  readonly name: string
  readonly directory: string
  readonly group: string
  readonly repository: string
  readonly channels: readonly string[]
  readonly modules: readonly ReferenceModuleConfig[]
}

export const REFERENCE_CONFIG: ReferencePackageConfig = {
  name: PACKAGE_NAME,
  directory: PACKAGE_DIRECTORY,
  group: "React Native",
  repository: REPOSITORY_URL,
  channels: [REFERENCE_VERSION],
  modules: [
    { exportPath: ".", slug: "index", label: "Package exports" },
    { exportPath: "./renderer", slug: "renderer", label: "renderer" },
    { exportPath: "./renderer/ui", slug: "renderer-ui", label: "renderer/ui" },
    { exportPath: "./editor", slug: "editor", label: "editor" },
    { exportPath: "./editor/ui", slug: "editor-ui", label: "editor/ui" },
    { exportPath: "./editor/ui/lucide-icons", slug: "editor-ui-lucide-icons", label: "editor/ui/lucide-icons" },
    { exportPath: "./renderer/ui/inter-font", slug: "renderer-ui-inter-font", label: "renderer/ui/inter-font" },
    { exportPath: "./native", slug: "native", label: "native" },
    { exportPath: "./document", slug: "document", label: "document" }
  ]
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")

export function repositoryRoot(): string {
  return process.env.API_REFERENCE_ROOT ? resolve(process.env.API_REFERENCE_ROOT) : packageRoot
}

export function packageDirectory(): string {
  return resolve(repositoryRoot(), REFERENCE_CONFIG.directory)
}

export function dataDirectory(version = REFERENCE_VERSION): string {
  return resolve(repositoryRoot(), "Documentation/.data/api-reference", version)
}

export function relativeToRepository(path: string): string {
  const candidate = resolve(repositoryRoot(), path)
  return relative(repositoryRoot(), candidate).replaceAll("\\", "/")
}

export function sourcePathForModule(module: ReferenceModuleConfig): string {
  const packagePath = packageDirectory()
  const packageJson = requireJson(join(packagePath, "package.json")) as { exports?: Record<string, unknown> }
  const record = packageJson.exports?.[module.exportPath]
  if (!record || typeof record !== "object") throw new Error(`Export ${module.exportPath} is not a conditional export.`)
  const target = (record as Record<string, unknown>)["react-native"]
  if (typeof target !== "string") throw new Error(`Export ${module.exportPath} has no react-native target.`)
  return resolve(packagePath, target)
}

function requireJson(path: string): unknown {
  return JSON.parse(requireFile(path))
}

function requireFile(path: string): string {
  return readFileSync(path, "utf8")
}
