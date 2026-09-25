/**
 * @module markdown-storybook/NativeEditingHarness
 *
 * @file      NativeEditingHarness.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import {
    AcceptEditorEvent,
    CreateEditorDocument,
    type EditorBlock,
    type EditorCommand,
    type EditorEvent
} from "react-native-notion-markdown";
import { MarkdownEditor, type MarkdownEditorIcons } from "react-native-notion-markdown/editor/ui";
import { ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMarkdownDevTools } from "@react-native-notion-markdown/devtools-plugin";

interface DiagnosticButtonProps
{
    readonly label: string;
    readonly onPress: () => void;
}

/** Accessible diagnostic-harness action. */
function DiagnosticButton({ label, onPress }: DiagnosticButtonProps)
{
    return <Text accessibilityRole="button"
        onPress={ onPress }
        style={ styles.diagnosticButton }>{ label }</Text>;
}

/** Optional button icons accepted by the diagnostic harness host. */
export type NativeEditingHarnessProps = { icons?: MarkdownEditorIcons };

/** Acceptance harness around the package's configured editor UI. */
export function NativeEditingHarness({ icons }: NativeEditingHarnessProps = {})
{
    const [ snapshot, setSnapshot ] = useState(CreateEditorDocument);
    const currentSnapshot = useRef(snapshot);
    const [ event, setEvent ] = useState<EditorEvent>();
    const [ command, setCommand ] = useState<EditorCommand>();
    const sequence = useRef(0);
    const dark = useColorScheme() === "dark";
    const foreground = dark ? "#eeeeee" : "#262626";
    const background = dark ? "#191919" : "#ffffff";
    const devtools = useMarkdownDevTools({
        dark,
        dispatchCommand: (action: EditorCommand["action"]) => send(action),
        onReplaceDocument: (blocks?: Array<EditorBlock>) => resetDocument(blocks),
        snapshot
    });

    useEffect(() =>
    {
        if (!__DEV__)
        {
            return;
        }

        const errorUtils = (globalThis as { ErrorUtils?: {
            getGlobalHandler?: () => ((error: Error, isFatal?: boolean) => void) | undefined;
            setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
        } }).ErrorUtils;

        if (!errorUtils)
        {
            return;
        }

        const previousHandler = errorUtils.getGlobalHandler?.();
        errorUtils.setGlobalHandler((error: Error, isFatal?: boolean) =>
        {
            devtools.reportError(error);
            previousHandler?.(error, isFatal);
        });

        return () =>
        {
            if (previousHandler)
            {
                errorUtils.setGlobalHandler(previousHandler);
            }
        };
    }, [ devtools ]);

    /** Dispatch a uniquely numbered command against the current document epoch. */
    const send = useCallback((
        action: EditorCommand["action"],
        extra?: Pick<EditorCommand,
            "level" | "color" | "type" | "toggle" | "mark" | "columnCount" | "url" | "label">
    ) =>
    {
        const next: EditorCommand = {
            action,
            epoch: currentSnapshot.current.epoch,
            id: ++sequence.current,
            ...extra
        };
        setCommand(next);
        devtools.reportCommand(next);
    }, [ devtools ]);
    /** Send the select-all diagnostic command. */
    function handleSelectAll()
    {
        send("selectAll");
    }

    /** Send the block-split diagnostic command. */
    function handleSplit()
    {
        send("split");
    }

    /** Send the backspace diagnostic command. */
    function handleBackspace()
    {
        send("backspace");
    }

    /** Send the soft-break diagnostic command. */
    function handleSoftBreak()
    {
        send("softBreak");
    }

    /** Invalidate queued native input before rendering a replacement document. */
    function resetDocument(blocks?: Array<EditorBlock>)
    {
        const seeded = CreateEditorDocument(currentSnapshot.current.epoch + 1);
        currentSnapshot.current = blocks?.length ? { ...seeded, blocks } : seeded;
        setSnapshot(currentSnapshot.current);
        setEvent(undefined);
        setCommand(undefined);
    }

    /** Accept fresh edits and selection reports without a controlled Markdown typing loop. */
    function receiveEdit({ nativeEvent }: { nativeEvent: EditorEvent })
    {
        const current = currentSnapshot.current;
        const next = AcceptEditorEvent(current, nativeEvent);
        const accepted = next !== current;
        devtools.reportEvent(current, nativeEvent, accepted);
        if (accepted)
        {
            currentSnapshot.current = next;
            setSnapshot(next);
            setEvent(nativeEvent);
        }
    }

    const rootStyle = useMemo(() => [ styles.root, { backgroundColor: background } ], [ background ]);
    const statusStyle = useMemo(() => [ styles.status, { color: foreground } ], [ foreground ]);

    return (
        <View style={ rootStyle }>
            <Text accessibilityRole="header"
                style={ statusStyle }>Three-block native editor</Text>
            <Text style={ statusStyle }
                testID="editor-status">
                { snapshot.blocks.length } blocks ·{ " " }
                epoch { snapshot.epoch } ·{ " " }
                revision { snapshot.revision }{ "\n" }
                { event?.source ?? "Ready" } · composing{ " " }
                { event?.composingStart ?? -1 }:{ event?.composingEnd ?? -1 }{ "\n" }
                { event ? <>
                    { event.anchor.blockId.slice(0, 18) }:{ event.anchor.offset }{ " → " }
                    { event.focus.blockId.slice(0, 18) }:{ event.focus.offset }
                </> : "Select text across blocks" }
            </Text>
            <ScrollView horizontal
                keyboardShouldPersistTaps="always"
                style={ styles.diagnostics }>
                <DiagnosticButton label="Reset document"
                    onPress={ resetDocument } />
                <DiagnosticButton label="Select all"
                    onPress={ handleSelectAll } />
                <DiagnosticButton label="Enter"
                    onPress={ handleSplit } />
                <DiagnosticButton label="Backspace"
                    onPress={ handleBackspace } />
                <DiagnosticButton label="Soft break"
                    onPress={ handleSoftBreak } />
            </ScrollView>
            <MarkdownEditor
                colorScheme={ dark ? "dark" : "light" }
                command={ command }
                icons={ icons }
                onCommand={ send }
                onEdit={ receiveEdit }
                snapshot={ snapshot }
                style={ styles.editor }
                testID="editor-view"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    diagnosticButton:
    {
        color: "#262626",
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 14
    },
    diagnostics:
    {
        flexGrow: 0,
        maxHeight: 48
    },
    editor:
    {
        flex: 1,
        minHeight: 48
    },
    root:
    {
        flex: 1
    },
    status:
    {
        fontSize: 11,
        paddingBottom: 8,
        paddingHorizontal: 12
    }
});
