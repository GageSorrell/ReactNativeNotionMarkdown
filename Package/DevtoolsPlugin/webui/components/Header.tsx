/**
 *
 *
 * @module @react-native-notion-markdown/devtools-plugin-webui/components/Header
 *
 * @file      Header.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Pressable, StyleSheet, Text, View } from "react-native";
import type { EditorSnapshot } from "react-native-notion-markdown";
import { theme } from "../theme";

export type TabName = "Blocks" | "Timeline" | "Console" | "Diagnostics";

export const tabNames: Array<TabName> = [ "Blocks", "Timeline", "Console", "Diagnostics" ];

export type HeaderProps = {
    connected: boolean;
    snapshot: EditorSnapshot | undefined;
    dark: boolean;
    lastMessageAt: number | undefined;
    activeTab: TabName;
    onSelectTab: (tab: TabName) => void;
};

export function Header({ connected, snapshot, dark, lastMessageAt, activeTab, onSelectTab }: HeaderProps)
{
    const dotStyle = { backgroundColor: connected ? theme.success : theme.danger };
    const snapshotSummary = snapshot
        ? `epoch ${ snapshot.epoch } · revision ${ snapshot.revision } · ${ snapshot.blocks.length } blocks`
        : "No snapshot yet";
    const colorSchemeSummary = dark ? "dark" : "light";
    const lastMessageSummary = lastMessageAt
        ? `last message ${ new Date(lastMessageAt).toLocaleTimeString() }`
        : "no messages yet";

    return (
        <View style={ styles.root }>
            <View style={ styles.statusRow }>
                <View style={ [ styles.dot, dotStyle ] } />
                <Text style={ styles.title }>react-native-notion-markdown devtools</Text>
                <Text style={ styles.meta }>
                    {snapshotSummary} {"·"} {colorSchemeSummary} {"·"} {lastMessageSummary}
                </Text>
            </View>
            <View style={ styles.tabs }>
                {tabNames.map((tab: TabName) => (
                    <HeaderTab
                        active={ tab === activeTab }
                        key={ tab }
                        onSelectTab={ onSelectTab }
                        tab={ tab }
                    />
                ))}
            </View>
        </View>
    );
}

type HeaderTabProps = { tab: TabName; active: boolean; onSelectTab: (tab: TabName) => void };

function HeaderTab({ tab, active, onSelectTab }: HeaderTabProps)
{
    function handlePress()
    {
        onSelectTab(tab);
    }

    return (
        <Pressable
            onPress={ handlePress }
            style={ [ styles.tab, active && styles.tabActive ] }>
            <Text style={ [ styles.tabLabel, active && styles.tabLabelActive ] }>{tab}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    dot: { borderRadius: 5, height: 10, marginRight: 8, width: 10 },
    meta: { color: theme.textMuted, fontSize: 12 },
    root: {
        backgroundColor: theme.surface,
        borderBottomColor: theme.border,
        borderBottomWidth: 1,
        paddingHorizontal: 16,
        paddingTop: 12
    },
    statusRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", marginBottom: 10 },
    tab: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 },
    tabActive: { backgroundColor: theme.background },
    tabLabel: { color: theme.textMuted, fontSize: 13, fontWeight: "600" },
    tabLabelActive: { color: theme.text },
    tabs: { flexDirection: "row" },
    title: { color: theme.text, flexGrow: 1, fontSize: 14, fontWeight: "700", marginRight: 12 }
});
