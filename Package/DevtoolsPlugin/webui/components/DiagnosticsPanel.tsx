/**
 *
 *
 * @module @react-native-notion-markdown/devtools-plugin-webui/components/DiagnosticsPanel
 *
 * @file      DiagnosticsPanel.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { ErrorEntry, TimelineEntry } from "../hooks/useDevToolsBridge";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TimelineRows, filterEntries } from "./TimelinePanel";
import type { EditorSnapshot } from "react-native-notion-markdown";
import { theme } from "../theme";

export type DiagnosticsPanelProps =
    {
        snapshot: EditorSnapshot | undefined;
        dark: boolean;
        timeline: Array<TimelineEntry>;
        onClearTimeline: () => void;
        errors: Array<ErrorEntry>;
        onClearErrors: () => void;
    };

/**
 * Surfaces uncaught errors and rejected events. Also the seed location for a real config/theme
 * panel: today the library has no theme system, so this only shows the dark prop the harness
 * reports alongside each snapshot.
 */
export function DiagnosticsPanel(
    { snapshot, dark, timeline, onClearTimeline, errors, onClearErrors }: DiagnosticsPanelProps
)
{
    const rejected = filterEntries(timeline, true);

    return (
        <ScrollView contentContainerStyle={ styles.content }>
            <Text style={ styles.sectionTitle }>Environment</Text>
            <View style={ styles.factRow }>
                <Text style={ styles.factLabel }>Color scheme</Text>
                <Text style={ styles.factValue }>{dark ? "dark" : "light"}</Text>
            </View>
            <View style={ styles.factRow }>
                <Text style={ styles.factLabel }>Epoch</Text>
                <Text style={ styles.factValue }>{snapshot?.epoch ?? "—"}</Text>
            </View>
            <Text style={ styles.note }>
                No real theme/config system exists yet — this section is the seed for a real
                Config/Theme panel once one lands.
            </Text>

            <View style={ styles.divider } />

            <View style={ styles.sectionHeader }>
                <Text style={ styles.sectionTitle }>Errors ({errors.length})</Text>
                <Pressable
                    onPress={ onClearErrors }
                    style={ styles.clearButton }>
                    <Text style={ styles.clearButtonLabel }>Clear</Text>
                </Pressable>
            </View>
            {errors.length === 0 && <Text style={ styles.emptyText }>No errors reported.</Text>}
            {errors.map((entry: ErrorEntry) => (
                <ErrorRow
                    entry={ entry }
                    key={ entry.id }
                />
            ))}

            <View style={ styles.divider } />

            <View style={ styles.sectionHeader }>
                <Text style={ styles.sectionTitle }>Rejected events ({rejected.length})</Text>
                <Pressable
                    onPress={ onClearTimeline }
                    style={ styles.clearButton }>
                    <Text style={ styles.clearButtonLabel }>Clear</Text>
                </Pressable>
            </View>
            <TimelineRows
                entries={ rejected }
                rejectedOnly
            />
        </ScrollView>
    );
}

function ErrorRow({ entry }: { entry: ErrorEntry })
{
    return (
        <View style={ styles.errorRow }>
            <Text style={ styles.errorTime }>{new Date(entry.timestamp).toLocaleTimeString()}</Text>
            <Text style={ styles.errorMessage }>{entry.data.message}</Text>
            {entry.data.stack && <Text style={ styles.errorStack }>{entry.data.stack}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    clearButton: { paddingHorizontal: 10, paddingVertical: 4 },
    clearButtonLabel: { color: theme.accent, fontSize: 12, fontWeight: "600" },
    content: { padding: 16 },
    divider: { backgroundColor: theme.border, height: 1, marginVertical: 16 },
    emptyText: { color: theme.textMuted, fontSize: 13 },
    errorMessage: { color: theme.danger, fontSize: 13, fontWeight: "600" },
    errorRow: { backgroundColor: "#2a1414", borderRadius: 6, marginTop: 8, padding: 10 },
    errorStack: { color: theme.textMuted, fontFamily: theme.mono, fontSize: 11, marginTop: 4 },
    errorTime: { color: theme.textMuted, fontSize: 11, marginBottom: 2 },
    factLabel: { color: theme.textMuted, fontSize: 13 },
    factRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
    factValue: { color: theme.text, fontFamily: theme.mono, fontSize: 13 },
    note: { color: theme.textMuted, fontSize: 12, fontStyle: "italic", marginTop: 8 },
    sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
    sectionTitle: { color: theme.text, fontSize: 15, fontWeight: "700", marginBottom: 8 }
});
