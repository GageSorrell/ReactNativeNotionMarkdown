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

import type { ProofBlock, ProofCommand, ProofEvent, ProofSnapshot } from "react-native-notion-markdown";

/** Identifies this plugin to `useDevToolsPluginClient` / the dev menu. Must match the package name. */
export const pluginName = "@react-native-notion-markdown/devtools-plugin";

/** Sent whenever the app's ProofSnapshot revision or epoch changes. */
export type SnapshotUpdateMessage = { snapshot: ProofSnapshot; dark: boolean };

/**
 * Sent after every edit the app receives from the native editor, whether it was accepted into
 * the snapshot or rejected. `reason` is a best-effort explanation computed by `diagnoseRejection`
 * below — the library's own `acceptProofEvent` reducer does not expose why it rejected an event,
 * so this mirrors its guard clauses for display purposes only and is never authoritative.
 */
export type EventReportMessage = { event: ProofEvent; accepted: boolean; reason?: string };

/** Echoed whenever a ProofCommand is dispatched, from either an on-device button or the devtools webUI. */
export type CommandReportMessage = { command: ProofCommand };

/** Forwarded from a dev-only error boundary / global handler around the harness. */
export type ErrorReportMessage = { message: string; stack?: string };

/** WebUI asks the app to dispatch a command as if a toolbar button had been pressed. */
export type CommandRequestMessage = { action: ProofCommand["action"] };

/** WebUI asks the app to replace the document. Omitting `blocks` restores the default 3-block seed. */
export type DocumentReplaceMessage = { blocks?: Array<ProofBlock> };

/** Trivial connectivity check, useful while bringing up a fresh app/webUI pairing. */
export type PingMessage = { from: "app" | "web" };

/** Message type name -> payload shape, for both directions of the bridge. */
export type NotionMarkdownDevToolsMessages = {
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
 * `acceptProofEvent` (see `Package/react-native-notion-markdown/src/prototype.ts`). This is a
 * diagnostic aid for the devtools webUI only — it never changes acceptance behavior and can
 * drift from the real reducer if that function's guards change without this being updated too.
 */
export function diagnoseRejection(current: ProofSnapshot, event: ProofEvent): string {
  if (event.epoch !== current.epoch) {
    return `Stale epoch: event epoch ${event.epoch} !== current epoch ${current.epoch}`;
  }

  if (event.revision <= current.revision) {
    return `Stale or duplicate revision: event revision ${event.revision} <= ` +
      `current revision ${current.revision}`;
  }

  const ids = new Set(event.blocks.map((block: ProofBlock) => block.id));

  if (!event.blocks.length) {
    return "Event has no blocks";
  }

  if (ids.size !== event.blocks.length) {
    return "Event contains duplicate block ids";
  }

  const invalid = event.blocks.find((block: ProofBlock) => !block.id || block.text.includes("\n") ||
    ![ "paragraph", "heading_1" ].includes(block.type));

  if (invalid) {
    return `Invalid block "${invalid.id || "(missing id)"}": missing id, embedded newline, ` +
      "or unsupported type";
  }

  return "Rejected for an unknown reason (acceptProofEvent's guards did not match a known case)";
}
