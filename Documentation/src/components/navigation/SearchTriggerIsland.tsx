/**
 *
 *
 * @module @react-native-notion-markdown/documentation/components/navigation/SearchTriggerIsland
 *
 * @file      SearchTriggerIsland.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/** @module @react-native-notion-markdown/documentation/components/navigation/SearchTriggerIsland @file SearchTriggerIsland.tsx @author Gage Sorrell <gage@sorrell.sh> @copyright (c) 2026 Gage Sorrell @license MIT */
import { Search } from "lucide-react"
import { useEffect } from "react"
interface Props { readonly mode?: "desktop" | "mobile" }
export default function SearchTriggerIsland({ mode = "desktop" }: Props) {
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); window.dispatchEvent(new Event("docs-search:open")) } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey) }, [])
  return <button type="button" onClick={() => window.dispatchEvent(new Event("docs-search:open"))} aria-label="Search documentation" className={`inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground ${mode === "mobile" ? "w-full justify-start" : ""}`}><Search size={16} aria-hidden="true" /><span>Search</span><kbd className="ml-2 hidden font-mono text-xs sm:inline">⌘K</kbd></button>
}
