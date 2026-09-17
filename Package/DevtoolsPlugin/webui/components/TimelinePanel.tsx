/**
 *
 *
 * @module @react-native-notion-markdown/devtools-plugin-webui/components/TimelinePanel
 *
 * @file      TimelinePanel.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { TimelineEntry } from "../hooks/useDevToolsBridge";
import { theme } from "../theme";

export type TimelinePanelProps = {
    entries: Array<TimelineEntry>;
    onClear: () => void;
    rejectedOnly?: boolean;
};

export function filterEntries(entries: Array<TimelineEntry>, rejectedOnly: boolean): Array<TimelineEntry>
{
    return rejectedOnly
        ? entries.filter((entry: TimelineEntry) => entry.kind === "event" && !entry.data.accepted)
        : entries;
}

export function TimelinePanel({ entries, onClear, rejectedOnly = false }: TimelinePanelProps)
{
    const visible = filterEntries(entries, rejectedOnly);
    const countLabel = `${ visible.length } ${ rejectedOnly ? "rejected" : "" } entries`;

    return (
        <View style={ styles.root }>
            <View style={ styles.toolbar }>
                <Text style={ styles.count }>{countLabel}</Text>
                <Pressable
                    onPress={ onClear }
                    style={ styles.clearButton }>
                    <Text style={ styles.clearButtonLabel }>Clear</Text>
                </Pressable>
            </View>
            <ScrollView contentContainerStyle={ styles.content }>
                <TimelineRows
                    entries={ visible }
                    rejectedOnly={ rejectedOnly }
                />
            </ScrollView>
        </View>
    );
}

export type TimelineRowsProps = { entries: Array<TimelineEntry>; rejectedOnly?: boolean };

/** Row rendering with no ScrollView of its own, so callers can embed it inside another scroll container. */
export function TimelineRows({ entries, rejectedOnly = false }: TimelineRowsProps)
{
    if (!entries.length)
    {
        const emptyMessage = rejectedOnly
            ? "No rejected events yet."
            : "No activity yet. Dispatch a command or edit on-device.";

        return <Text style={ styles.emptyText }>{emptyMessage}</Text>;
    }

    return (
        <>
            {entries.map((entry: TimelineEntry) => (
                <TimelineRow
                    entry={ entry }
                    key={ entry.id }
                />
            ))}
        </>
    );
}

function TimelineRow({ entry }: { entry: TimelineEntry })
{
    const time = new Date(entry.timestamp).toLocaleTimeString();

    if (entry.kind === "command")
    {
        const summary =
            `${ entry.data.command.action } · id ${ entry.data.command.id } · ` +
            `epoch ${ entry.data.command.epoch }`;

        return (
            <View style={ [ styles.row, styles.rowCommand ] }>
                <Text style={ styles.rowTime }>{time}</Text>
                <Text style={ styles.rowBadgeCommand }>COMMAND</Text>
                <Text style={ styles.rowText }>{summary}</Text>
            </View>
        );
    }

    const { event, accepted, reason } = entry.data;
    const rowStyle = accepted ? styles.rowAccepted : styles.rowRejected;
    const badgeStyle = accepted ? styles.rowBadgeAccepted : styles.rowBadgeRejected;
    const composingSummary =
        `revision ${ event.revision } · composing ${ event.composingStart }:${ event.composingEnd } ` +
        `· source ${ event.source }`;
    const selectionSummary =
        `${ event.anchor.blockId }:${ event.anchor.offset } → ` +
        `${ event.focus.blockId }:${ event.focus.offset }`;

    return (
        <View style={ [ styles.row, rowStyle ] }>
            <Text style={ styles.rowTime }>{time}</Text>
            <Text style={ badgeStyle }>{accepted ? "ACCEPTED" : "REJECTED"}</Text>
            <View style={ styles.rowBody }>
                <Text style={ styles.rowText }>{composingSummary}</Text>
                <Text style={ styles.rowText }>{selectionSummary}</Text>
                {!accepted && reason && <Text style={ styles.rowReason }>{reason}</Text>}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    clearButton: { paddingHorizontal: 10, paddingVertical: 4 },
    clearButtonLabel: { color: theme.accent, fontSize: 12, fontWeight: "600" },
    content: { padding: 16 },
    count: { color: theme.textMuted, fontSize: 12 },
    emptyText: { color: theme.textMuted, fontSize: 14, padding: 16, textAlign: "center" },
    root: { flex: 1 },
    row: { borderLeftWidth: 3, borderRadius: 6, flexDirection: "row", marginBottom: 8, padding: 10 },
    rowAccepted: { backgroundColor: theme.surface, borderLeftColor: theme.success },
    rowBadgeAccepted: { color: theme.success, fontSize: 11, fontWeight: "700", marginRight: 10, width: 74 },
    rowBadgeCommand: { color: theme.accent, fontSize: 11, fontWeight: "700", marginRight: 10, width: 74 },
    rowBadgeRejected: { color: theme.danger, fontSize: 11, fontWeight: "700", marginRight: 10, width: 74 },
    rowBody: { flexShrink: 1 },
    rowCommand: { backgroundColor: theme.surface, borderLeftColor: theme.accent },
    rowReason: { color: theme.danger, fontSize: 12, marginTop: 2 },
    rowRejected: { backgroundColor: "#2a1414", borderLeftColor: theme.danger },
    rowText: { color: theme.text, fontFamily: theme.mono, fontSize: 12 },
    rowTime: { color: theme.textMuted, fontSize: 11, marginRight: 10, width: 68 },
    toolbar: {
        alignItems: "center",
        borderBottomColor: theme.border,
        borderBottomWidth: 1,
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 8
    }
});
