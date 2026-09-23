/**
 *
 *
 * @module @react-native-notion-markdown/devtools-plugin/protocol
 *
 * @file      protocol.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { EditorBlock, EditorCommand, EditorEvent, EditorSnapshot } from "react-native-notion-markdown";

/** Identifies this plugin to `useDevToolsPluginClient` / the dev menu. Must match the package name. */
export const pluginName = "@react-native-notion-markdown/devtools-plugin";

/** Sent whenever the app's EditorSnapshot revision or epoch changes. */
export type SnapshotUpdateMessage = { snapshot: EditorSnapshot; dark: boolean };

/**
 * Sent after every edit the app receives from the native editor, whether it was accepted into
 * the snapshot or rejected. `reason` is a best-effort explanation computed by `diagnoseRejection`
 * below — the library's own `acceptEditorEvent` reducer does not expose why it rejected an event,
 * so this mirrors its guard clauses for display purposes only and is never authoritative.
 */
export type EventReportMessage = { event: EditorEvent; accepted: boolean; reason?: string };

/** Echoed whenever an EditorCommand is dispatched, from either an on-device button or the devtools webUI. */
export type CommandReportMessage = { command: EditorCommand };

/** Forwarded from a dev-only error boundary / global handler around the harness. */
export type ErrorReportMessage = { message: string; stack?: string };

/** WebUI asks the app to dispatch a command as if a toolbar button had been pressed. */
export type CommandRequestMessage = { action: EditorCommand["action"] };

/** WebUI asks the app to replace the document. Omitting `blocks` restores the default 3-block seed. */
export type DocumentReplaceMessage = { blocks?: Array<EditorBlock> };

/** Trivial connectivity check, useful while bringing up a fresh app/webUI pairing. */
export type PingMessage = { from: "app" | "web" };

/** Message type name -> payload shape, for both directions of the bridge. */
export type MarkdownDevToolsMessages = {
  "snapshot:update": SnapshotUpdateMessage;
  "event:report": EventReportMessage;
  "command:report": CommandReportMessage;
  "error:report": ErrorReportMessage;
  "command:request": CommandRequestMessage;
  "document:replace": DocumentReplaceMessage;
  ping: PingMessage;
};

/**
 * Re-derives a likely rejection reason by mirroring the guard clauses in the library's
 * `acceptEditorEvent` (see `Package/react-native-notion-markdown/src/prototype.ts`). This is a
 * diagnostic aid for the devtools webUI only — it never changes acceptance behavior and can
 * drift from the real reducer if that function's guards change without this being updated too.
 */
export function diagnoseRejection(current: EditorSnapshot, event: EditorEvent): string {
  if (event.epoch !== current.epoch) {
    return `Stale epoch: event epoch ${event.epoch} !== current epoch ${current.epoch}`;
  }

  if (event.revision <= current.revision) {
    return `Stale or duplicate revision: event revision ${event.revision} <= ` +
      `current revision ${current.revision}`;
  }

  const ids = new Set(event.blocks.map((block: EditorBlock) => block.id));

  if (!event.blocks.length) {
    return "Event has no blocks";
  }

  if (ids.size !== event.blocks.length) {
    return "Event contains duplicate block ids";
  }

  const invalid = event.blocks.find((block: EditorBlock) => !block.id || block.text.includes("\n") ||
    ![ "text", "heading_1" ].includes(block.type));

  if (invalid) {
    return `Invalid block "${invalid.id || "(missing id)"}": missing id, embedded newline, ` +
      "or unsupported type";
  }

  return "Rejected for an unknown reason (acceptEditorEvent's guards did not match a known case)";
}
