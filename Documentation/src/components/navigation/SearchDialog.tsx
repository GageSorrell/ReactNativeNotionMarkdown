/**
 *
 *
 * @module @react-native-notion-markdown/documentation/components/navigation/SearchDialog
 *
 * @file      SearchDialog.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * @module @react-native-notion-markdown/documentation/components/navigation/SearchDialog
 * @file SearchDialog.tsx
 * @author Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license MIT
 */

import { Search, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { PagefindModule, PagefindSearchResult } from "@/types/pagefind"

interface Props { readonly version?: string }

export default function SearchDialog({ version = "v1" }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PagefindSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const show = () => setOpen(true)
    const hide = () => setOpen(false)
    window.addEventListener("docs-search:open", show)
    window.addEventListener("docs-search:close", hide)
    return () => { window.removeEventListener("docs-search:open", show); window.removeEventListener("docs-search:close", hide) }
  }, [])
  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 0) }, [open])
  useEffect(() => {
    if (!open || query.trim().length < 2) { setResults([]); return }
    let cancelled = false
    setLoading(true)
    void (async () => {
      const pagefindPath = "/pagefind/pagefind.js"
      const pagefind = await import(/* @vite-ignore */ pagefindPath) as unknown as PagefindModule
      const response = await pagefind.search(query, { filters: { version } })
      const loaded = await Promise.all(response.results.slice(0, 12).map((result) => result.data()))
      if (!cancelled) { setResults(loaded); setLoading(false) }
    })().catch(() => { if (!cancelled) { setResults([]); setLoading(false) } })
    return () => { cancelled = true }
  }, [open, query, version])

  useEffect(() => { if (!open) return; const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false) }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey) }, [open])
  if (!open) return null
  return <div className="fixed inset-0 z-200 grid place-items-start bg-black/35 px-4 pt-[12vh]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}><section role="dialog" aria-modal="true" aria-label="Search documentation" className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-background shadow-2xl"><div className="flex items-center gap-3 border-b border-border px-4"><Search size={18} className="text-muted-foreground" aria-hidden="true" /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${version} documentation`} className="min-w-0 flex-1 bg-transparent py-4 outline-none" /><button type="button" onClick={() => setOpen(false)} aria-label="Close search" className="rounded p-1 text-muted-foreground hover:bg-muted"><X size={18} /></button></div><div className="max-h-[55vh] overflow-y-auto p-3">{loading && <p className="p-4 text-sm text-muted-foreground">Searching…</p>}{!loading && query.trim().length >= 2 && results.length === 0 && <p className="p-4 text-sm text-muted-foreground">No matching pages.</p>}{results.map((result) => <div key={result.url} className="rounded-lg p-3 hover:bg-muted"><a href={result.url} onClick={() => setOpen(false)} className="block"><div className="flex items-center gap-2"><p className="font-medium">{result.meta?.title ?? "Documentation"}</p><span className="rounded-full bg-accent px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{result.meta?.content_type === "reference" ? "Reference" : "Documentation"}</span></div><p className="mt-1 text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: result.excerpt }} /></a>{result.sub_results && result.sub_results.length > 0 && <div className="mt-2 border-l border-border pl-3">{result.sub_results.slice(0, 5).map((subResult) => <a key={subResult.url} href={subResult.url} onClick={() => setOpen(false)} className="mt-1 block text-sm text-muted-foreground hover:text-foreground">{subResult.title ?? "Declaration"}</a>)}</div>}</div>)}</div><div className="border-t border-border px-4 py-2 font-mono text-xs text-muted-foreground">Pagefind · {version} · Esc to close</div></section></div>
}
