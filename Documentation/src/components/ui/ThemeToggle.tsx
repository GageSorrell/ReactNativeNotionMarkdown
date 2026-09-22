/**
 *
 *
 * @module @react-native-notion-markdown/documentation/components/ui/ThemeToggle
 *
 * @file      ThemeToggle.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * @module @react-native-notion-markdown/documentation/components/ui/ThemeToggle
 * @file ThemeToggle.tsx
 * @author Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license MIT
 */

import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

interface Props { readonly className?: string }

export default function ThemeToggle({ className }: Props) {
  const [dark, setDark] = useState(false)
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), [])
  const toggle = () => { const next = !document.documentElement.classList.contains("dark"); document.documentElement.classList.toggle("dark", next); document.documentElement.dataset.theme = next ? "dark" : "light"; localStorage.setItem("theme", next ? "dark" : "light"); setDark(next) }
  return <button type="button" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={toggle} className={`inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted ${className ?? ""}`}>{dark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}</button>
}
