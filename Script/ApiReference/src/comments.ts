/**
 *
 *
 * @module @react-native-notion-markdown/api-reference/comments
 *
 * @file      comments.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

interface TypeDocComment {
  readonly summary?: readonly { readonly kind?: string; readonly text?: string }[]
  readonly blockTags?: readonly { readonly tag?: string; readonly content?: readonly { readonly kind?: string; readonly text?: string }[] }[]
}

export function commentText(comment: TypeDocComment | undefined): string {
  if (!comment) return ""
  const summary = (comment.summary ?? []).map((part) => part.text ?? "").join("")
  return summary.trim()
}

export function blockTagText(comment: TypeDocComment | undefined, tag: string): string | undefined {
  const match = comment?.blockTags?.find((item) => item.tag === `@${tag}` || item.tag === tag)
  const value = (match?.content ?? []).map((part) => part.text ?? "").join("").trim()
  return value || undefined
}

export function blockTagValues(comment: TypeDocComment | undefined, tag: string): readonly string[] {
  return (comment?.blockTags ?? []).filter((item) => item.tag === `@${tag}` || item.tag === tag).map((item) => (item.content ?? []).map((part) => part.text ?? "").join("").trim()).filter(Boolean)
}

export function renderInlineComment(value: string): string {
  return value
}
