/**
 *
 *
 * @module @react-native-notion-markdown/devtools-plugin-webui/hooks/useDevToolsBridge
 *
 * @file      useDevToolsBridge.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import {
  type CommandReportMessage,
  type ErrorReportMessage,
  type EventReportMessage,
  type SnapshotUpdateMessage,
  pluginName
} from "@react-native-notion-markdown/devtools-plugin/src/protocol";
import { type EventSubscription, useDevToolsPluginClient } from "expo/devtools";
import type { ProofBlock, ProofCommand, ProofSnapshot } from "react-native-notion-markdown";
import { useCallback, useEffect, useState } from "react";

export type TimelineEntry =
  | { kind: "event"; id: string; timestamp: number; data: EventReportMessage }
  | { kind: "command"; id: string; timestamp: number; data: CommandReportMessage };

export type ErrorEntry = { id: string; timestamp: number; data: ErrorReportMessage };

const timelineLimit = 200;
const errorLimit = 50;

let nextEntryId = 0;

export function useDevToolsBridge() {
  const client = useDevToolsPluginClient(pluginName);
  const [ snapshot, setSnapshot ] = useState<ProofSnapshot>();
  const [ dark, setDark ] = useState(false);
  const [ lastMessageAt, setLastMessageAt ] = useState<number>();
  const [ timeline, setTimeline ] = useState<Array<TimelineEntry>>([]);
  const [ errors, setErrors ] = useState<Array<ErrorEntry>>([]);

  useEffect(() => {
    if (!client)
    {
      return;
    }

    const subscriptions: Array<EventSubscription | undefined> = [];

    subscriptions.push(client.addMessageListener("snapshot:update", (data: SnapshotUpdateMessage) => {
      setSnapshot(data.snapshot);
      setDark(data.dark);
      setLastMessageAt(Date.now());
    }));

    subscriptions.push(client.addMessageListener("event:report", (data: EventReportMessage) => {
      const entry: TimelineEntry =
        { data, id: `event:${ ++nextEntryId }`, kind: "event", timestamp: Date.now() };
      setTimeline((current: Array<TimelineEntry>) => [ entry, ...current ].slice(0, timelineLimit));
      setLastMessageAt(Date.now());
    }));

    subscriptions.push(client.addMessageListener("command:report", (data: CommandReportMessage) => {
      const entry: TimelineEntry =
        { data, id: `command:${ ++nextEntryId }`, kind: "command", timestamp: Date.now() };
      setTimeline((current: Array<TimelineEntry>) => [ entry, ...current ].slice(0, timelineLimit));
      setLastMessageAt(Date.now());
    }));

    subscriptions.push(client.addMessageListener("error:report", (data: ErrorReportMessage) => {
      const entry: ErrorEntry = { data, id: `error:${ ++nextEntryId }`, timestamp: Date.now() };
      setErrors((current: Array<ErrorEntry>) => [ entry, ...current ].slice(0, errorLimit));
      setLastMessageAt(Date.now());
    }));

    subscriptions.push(client.addMessageListener("ping", () => {
      client.sendMessage("ping", { from: "web" });
      setLastMessageAt(Date.now());
    }));

    return () => {
      for (const subscription of subscriptions)
      {
        subscription?.remove();
      }
    };
  }, [ client ]);

  const sendCommand = useCallback((action: ProofCommand["action"]) => {
    client?.sendMessage("command:request", { action });
  }, [ client ]);

  const replaceDocument = useCallback((blocks?: Array<ProofBlock>) => {
    client?.sendMessage("document:replace", { blocks });
  }, [ client ]);

  const ping = useCallback(() => {
    client?.sendMessage("ping", { from: "web" });
  }, [ client ]);

  const clearTimeline = useCallback(() => setTimeline([]), []);
  const clearErrors = useCallback(() => setErrors([]), []);

  return {
    clearErrors,
    clearTimeline,
    connected: client != null,
    dark,
    errors,
    lastMessageAt,
    ping,
    replaceDocument,
    sendCommand,
    snapshot,
    timeline
  };
}
