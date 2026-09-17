/**
 *
 *
 * @module @react-native-notion-markdown/devtools-plugin-webui/components/ConsolePanel
 *
 * @file      ConsolePanel.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { ProofBlock, ProofCommand, ProofSnapshot } from "react-native-notion-markdown";
import { theme } from "../theme";
import { useState } from "react";

const commandActions: Array<ProofCommand["action"]> = [
    "focus", "dismiss", "selectAll", "copy", "cut", "paste",
    "split", "backspace", "softBreak", "heading", "compose", "commit"
];

const blockTypes: Array<ProofBlock["type"]> = [ "paragraph", "heading_1" ];

let nextRowId = 0;

export type ConsolePanelProps = {
    snapshot: ProofSnapshot | undefined;
    onSendCommand: (action: ProofCommand["action"]) => void;
    onReplaceDocument: (blocks?: Array<ProofBlock>) => void;
};

/**
 * The v1 "live edit and reload" panel. There is no markdown parser yet (milestone 2), so this
 * edits raw {id, type, text} block fields directly rather than markdown text — the
 * document:replace message shape is what a future free-text markdown editor would keep using.
 */
export function ConsolePanel({ snapshot, onSendCommand, onReplaceDocument }: ConsolePanelProps)
{
    const [ rows, setRows ] = useState<Array<ProofBlock>>([]);

    function loadFromSnapshot()
    {
        if (snapshot)
        {
            setRows(snapshot.blocks.map((block: ProofBlock) => ({ ...block })));
        }
    }

    function addRow()
    {
        const row: ProofBlock = { id: `block-${ ++nextRowId }`, text: "", type: "paragraph" };
        setRows((current: Array<ProofBlock>) => [ ...current, row ]);
    }

    function updateRow(index: number, patch: Partial<ProofBlock>)
    {
        setRows((current: Array<ProofBlock>) => current.map((row: ProofBlock, i: number) =>
            i === index ? { ...row, ...patch } : row));
    }

    function removeRow(index: number)
    {
        setRows((current: Array<ProofBlock>) => current.filter((_: ProofBlock, i: number) => i !== index));
    }

    function apply()
    {
        onReplaceDocument(rows.length ? rows : undefined);
    }

    function resetToDefault()
    {
        setRows([]);
        onReplaceDocument(undefined);
    }

    const applyLabel = `Apply ${ rows.length } block${ rows.length === 1 ? "" : "s" } to device`;

    return (
        <ScrollView contentContainerStyle={ styles.content }>
            <Text style={ styles.sectionTitle }>Commands</Text>
            <Text style={ styles.sectionSubtitle }>
                Dispatched exactly as if an on-device toolbar button was pressed.
            </Text>
            <View style={ styles.commandGrid }>
                {commandActions.map((action: ProofCommand["action"]) => (
                    <CommandButton
                        action={ action }
                        key={ action }
                        onPress={ onSendCommand }
                    />
                ))}
            </View>

            <Text style={ styles.sectionTitle }>Replace document</Text>
            <Text style={ styles.sectionSubtitle }>
                Raw block editor — stand-in for markdown editing until milestone 2&apos;s parser exists.
            </Text>
            <View style={ styles.documentToolbar }>
                <Pressable
                    onPress={ loadFromSnapshot }
                    style={ styles.secondaryButton }>
                    <Text style={ styles.secondaryButtonLabel }>Load current snapshot</Text>
                </Pressable>
                <Pressable
                    onPress={ addRow }
                    style={ styles.secondaryButton }>
                    <Text style={ styles.secondaryButtonLabel }>Add block</Text>
                </Pressable>
                <Pressable
                    onPress={ resetToDefault }
                    style={ styles.secondaryButton }>
                    <Text style={ styles.secondaryButtonLabel }>Reset to default</Text>
                </Pressable>
            </View>

            {rows.map((row: ProofBlock, index: number) => (
                <BlockEditorRow
                    key={ row.id }
                    onRemove={ removeRow }
                    onUpdate={ updateRow }
                    row={ row }
                    rowIndex={ index }
                />
            ))}

            <Pressable
                disabled={ !rows.length }
                onPress={ apply }
                style={ [ styles.applyButton, !rows.length && styles.applyButtonDisabled ] }>
                <Text style={ styles.applyButtonLabel }>{applyLabel}</Text>
            </Pressable>
        </ScrollView>
    );
}

type CommandButtonProps = {
    action: ProofCommand["action"];
    onPress: (action: ProofCommand["action"]) => void;
};

function CommandButton({ action, onPress }: CommandButtonProps)
{
    function handlePress()
    {
        onPress(action);
    }

    return (
        <Pressable
            onPress={ handlePress }
            style={ styles.commandButton }>
            <Text style={ styles.commandButtonLabel }>{action}</Text>
        </Pressable>
    );
}

type BlockEditorRowProps = {
    row: ProofBlock;
    rowIndex: number;
    onUpdate: (index: number, patch: Partial<ProofBlock>) => void;
    onRemove: (index: number) => void;
};

function BlockEditorRow({ row, rowIndex, onUpdate, onRemove }: BlockEditorRowProps)
{
    function handleIdChange(id: string)
    {
        onUpdate(rowIndex, { id });
    }

    function handleTextChange(text: string)
    {
        onUpdate(rowIndex, { text });
    }

    function handleRemove()
    {
        onRemove(rowIndex);
    }

    return (
        <View style={ styles.blockRow }>
            <TextInput
                onChangeText={ handleIdChange }
                placeholder="block id"
                placeholderTextColor={ theme.textMuted }
                style={ styles.idInput }
                value={ row.id }
            />
            <View style={ styles.typeToggle }>
                {blockTypes.map((type: ProofBlock["type"]) => (
                    <TypeOption
                        active={ row.type === type }
                        key={ type }
                        onSelect={ onUpdate }
                        rowIndex={ rowIndex }
                        type={ type }
                    />
                ))}
            </View>
            <TextInput
                onChangeText={ handleTextChange }
                placeholder="block text"
                placeholderTextColor={ theme.textMuted }
                style={ styles.textInput }
                value={ row.text }
            />
            <Pressable
                onPress={ handleRemove }
                style={ styles.removeButton }>
                <Text style={ styles.removeButtonLabel }>Remove</Text>
            </Pressable>
        </View>
    );
}

type TypeOptionProps = {
    type: ProofBlock["type"];
    active: boolean;
    rowIndex: number;
    onSelect: (index: number, patch: Partial<ProofBlock>) => void;
};

function TypeOption({ type, active, rowIndex, onSelect }: TypeOptionProps)
{
    function handlePress()
    {
        onSelect(rowIndex, { type });
    }

    return (
        <Pressable
            onPress={ handlePress }
            style={ [ styles.typeOption, active && styles.typeOptionActive ] }>
            <Text style={ [ styles.typeOptionLabel, active && styles.typeOptionLabelActive ] }>{type}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    applyButton: {
        alignItems: "center",
        backgroundColor: theme.accent,
        borderRadius: 8,
        marginTop: 8,
        paddingVertical: 12
    },
    applyButtonDisabled: { opacity: 0.4 },
    applyButtonLabel: { color: "#08122a", fontSize: 14, fontWeight: "700" },
    blockRow: { alignItems: "center", flexDirection: "row", gap: 8, marginBottom: 8 },
    commandButton: {
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderRadius: 6,
        borderWidth: 1,
        marginBottom: 8,
        marginRight: 8,
        paddingHorizontal: 12,
        paddingVertical: 8
    },
    commandButtonLabel: { color: theme.text, fontFamily: theme.mono, fontSize: 12 },
    commandGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 20 },
    content: { padding: 16 },
    documentToolbar: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
    idInput: {
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderRadius: 6,
        borderWidth: 1,
        color: theme.text,
        fontFamily: theme.mono,
        fontSize: 12,
        padding: 8,
        width: 140
    },
    removeButton: { paddingHorizontal: 8, paddingVertical: 6 },
    removeButtonLabel: { color: theme.danger, fontSize: 12 },
    secondaryButton: {
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderRadius: 6,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 8
    },
    secondaryButtonLabel: { color: theme.text, fontSize: 12, fontWeight: "600" },
    sectionSubtitle: { color: theme.textMuted, fontSize: 12, marginBottom: 12 },
    sectionTitle: { color: theme.text, fontSize: 15, fontWeight: "700", marginBottom: 4 },
    textInput: {
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderRadius: 6,
        borderWidth: 1,
        color: theme.text,
        flexGrow: 1,
        fontSize: 13,
        padding: 8
    },
    typeOption: { paddingHorizontal: 8, paddingVertical: 6 },
    typeOptionActive: { backgroundColor: theme.background, borderRadius: 4 },
    typeOptionLabel: { color: theme.textMuted, fontSize: 11 },
    typeOptionLabelActive: { color: theme.accent },
    typeToggle: {
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderRadius: 6,
        borderWidth: 1,
        flexDirection: "row"
    }
});
