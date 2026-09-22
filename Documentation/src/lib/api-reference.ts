/**
 *
 *
 * @module @react-native-notion-markdown/documentation/lib/api-reference
 *
 * @file      api-reference.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { CollectionEntry } from "astro:content"

export type ApiReferenceEntry = CollectionEntry<"apiReference">
export type ApiDeclaration = NonNullable<ApiReferenceEntry["data"]["declarations"]>[number]

export const API_REFERENCE_SECTION = "references" as const

export function apiEntryHref(entry: ApiReferenceEntry): string {
    return `/docs/${entry.data.version}/api/${entry.data.packageSlug}${entry.data.moduleSlug ? `/${entry.data.moduleSlug}` : ""}`
}

export function apiDeclarationGroups(declarations: readonly ApiDeclaration[]) {
    const categories = [ "Classes", "Functions", "Interfaces", "Types", "Variables", "Enums", "Other" ] as const
    return categories.map((category) => ({ category, declarations: declarations.filter((declaration) => declaration.category === category) })).filter((group) => group.declarations.length > 0)
}

export function apiDeclarationToc(declarations: readonly ApiDeclaration[]) {
    return declarations.flatMap((declaration) => [ { id: declaration.anchor, label: declaration.name, indent: false }, ...declaration.children.map((child) => ({ id: child.anchor, label: child.name, indent: true })) ])
}

export function apiVersionHref(version: string, entry: ApiReferenceEntry): string {
    return `/docs/${version}/api/${entry.data.packageSlug}${entry.data.moduleSlug ? `/${entry.data.moduleSlug}` : ""}`
}

export function declarationKindLabel(declaration: ApiDeclaration): string {
    return declaration.kind.toLowerCase()
}
