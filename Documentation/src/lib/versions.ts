/**
 *
 *
 * @module @react-native-notion-markdown/documentation/lib/versions
 *
 * @file      versions.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * @module @react-native-notion-markdown/documentation/lib/versions
 * @file versions.ts
 * @author Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license MIT
 */

export const DOCS_VERSIONS = [{ value: "v1", label: "v1" }] as const

export type DocsVersion = (typeof DOCS_VERSIONS)[number]["value"]

export const defaultDocsVersion: DocsVersion = "v1"

export function isDocsVersion(value: string | undefined): value is DocsVersion {
  return DOCS_VERSIONS.some((version) => version.value === value)
}

export function docsVersionFromPathname(pathname: string): DocsVersion {
  const [, section, version] = pathname.split("/")
  return section === "docs" && isDocsVersion(version) ? version : defaultDocsVersion
}
