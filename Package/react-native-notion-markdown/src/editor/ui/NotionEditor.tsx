/**
 * @module react-native-notion-markdown/editor/ui/NotionEditor
 *
 * @file      NotionEditor.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import {
    AcceptProofEvent,
    CreateProofDocument,
    type ProofCommand,
    type ProofEvent,
    type ProofSnapshot
} from "../../prototype.ts";
import Animated, { FadeIn, FadeOut, useAnimatedStyle } from "react-native-reanimated";
import { KeyboardStickyView, useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useColorScheme,
    useWindowDimensions
} from "react-native";
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import type { LayoutChangeEvent } from "react-native";
import { NativeProofEditor } from "../../NativeProofEditor.tsx";
import type { NativeProofEditorProps } from "../../NativeProofEditor.tsx";

/**
 * Buttons that can display an icon in the editor UI.
 *
 * @since 1.0.0
 */
export type NotionEditorButton =
    | "insert"
    | "format"
    | "back"
    | "copy"
    | "cut"
    | "paste"
    | "edit"
    | "hideKeyboard"
    | "paragraph"
    | "heading"
    | "composeJapanese"
    | "commitComposition"
    | "returnToKeyboard";

/**
 * Props accepted by an icon component supplied by the host application.
 *
 * @since 1.0.0
 */
export interface NotionEditorIconProps
{
    readonly color: string;
    readonly size: number;
    readonly strokeWidth: number;
}

/**
 * Optional per-button icon overrides. Lucide icons are used when no override is supplied.
 *
 * @since 1.0.0
 */
export interface NotionEditorComponents extends Partial<Record<
    NotionEditorButton,
    ComponentType<NotionEditorIconProps>
>> { }

/**
 * Props for the configured editor UI.
 *
 * @since 1.0.0
 */
export interface NotionEditorProps extends Omit<NativeProofEditorProps, "command" | "onEdit" | "snapshot">
{
    /** Document state. When omitted, a starter document is created and managed internally. */
    readonly snapshot?: ProofSnapshot;

    /** An externally controlled native command. */
    readonly command?: ProofCommand;

    /** Receives native editing events. Omit this callback for internally managed document state. */
    readonly onEdit?: (Event: { nativeEvent: ProofEvent }) => void;

    /** Receives actions selected in the editor UI. */
    readonly onCommand?: (Action: ProofCommand["action"]) => void;

    /** Optional icon overrides for the editor UI. */
    readonly components?: NotionEditorComponents;
}

interface ActionButtonProps
{
    readonly button?: NotionEditorButton;
    readonly color: string;
    readonly components?: NotionEditorComponents;
    readonly label: string;
    readonly onPress: () => void;
}

type LucideModule =
    Record<string, ComponentType<NotionEditorIconProps>> &
    {
        readonly default?: Record<string, ComponentType<NotionEditorIconProps>>;
    };

const lucideNames: Readonly<Record<NotionEditorButton, string>> =
    {
        back: "ArrowLeft",
        commitComposition: "Check",
        composeJapanese: "Languages",
        copy: "Copy",
        cut: "Scissors",
        edit: "Pencil",
        format: "CaseSensitive",
        heading: "Heading",
        hideKeyboard: "KeyboardOff",
        insert: "Plus",
        paragraph: "Pilcrow",
        paste: "ClipboardPaste",
        returnToKeyboard: "Keyboard"
    } as const;

let optionalLucide: LucideModule | null | undefined;

/**
 * Load Lucide lazily so the optional peer is not required by consumers who provide their own icons.
 *
 * @since 1.0.0
 */
function getLucideIcons(): LucideModule | undefined
{
    if (optionalLucide !== undefined)
    {
        return optionalLucide ?? undefined;
    }

    try
    {
        /* Keep Metro from turning the optional peer into an unconditional module dependency. */
        const optionalRequire = eval("require") as (moduleName: string) => unknown;
        const loaded = optionalRequire("lucide-react-native") as LucideModule;
        optionalLucide = loaded.default ? { ...loaded, ...loaded.default } : loaded;
    }
    catch
    {
        optionalLucide = null;
    }

    return optionalLucide ?? undefined;
}

/**
 * Resolve a host icon override or a matching icon from the optional Lucide peer.
 *
 * @since 1.0.0
 */
function getButtonIcon(
    button: NotionEditorButton | undefined,
    components: NotionEditorComponents | undefined
): ComponentType<NotionEditorIconProps> | undefined
{
    const supplied = button === undefined ? undefined : components?.[button];

    if (supplied !== undefined)
    {
        return supplied;
    }

    const icons = button === undefined ? undefined : getLucideIcons();
    return button === undefined || icons === undefined ? undefined : icons[lucideNames[button]];
}

/**
 * Render an accessible editor action with an override, Lucide icon, or text fallback.
 *
 * @since 1.0.0
 */
function ActionButton({ button, color, components, label, onPress }: ActionButtonProps)
{
    const Icon = getButtonIcon(button, components);
    const textStyle = useMemo(() => ({ color }), [ color ]);

    return <Pressable accessibilityLabel={ label }
        accessibilityRole="button"
        onPress={ onPress }
        style={ styles.button }>
        {
            Icon === undefined
                ? <Text style={ textStyle }>{ label }</Text>
                : createElement(Icon, { color, size: 22, strokeWidth: 2 })
        }
    </Pressable>;
}

type EditorMode =
    | "main"
    | "format"
    | "insert";

/**
 * The ready-to-use editor surface, including the keyboard-adjacent editor controls.
 *
 * @since 1.0.0
 */
export function NotionEditor({
    command: suppliedCommand,
    components,
    dark: suppliedDark,
    onCommand,
    onEdit,
    snapshot: suppliedSnapshot,
    ...viewProps
}: NotionEditorProps)
{
    const [ defaultSnapshot ] = useState(CreateProofDocument);
    const [ internalSnapshot, setInternalSnapshot ] = useState<ProofSnapshot>();
    const [ internalCommand, setInternalCommand ] = useState<ProofCommand>();
    const [ mode, setMode ] = useState<EditorMode>("main");
    const sequence = useRef(0);
    const currentSnapshot = useRef(suppliedSnapshot ?? internalSnapshot ?? defaultSnapshot);
    const root = useRef<View>(null);
    const [ bottomGap, setBottomGap ] = useState(0);
    const { height: windowHeight } = useWindowDimensions();
    const systemDark = useColorScheme() === "dark";
    const dark = suppliedDark ?? systemDark;
    const { height, progress } = useReanimatedKeyboardAnimation();
    const foreground = dark ? "#eeeeee" : "#262626";
    const background = dark ? "#191919" : "#ffffff";
    const footerHeight = mode === "insert" ? 260 : 52;
    const snapshot = suppliedSnapshot ?? internalSnapshot ?? defaultSnapshot;
    const command = suppliedCommand ?? internalCommand;
    const viewport = useAnimatedStyle(() => ({
        marginBottom: Math.max(0, -height.value - bottomGap * progress.value) + footerHeight
    }));

    useEffect(() =>
    {
        if (suppliedSnapshot !== undefined)
        {
            currentSnapshot.current = suppliedSnapshot;
        }
    }, [ suppliedSnapshot ]);

    const { onLayout: externalOnLayout, style, testID, ...nativeViewProps } = viewProps;

    const measureCanvas = useCallback((event: LayoutChangeEvent) =>
    {
        externalOnLayout?.(event);
        root.current?.measureInWindow((_x: number, y: number, _width: number, canvasHeight: number) =>
        {
            setBottomGap(Math.max(0, windowHeight - y - canvasHeight));
        });
    }, [ externalOnLayout, windowHeight ]);

    const send = useCallback((action: ProofCommand["action"]) =>
    {
        if (onCommand !== undefined)
        {
            onCommand(action);
            return;
        }

        const next: ProofCommand =
            {
                action,
                epoch: currentSnapshot.current.epoch,
                id: ++sequence.current
            };

        setInternalCommand(next);
    }, [ onCommand ]);

    const receiveEdit = useCallback(({ nativeEvent }: { nativeEvent: ProofEvent }) =>
    {
        if (suppliedSnapshot === undefined && onEdit === undefined)
        {
            const next = AcceptProofEvent(currentSnapshot.current, nativeEvent);
            if (next !== currentSnapshot.current)
            {
                currentSnapshot.current = next;
                setInternalSnapshot(next);
            }
        }

        onEdit?.({ nativeEvent });
    }, [ onEdit, suppliedSnapshot ]);

    const handleMode = useCallback((nextMode: EditorMode) => () => setMode(nextMode), [ ]);
    const handleInsert = useCallback(() =>
    {
        setMode("insert");
        send("dismiss");
    }, [ send ]);
    const closePanel = useCallback(() =>
    {
        setMode("main");
        send("focus");
    }, [ send ]);
    const handleSplit = useCallback(() => send("split"), [ send ]);
    const handleHeading = useCallback(() => send("heading"), [ send ]);
    const handleCompose = useCallback(() => send("compose"), [ send ]);
    const handleCommit = useCallback(() => send("commit"), [ send ]);
    const handleCopy = useCallback(() => send("copy"), [ send ]);
    const handleCut = useCallback(() => send("cut"), [ send ]);
    const handlePaste = useCallback(() => send("paste"), [ send ]);
    const handleFocus = useCallback(() => send("focus"), [ send ]);
    const handleDismiss = useCallback(() => send("dismiss"), [ send ]);

    const handleLayout = useMemo(() => [ styles.root, style ], [ style ]);
    const stickyViewOffset = useMemo(() => ({ opened: bottomGap }), [ bottomGap ]);
    const stickyViewStyle = useMemo(() => [ styles.footer, { backgroundColor: background } ], [ background ]);
    const surfaceStyle = useMemo(() => [ styles.surface, viewport ], [ viewport ]);
    const panelTitleStyle = useMemo(() => [ styles.title, { color: foreground } ], [ foreground ]);
    const selectionStatusStyle = useMemo(() => [ styles.status, { color: foreground } ], [ foreground ]);
    return (
        <View
            { ...nativeViewProps }
            onLayout={ measureCanvas }
            ref={ root }
            style={ handleLayout }>
            <Animated.View style={ surfaceStyle }>
                <NativeProofEditor
                    { ...nativeViewProps }
                    command={ command }
                    dark={ dark }
                    onEdit={ receiveEdit }
                    snapshot={ snapshot }
                    style={ styles.editor }
                    testID={ testID }
                />
            </Animated.View>
            <KeyboardStickyView
                offset={ stickyViewOffset }
                style={ stickyViewStyle }>
                {
                    mode === "insert"
                        ? <Animated.View entering={ FadeIn.duration(160) }
                            exiting={ FadeOut.duration(120) }
                            style={ styles.panel }>
                            <Text accessibilityRole="header"
                                style={ panelTitleStyle }>Insert block</Text>
                            <View style={ styles.grid }>
                                <ActionButton button="paragraph"
                                    color={ foreground }
                                    components={ components }
                                    label="Paragraph"
                                    onPress={ handleSplit } />
                                <ActionButton button="heading"
                                    color={ foreground }
                                    components={ components }
                                    label="Heading"
                                    onPress={ handleHeading } />
                            </View>
                            <View style={ styles.grid }>
                                <ActionButton button="composeJapanese"
                                    color={ foreground }
                                    components={ components }
                                    label="Compose Japanese"
                                    onPress={ handleCompose } />
                                <ActionButton button="commitComposition"
                                    color={ foreground }
                                    components={ components }
                                    label="Commit composition"
                                    onPress={ handleCommit } />
                            </View>
                            <Text style={ selectionStatusStyle }>
                                Selection stays bookmarked in the native buffer.{ "  " }
                                This panel replaces the keyboard.
                            </Text>
                            <ActionButton button="returnToKeyboard"
                                color={ foreground }
                                components={ components }
                                label="Return to keyboard"
                                onPress={ closePanel } />
                        </Animated.View>
                        : <View style={ styles.toolbar }>
                            <ScrollView horizontal
                                keyboardShouldPersistTaps="always"
                                showsHorizontalScrollIndicator={ false }>
                                {
                                    mode === "main" ? <>
                                        <ActionButton button="insert"
                                            color={ foreground }
                                            components={ components }
                                            label="Insert"
                                            onPress={ handleInsert } />
                                        <ActionButton button="format"
                                            color={ foreground }
                                            components={ components }
                                            label="Aa"
                                            onPress={ handleMode("format") } />
                                    </> : <ActionButton button="back"
                                        color={ foreground }
                                        components={ components }
                                        label="Back"
                                        onPress={ handleMode("main") } />
                                }
                                <ActionButton button="copy"
                                    color={ foreground }
                                    components={ components }
                                    label="Copy"
                                    onPress={ handleCopy } />
                                <ActionButton button="cut"
                                    color={ foreground }
                                    components={ components }
                                    label="Cut"
                                    onPress={ handleCut } />
                                <ActionButton button="paste"
                                    color={ foreground }
                                    components={ components }
                                    label="Paste"
                                    onPress={ handlePaste } />
                                <ActionButton button="edit"
                                    color={ foreground }
                                    components={ components }
                                    label="Edit"
                                    onPress={ handleFocus } />
                            </ScrollView>
                            <ActionButton button="hideKeyboard"
                                color={ foreground }
                                components={ components }
                                label="Hide keyboard"
                                onPress={ handleDismiss } />
                        </View>
                }
            </KeyboardStickyView>
        </View>
    );
}

const styles = StyleSheet.create({
    button:
    {
        alignItems: "center",
        justifyContent: "center",
        minHeight: 48,
        minWidth: 48,
        paddingHorizontal: 12
    },
    editor:
    {
        flex: 1,
        minHeight: 48
    },
    footer:
    {
        borderColor: "#888888",
        borderTopWidth: StyleSheet.hairlineWidth,
        bottom: 0,
        left: 0,
        position: "absolute",
        right: 0
    },
    grid:
    {
        flexDirection: "row",
        justifyContent: "space-around",
        paddingVertical: 4
    },
    panel:
    {
        height: 260,
        padding: 8
    },
    root:
    {
        flex: 1
    },
    selectionStatus:
    {
        fontSize: 11,
        paddingBottom: 8,
        paddingHorizontal: 12
    },
    status:
    {
        fontSize: 11,
        paddingBottom: 8,
        paddingHorizontal: 12
    },
    surface:
    {
        flex: 1
    },
    title:
    {
        fontSize: 18,
        fontWeight: "600",
        padding: 12
    },
    toolbar:
    {
        alignItems: "center",
        flexDirection: "row",
        height: 52
    }
});
