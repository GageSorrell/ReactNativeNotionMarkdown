/**
 *
 *
 * @module @react-native-notion-markdown/devtools-plugin-webui/components/BlocksPanel
 *
 * @file      BlocksPanel.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { EditorBlock, EditorSnapshot } from "react-native-notion-markdown";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

export type BlocksPanelProps = { snapshot: EditorSnapshot | undefined };

/**
 * Renders the current EditorSnapshot's block list. This is the full "block tree" available before
 * milestone 2's Notion AST lands — the message shape (blocks: Array<...>) is designed to stay
 * the extension point once a real parser exists.
 */
export function BlocksPanel({ snapshot }: BlocksPanelProps)
{
    if (!snapshot)
    {
        return (
            <View style={ styles.empty }>
                <Text style={ styles.emptyText }>
                    Waiting for a snapshot. Open the &quot;Native editing editor&quot; story on-device
                    to start reporting Editor transport state.
                </Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={ styles.content }>
            {snapshot.blocks.map((block: EditorBlock, index: number) => (
                <BlockRow
                    block={ block }
                    index={ index }
                    key={ block.id }
                />
            ))}
        </ScrollView>
    );
}

function BlockRow({ block, index }: { block: EditorBlock; index: number })
{
    return (
        <View style={ styles.block }>
            <View style={ styles.blockHeader }>
                <Text style={ styles.blockIndex }>{index}</Text>
                <Text style={ styles.blockId }>{block.id}</Text>
                <Text style={ styles.blockType }>{block.type}</Text>
            </View>
            <Text style={ styles.blockText }>{block.text || "(empty)"}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    block: {
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 10,
        padding: 12
    },
    blockHeader: { alignItems: "center", flexDirection: "row", marginBottom: 6 },
    blockId: { color: theme.textMuted, flexGrow: 1, fontFamily: theme.mono, fontSize: 12 },
    blockIndex: {
        backgroundColor: theme.background,
        borderRadius: 4,
        color: theme.textMuted,
        fontSize: 11,
        marginRight: 8,
        paddingHorizontal: 6,
        paddingVertical: 2
    },
    blockText: { color: theme.text, fontSize: 14, lineHeight: 20 },
    blockType: { color: theme.accent, fontSize: 12, fontWeight: "700" },
    content: { padding: 16 },
    empty: { alignItems: "center", flexGrow: 1, justifyContent: "center", padding: 32 },
    emptyText: { color: theme.textMuted, fontSize: 14, textAlign: "center" }
});
