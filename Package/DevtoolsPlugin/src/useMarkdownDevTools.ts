/**
 *
 *
 * @module @react-native-notion-markdown/devtools-plugin/useMarkdownDevTools
 *
 * @file      useMarkdownDevTools.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { type EventSubscription, useDevToolsPluginClient } from "expo/devtools";
import { diagnoseRejection, pluginName } from "./protocol";
// The public transport types intentionally stay grouped together even though their names sort
// differently from the surrounding value imports.
// eslint-disable-next-line sort-imports
import type { EditorBlock, EditorCommand, EditorEvent, EditorSnapshot } from "react-native-notion-markdown";
import { useCallback, useEffect, useRef } from "react";

export type UseMarkdownDevToolsOptions = {
  /** The harness's current EditorSnapshot. Re-sent to the webUI whenever its epoch or revision changes. */
  snapshot: EditorSnapshot;
  /** Whether the editor is currently rendering in dark mode. */
  dark: boolean;
  /** Dispatch a command exactly as if an on-device toolbar button had been pressed. */
  dispatchCommand: (action: EditorCommand["action"]) => void;
  /** Replace the document. Called with `undefined` blocks to restore the default 3-block seed. */
  onReplaceDocument: (blocks?: Array<EditorBlock>) => void;
};

export type UseMarkdownDevToolsResult = {
  /** Report the outcome of `acceptEditorEvent` for one native edit, accepted or rejected. */
  reportEvent: (current: EditorSnapshot, event: EditorEvent, accepted: boolean) => void;
  /** Report a command that was actually dispatched, from either an on-device button or the webUI. */
  reportCommand: (command: EditorCommand) => void;
  /** Report an uncaught error from the harness, for the Diagnostics panel. */
  reportError: (error: unknown) => void;
};

type CommandRequestData = { action: EditorCommand["action"] };
type DocumentReplaceData = { blocks?: Array<EditorBlock> };

/** Bridges the harness's Editor transport state to the devtools webUI. No-ops outside development. */
export function useMarkdownDevTools(
  options: UseMarkdownDevToolsOptions
): UseMarkdownDevToolsResult {
  const client = useDevToolsPluginClient(pluginName);
  const latestOptions = useRef(options);

  useEffect(() => {
    latestOptions.current = options;
  });

  useEffect(() => {
    const subscriptions: Array<EventSubscription | undefined> = [];

    subscriptions.push(client?.addMessageListener("command:request", (data: CommandRequestData) => {
      latestOptions.current.dispatchCommand(data.action);
    }));

    subscriptions.push(client?.addMessageListener("document:replace", (data: DocumentReplaceData) => {
      latestOptions.current.onReplaceDocument(data.blocks);
    }));

    subscriptions.push(client?.addMessageListener("ping", () => {
      client?.sendMessage("ping", { from: "app" });
    }));

    return () => {
      for (const subscription of subscriptions) {
        subscription?.remove();
      }
    };
  }, [ client ]);

  useEffect(() => {
    client?.sendMessage("snapshot:update", { dark: options.dark, snapshot: options.snapshot });
    // Re-send only when the transport state actually changes, not on every harness render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ client, options.snapshot.epoch, options.snapshot.revision, options.dark ]);

  const reportEvent = useCallback((current: EditorSnapshot, event: EditorEvent, accepted: boolean) => {
    client?.sendMessage("event:report", {
      accepted,
      event,
      reason: accepted ? undefined : diagnoseRejection(current, event)
    });
  }, [ client ]);

  const reportCommand = useCallback((command: EditorCommand) => {
    client?.sendMessage("command:report", { command });
  }, [ client ]);

  const reportError = useCallback((error: unknown) => {
    const normalized = error instanceof Error ? error : new Error(String(error));
    client?.sendMessage("error:report", { message: normalized.message, stack: normalized.stack });
  }, [ client ]);

  return { reportCommand, reportError, reportEvent };
}
