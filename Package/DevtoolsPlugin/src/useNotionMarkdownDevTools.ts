/**
 *
 *
 * @module @react-native-notion-markdown/devtools-plugin/useNotionMarkdownDevTools
 *
 * @file      useNotionMarkdownDevTools.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { type EventSubscription, useDevToolsPluginClient } from "expo/devtools";
import type { ProofBlock, ProofCommand, ProofEvent, ProofSnapshot } from "react-native-notion-markdown";
import { diagnoseRejection, pluginName } from "./protocol";
import { useCallback, useEffect, useRef } from "react";

export type UseNotionMarkdownDevToolsOptions = {
  /** The harness's current ProofSnapshot. Re-sent to the webUI whenever its epoch or revision changes. */
  snapshot: ProofSnapshot;
  /** Whether the editor is currently rendering in dark mode. */
  dark: boolean;
  /** Dispatch a command exactly as if an on-device toolbar button had been pressed. */
  dispatchCommand: (action: ProofCommand["action"]) => void;
  /** Replace the document. Called with `undefined` blocks to restore the default 3-block seed. */
  onReplaceDocument: (blocks?: Array<ProofBlock>) => void;
};

export type UseNotionMarkdownDevToolsResult = {
  /** Report the outcome of `acceptProofEvent` for one native edit, accepted or rejected. */
  reportEvent: (current: ProofSnapshot, event: ProofEvent, accepted: boolean) => void;
  /** Report a command that was actually dispatched, from either an on-device button or the webUI. */
  reportCommand: (command: ProofCommand) => void;
  /** Report an uncaught error from the harness, for the Diagnostics panel. */
  reportError: (error: unknown) => void;
};

type CommandRequestData = { action: ProofCommand["action"] };
type DocumentReplaceData = { blocks?: Array<ProofBlock> };

/** Bridges the harness's Proof transport state to the devtools webUI. No-ops outside development. */
export function useNotionMarkdownDevTools(
  options: UseNotionMarkdownDevToolsOptions
): UseNotionMarkdownDevToolsResult {
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

  const reportEvent = useCallback((current: ProofSnapshot, event: ProofEvent, accepted: boolean) => {
    client?.sendMessage("event:report", {
      accepted,
      event,
      reason: accepted ? undefined : diagnoseRejection(current, event)
    });
  }, [ client ]);

  const reportCommand = useCallback((command: ProofCommand) => {
    client?.sendMessage("command:report", { command });
  }, [ client ]);

  const reportError = useCallback((error: unknown) => {
    const normalized = error instanceof Error ? error : new Error(String(error));
    client?.sendMessage("error:report", { message: normalized.message, stack: normalized.stack });
  }, [ client ]);

  return { reportCommand, reportError, reportEvent };
}
