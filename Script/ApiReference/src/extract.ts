/**
 *
 *
 * @module @react-native-notion-markdown/api-reference/extract
 *
 * @file      extract.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { readFileSync } from "node:fs"
import { basename, relative } from "node:path"
import { commentText, blockTagText, blockTagValues, renderInlineComment } from "./comments.js"
import type { DiscoveredModule } from "./discovery.js"
import type { ReferenceDeclaration, ReferenceModule, ReferenceSource } from "./model.js"
import { relativeToRepository, REFERENCE_CONFIG, REFERENCE_VERSION, UNKNOWN_SOURCE_REVISION } from "./config.js"

type Reflection = Record<string, any>

const reflectionKinds: Record<number, string> = { 1: "Project", 2: "Module", 4: "Namespace", 8: "Enumeration", 16: "Enumeration member", 32: "Variable", 64: "Function", 128: "Class", 256: "Interface", 512: "Constructor", 1024: "Property", 2048: "Method", 4096: "Call signature", 8192: "Index signature", 16384: "Constructor signature", 32768: "Parameter", 65536: "Type literal", 131072: "Type parameter", 262144: "Accessor", 524288: "Get signature", 1048576: "Set signature", 2097152: "Type alias", 4194304: "Reference" }

function kindName(reflection: Reflection): string {
  if (typeof reflection.kindString === "string") return reflection.kindString
  if (typeof reflection.kind === "number") return reflectionKinds[reflection.kind] ?? "Declaration"
  return "Declaration"
}

const categoryForKind = (kind: string): ReferenceDeclaration["category"] => {
  if (kind === "Class" || kind === "Constructor" || kind === "Method" || kind === "Accessor") return "Classes"
  if (kind === "Function") return "Functions"
  if (kind === "Interface") return "Interfaces"
  if (kind === "Type alias" || kind === "Type literal" || kind === "Type parameter") return "Types"
  if (kind === "Variable" || kind === "Property") return "Variables"
  if (kind === "Enumeration" || kind === "Enumeration member") return "Enums"
  return "Other"
}

const slugify = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "declaration"

function sourceFor(reflection: Reflection, revision: string): ReferenceSource | undefined {
  const source = reflection.sources?.[0]
  if (!source?.fileName) return undefined
  const file = relativeToRepository(source.fileName)
  const line = source.line ?? source.lineStart
  const sourceRevision = revision === UNKNOWN_SOURCE_REVISION ? "master" : revision
  return { file, line, character: source.character, revision, url: `${REFERENCE_CONFIG.repository}/blob/${sourceRevision}/${file}${line ? `#L${line}` : ""}` }
}

function typeText(reflection: Reflection): string {
  const type = reflection.type
  if (type?.name) return type.name
  if (type?.declaration) return type.declaration.signatures?.map((signature: Reflection) => signature.name).join(" | ") || "object"
  if (reflection.flags?.isConst) return "const"
  return "unknown"
}

function signatureFor(reflection: Reflection): string {
  const kind = kindName(reflection)
  const name = reflection.name ?? "unknown"
  if (reflection.signatures?.length) {
    const signature = reflection.signatures[0]
    const parameters = (signature.parameters ?? []).map((parameter: Reflection) => `${parameter.name}${parameter.flags?.isOptional ? "?" : ""}: ${typeText(parameter)}`).join(", ")
    const returnType = signature.type ? `: ${typeText(signature)}` : ""
    return `${kind.toLowerCase()} ${name}(${parameters})${returnType}`
  }
  if (kind === "Type alias") return `type ${name} = ${typeText(reflection)}`
  if (kind === "Interface") return `interface ${name}`
  if (kind === "Class") return `class ${name}`
  if (kind === "Variable") return `const ${name}: ${typeText(reflection)}`
  return `${kind.toLowerCase()} ${name}`
}

function declarationFromReflection(reflection: Reflection, revision: string, parentAnchor = "", references: ReadonlyMap<number, Reflection> = new Map()): ReferenceDeclaration {
  if (reflection.variant === "reference" && typeof reflection.target === "number" && references.has(reflection.target)) reflection = { ...reflection, ...references.get(reflection.target), name: reflection.name ?? references.get(reflection.target)?.name, sources: reflection.sources ?? references.get(reflection.target)?.sources }
  const name = String(reflection.name ?? "anonymous")
  const anchor = `${parentAnchor ? `${parentAnchor}-` : ""}${slugify(name)}`
  const comment = reflection.comment ?? reflection.signatures?.[0]?.comment
  const children = (reflection.children ?? []).filter((child: Reflection) => !child.flags?.isPrivate && !child.flags?.isProtected && !child.flags?.isInternal).map((child: Reflection) => declarationFromReflection(child, revision, anchor, references))
  return {
    id: String(reflection.id ?? anchor),
    name,
    kind: kindName(reflection),
    category: categoryForKind(kindName(reflection)),
    anchor,
    signature: signatureFor(reflection),
    description: renderInlineComment(commentText(comment)),
    examples: blockTagValues(comment, "example"),
    since: blockTagText(comment, "since"),
    see: blockTagValues(comment, "see").map(renderInlineComment),
    source: sourceFor(reflection, revision),
    children
  }
}

function exportedNamesFromSource(path: string, revision: string): readonly ReferenceDeclaration[] {
  const source = readFileSync(path, "utf8")
  const declarations: ReferenceDeclaration[] = []
  const declarationPattern = /(?:^|\n)\s*export\s+(?:(?:declare|default)\s+)?(class|function|interface|type|const|let|var|enum)\s+([A-Za-z_$][\w$]*)/g
  for (const match of source.matchAll(declarationPattern)) {
    const kind = match[1] === "type" ? "Type alias" : match[1].charAt(0).toUpperCase() + match[1].slice(1)
    const line = source.slice(0, match.index ?? 0).split("\n").length
    const file = relativeToRepository(path)
    const sourceRevision = revision === UNKNOWN_SOURCE_REVISION ? "master" : revision
    declarations.push({ id: `${file}:${match[2]}`, name: match[2], kind, category: categoryForKind(kind), anchor: slugify(match[2]), signature: `${match[1]} ${match[2]}`, description: "", examples: [], see: [], source: { file, line, revision, url: `${REFERENCE_CONFIG.repository}/blob/${sourceRevision}/${file}#L${line}` }, children: [] } as ReferenceDeclaration)
  }
  return declarations
}

export function extractModules(typedoc: unknown, modules: readonly DiscoveredModule[], revision: string): readonly ReferenceModule[] {
  const root = typedoc as Reflection
  const reflections = [root, ...(root.children ?? [])]
  const references = new Map<number, Reflection>()
  const collect = (reflection: Reflection) => { if (typeof reflection.id === "number") references.set(reflection.id, reflection); for (const child of reflection.children ?? []) collect(child) }
  collect(root)
  const allReflections = reflections.flatMap((reflection: Reflection) => [reflection, ...(reflection.children ?? [])])
  return modules.map((module) => {
    const sourceSuffix = module.sourceFile.replaceAll("\\", "/")
    const candidates = allReflections.filter((reflection: Reflection) => reflection.name === module.label || reflection.name === basename(module.sourcePath, ".ts") || reflection.sources?.some((source: Reflection) => String(source.fileName).replaceAll("\\", "/").endsWith(sourceSuffix)))
    const owner = candidates.find((reflection: Reflection) => reflection.children?.length) ?? candidates[0]
    const declarations = owner?.children?.filter((child: Reflection) => !child.flags?.isPrivate && !child.flags?.isProtected && !child.flags?.isInternal).map((child: Reflection) => declarationFromReflection(child, revision, "", references)) ?? []
    const fallback = declarations.length ? declarations : exportedNamesFromSource(module.sourcePath, revision)
    return { id: `${REFERENCE_VERSION}/${REFERENCE_CONFIG.name}/${module.slug}`, slug: module.slug, label: module.label, exportPath: module.exportPath, title: module.label === "Package exports" ? REFERENCE_CONFIG.name : module.label, description: `Public API declarations exported by ${module.exportPath === "." ? REFERENCE_CONFIG.name : `${REFERENCE_CONFIG.name}${module.exportPath.slice(1)}`}.`, sourceFile: module.sourceFile, sourceRevision: revision, declarations: dedupeDeclarations(fallback) }
  })
}

function dedupeDeclarations(declarations: readonly ReferenceDeclaration[]): readonly ReferenceDeclaration[] {
  const seen = new Set<string>()
  return declarations.filter((declaration) => !seen.has(declaration.name) && seen.add(declaration.name))
}
