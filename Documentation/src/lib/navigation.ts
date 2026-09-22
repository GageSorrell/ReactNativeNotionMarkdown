/**
 *
 *
 * @module @react-native-notion-markdown/documentation/lib/navigation
 *
 * @file      navigation.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * @module @react-native-notion-markdown/documentation/lib/navigation
 * @file navigation.ts
 * @author Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license MIT
 */

export type NavigationSurface = "desktop" | "mobile"
export type NavigationGroup = "primary" | "social"

export const NAVIGATION_EVENTS = {
  SEARCH_OPEN: "docs-search:open",
  SEARCH_OPENED: "docs-search:opened",
  SEARCH_CLOSE: "docs-search:close",
  MOBILE_MENU_OPEN: "docs-mobile-menu:open"
} as const

interface NavigationLinkBase {
  readonly id: string
  readonly label: string
  readonly group: NavigationGroup
  readonly surfaces: ReadonlyArray<NavigationSurface>
  readonly icon?: "github" | "npm"
}

export interface InternalNavigationLink extends NavigationLinkBase {
  readonly kind: "internal"
  readonly href: `/${string}`
}

export interface ExternalNavigationLink extends NavigationLinkBase {
  readonly kind: "external"
  readonly href: `https://${string}`
  readonly target: "_blank"
  readonly rel: "noopener noreferrer"
}

export type NavigationLink = InternalNavigationLink | ExternalNavigationLink
export type NavigationActiveSlug = "docs"

export const NAVIGATION_LINKS: ReadonlyArray<NavigationLink> = [
  {
    id: "docs",
    kind: "internal",
    label: "Docs",
    href: "/docs/v1/onboarding/introduction",
    group: "primary",
    surfaces: ["desktop", "mobile"]
  },
  {
    id: "github",
    kind: "external",
    label: "GitHub",
    href: "https://github.com/GageSorrell/ReactNativeNotionMarkdown",
    target: "_blank",
    rel: "noopener noreferrer",
    group: "social",
    surfaces: ["desktop", "mobile"],
    icon: "github"
  },
  {
    id: "npm",
    kind: "external",
    label: "npm",
    href: "https://www.npmjs.com/package/react-native-notion-markdown",
    target: "_blank",
    rel: "noopener noreferrer",
    group: "social",
    surfaces: ["desktop", "mobile"],
    icon: "npm"
  }
]

export function getNavigationLinks(
  surface: NavigationSurface,
  group: NavigationGroup
): ReadonlyArray<NavigationLink> {
  return NAVIGATION_LINKS.filter((link) => link.group === group && link.surfaces.includes(surface))
}
