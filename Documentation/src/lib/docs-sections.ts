/**
 *
 *
 * @module @react-native-notion-markdown/documentation/lib/docs-sections
 *
 * @file      docs-sections.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * @module @react-native-notion-markdown/documentation/lib/docs-sections
 * @file docs-sections.ts
 * @author Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license MIT
 */

import { getCollection, getEntries, getEntry, type CollectionEntry } from "astro:content"

export type DocsNavSection = "onboarding" | "guides" | "references"
export type DocsSidebarItem =
  | { readonly kind: "entry"; readonly entry: CollectionEntry<"docs"> }
  | { readonly kind: "group"; readonly label: string; readonly open: boolean; readonly entries: ReadonlyArray<CollectionEntry<"docs">> }

const entryLabel = (entry: CollectionEntry<"docs">): string => entry.data.sidebar?.label ?? entry.data.title
const entryOrder = (entry: CollectionEntry<"docs">): number => entry.data.sidebar?.order ?? Number.POSITIVE_INFINITY
const titleCase = (segment: string): string => segment.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")

const onboardingConfig = async (version: string) => (await getEntry("docsOnboarding", version))?.data ?? []

async function guidesItems(version: string, currentId: string): Promise<DocsSidebarItem[]> {
  const onboardingIds = new Set((await onboardingConfig(version)).flatMap((group) => group.items.map((ref) => ref.id)))
  const groupOrders = (await getEntry("docsSidebar", version))?.data ?? {}
  const byOrder = (a: CollectionEntry<"docs">, b: CollectionEntry<"docs">) => entryOrder(a) - entryOrder(b) || entryLabel(a).localeCompare(entryLabel(b))
  const roots: CollectionEntry<"docs">[] = []
  const byDir = new Map<string, CollectionEntry<"docs">[]>()

  for (const entry of await getCollection("docs")) {
    if (!entry.id.startsWith(`${version}/`) || onboardingIds.has(entry.id)) continue
    const [dir, ...rest] = entry.id.slice(version.length + 1).split("/")
    if (!dir) continue
    if (rest.length === 0) roots.push(entry)
    else byDir.set(dir, [...(byDir.get(dir) ?? []), entry])
  }

  return [
    ...roots.map((entry) => ({ item: { kind: "entry" as const, entry }, order: entryOrder(entry), label: entryLabel(entry) })),
    ...[...byDir].map(([dir, docs]) => {
      const entries = [...docs].sort(byOrder)
      return { item: { kind: "group" as const, label: titleCase(dir), open: entries.some((entry) => entry.id === currentId), entries }, order: groupOrders[dir] ?? Math.min(...entries.map(entryOrder)), label: titleCase(dir) }
    })
  ].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)).map(({ item }) => item)
}

export function flattenDocsItems(items: ReadonlyArray<DocsSidebarItem>): CollectionEntry<"docs">[] {
  return items.flatMap((item) => item.kind === "entry" ? [item.entry] : [...item.entries])
}

export function docsNeighbors(items: ReadonlyArray<DocsSidebarItem>, currentId: string) {
  const sequence = flattenDocsItems(items)
  const index = sequence.findIndex((entry) => entry.id === currentId)
  const neighbor = (entry: CollectionEntry<"docs"> | undefined) => entry ? { id: entry.id, label: entryLabel(entry) } : null
  return { prev: index > 0 ? neighbor(sequence[index - 1]) : null, next: index >= 0 && index < sequence.length - 1 ? neighbor(sequence[index + 1]) : null }
}

export async function buildDocsSidebar(version: string, currentId: string) {
  const config = await onboardingConfig(version)
  const isOnboarding = config.some((group) => group.items.some((ref) => ref.id === currentId))
  if (!isOnboarding) return { section: "guides" as const, items: await guidesItems(version, currentId) }
  const groups = await Promise.all(config.map(async (group) => {
    const entries = await getEntries(group.items)
    return { kind: "group" as const, label: group.label, open: group.isOpenByDefault ?? entries.some((entry) => entry.id === currentId), entries }
  }))
  return { section: "onboarding" as const, items: groups }
}
