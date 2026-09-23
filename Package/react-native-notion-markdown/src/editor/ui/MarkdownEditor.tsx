/**
 * @module react-native-notion-markdown/editor/ui/MarkdownEditor
 *
 * @file      MarkdownEditor.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as DocumentPicker from "expo-document-picker";
import {
    AcceptEditorEvent,
    CreateEditorDocument,
    type EditorBlock,
    type EditorColumnCount,
    type EditorCommand,
    type EditorEvent,
    type EditorPoint,
    type EditorSnapshot,
    type EditorTextMark,
    type EditorTextMarkKind
} from "../../prototype.ts";
import Animated, { FadeIn, FadeOut, useAnimatedStyle } from "react-native-reanimated";
import {
    KeyboardStickyView,
    useKeyboardState,
    useReanimatedKeyboardAnimation
} from "react-native-keyboard-controller";
import {
    type NativeBlockActionsPressEvent,
    type NativeContentSizeEvent,
    NativeEditor,
    type NativeEditorProps,
    type NativePageReferencePressEvent
} from "../../NativeEditor.tsx";
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
import { ActionsBottomSheet } from "./ActionsBottomSheet.tsx";
import { AudioBottomSheet } from "./AudioBottomSheet.tsx";
import type { ComponentType } from "react";
import type { EditorMessageId } from "./messages.ts";
import { EmojiBottomSheet } from "./EmojiBottomSheet.tsx";
import type { LayoutChangeEvent } from "react-native";
import { LinkBottomSheet } from "./LinkBottomSheet.tsx";
import { MediaBottomSheet } from "./MediaBottomSheet.tsx";
import type { MarkdownEditorBlockAction } from "./ActionsBottomSheet.tsx";
import type { MarkdownColor } from "../../document/types.ts";
import { openPageReferenceUrl } from "../../openPageReference.ts";
import { useMarkdownEditorTranslate } from "./config.tsx";

/**
 * Buttons that can display an icon in the editor UI.
 *
 * @since 1.0.0
 */
export type MarkdownEditorButton =
    | "insert"
    | "color"
    | "gallery"
    | "picture"
    | "video"
    | "format"
    | "bold"
    | "italic"
    | "strikethrough"
    | "underline"
    | "code"
    | "mermaid"
    | "eraseFormatting"
    | "link"
    | "speech"
    | "record"
    | "stop"
    | "play"
    | "pause"
    | "filePicker"
    | "turnInto"
    | "undo"
    | "redo"
    | "remove"
    | "indent"
    | "outdent"
    | "moveUp"
    | "moveDown"
    | "back"
    | "close"
    | "cancel"
    | "check"
    | "copy"
    | "cut"
    | "paste"
    | "edit"
    | "linkToPage"
    | "hideKeyboard"
    | "text"
    | "bulletedList"
    | "numberedList"
    | "toggleList"
    | "table"
    | "divider"
    | "tableOfContents"
    | "columns"
    | "columns2"
    | "columns3"
    | "columns4"
    | "columns5"
    | "toDo"
    | "callout"
    | "quote"
    | "more"
    | "heading1"
    | "heading2"
    | "heading3"
    | "heading4"
    | "toggleHeading1"
    | "toggleHeading2"
    | "toggleHeading3"
    | "toggleHeading4"
    | "returnToKeyboard";

/**
 * Props accepted by an icon component supplied by the host application.
 *
 * @since 1.0.0
 */
export interface MarkdownEditorIconProps
{
    readonly color: string;
    readonly size: number;
    readonly strokeWidth: number;
}

/**
 * Optional per-button icon overrides. Toolbar buttons with no entry here fall back to a plain text
 * label. The built-in media sheet uses these overrides first, then the optional Lucide peer, then
 * its dependency-free SVG fallback. Import {@link markdownEditorLucideIcons} from
 * `react-native-notion-markdown/editor/ui/lucide-icons` for a ready-made toolbar icon set.
 *
 * @since 1.0.0
 */
export interface MarkdownEditorComponents extends Partial<Record<
    MarkdownEditorButton,
    ComponentType<MarkdownEditorIconProps>
>> { }

/** The built-in media action selected from the insert-media sheet. */
export type MarkdownEditorMediaAction = "gallery" | "picture" | "video";

/** A portable description of one asset returned by Expo ImagePicker. */
export interface MarkdownEditorMediaAsset
{
    readonly duration?: number | null;
    readonly fileName?: string | null;
    readonly fileSize?: number;
    readonly height: number;
    readonly mimeType?: string | null;
    readonly type?: string | null;
    readonly uri: string;
    readonly width: number;
}

/** Result delivered after an action in the built-in insert-media sheet completes. */
export interface MarkdownEditorMediaSelection
{
    readonly action: MarkdownEditorMediaAction;
    readonly assets?: ReadonlyArray<MarkdownEditorMediaAsset>;
    readonly canceled: boolean;
}

/** The two sources supported by the built-in audio workflow. */
export type MarkdownEditorAudioAction = "picked" | "recorded";

/** A portable audio asset returned by the document picker or recorder. */
export interface MarkdownEditorAudioAsset
{
    readonly duration?: number;
    readonly fileName?: string;
    readonly fileSize?: number;
    readonly mimeType?: string;
    readonly waveform?: ReadonlyArray<number>;
    readonly uri: string;
}

/** Result delivered after audio insertion or replacement completes. */
export interface MarkdownEditorAudioSelection
{
    readonly action: MarkdownEditorAudioAction;
    readonly asset?: MarkdownEditorAudioAsset;
    readonly canceled: boolean;
    readonly error?: string;
}

/** A portable file asset returned by the built-in native document picker. */
export interface MarkdownEditorFileAsset
{
    readonly fileName?: string;
    readonly fileSize?: number;
    readonly mimeType?: string;
    readonly uri: string;
}

/** Result delivered after the built-in file picker completes. */
export interface MarkdownEditorFileSelection
{
    readonly asset?: MarkdownEditorFileAsset;
    readonly canceled: boolean;
}

/**
 * Display data for a page reference used by the editor.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface MarkdownEditorPageReference
{
    readonly icon?: string;
    readonly id: string;
    readonly label: string;
    readonly url: string;
}

/**
 * The corresponding selection range for a page reference.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface MarkdownEditorPageReferenceSelection
{
    readonly anchor: EditorPoint;
    readonly focus: EditorPoint;
}

/**
 * Identifies the block a tap opened the actions sheet for -- a block that may never receive the
 * text cursor (e.g. a divider), so it's identified directly rather than via selection.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface MarkdownEditorBlockActionsSelection
{
    readonly blockId: string;
    readonly blockType: EditorBlock["type"];
}

/** The current text selection handed to a host link prompt. */
export interface MarkdownEditorLinkSelection
{
    readonly anchor: EditorPoint;
    readonly focus: EditorPoint;
    readonly label: string;
    readonly url?: string;
}

/** A link value returned by a host link prompt or the built-in link modal. */
export interface MarkdownEditorLinkResult
{
    readonly label?: string;
    readonly url: string;
}

/** Host-supplied link prompt result. Returning nothing leaves the selection unchanged. */
export type MarkdownEditorLinkPromptResult =
    | MarkdownEditorLinkResult
    | null
    | undefined
    | Promise<MarkdownEditorLinkResult | null | undefined>;

/**
 * Theme and control values handed to a {@link MarkdownEditorCustomPanel}'s `render` function, so
 * custom panel content can match the editor's current theme without re-deriving dark/light
 * itself, and can close the panel the same way the built-in "Return to keyboard" option does.
 *
 * @since 1.0.0
 */
export interface MarkdownEditorCustomPanelContext
{
    /** Raised-card surface color, matching the built-in insert panel's block options. */
    readonly cardBackground: string;

    /** Closes this panel and refocuses the native keyboard. */
    readonly close: () => void;

    /** Regular text color. */
    readonly foreground: string;

    /** Muted icon/label color, matching the toolbar's icon color. */
    readonly iconColor: string;

    /** Recessed panel surface color, matching the built-in insert panel. */
    readonly panelBackground: string;
}

/**
 * A panel that replaces the on-screen keyboard while its owning {@link MarkdownEditorCustomButton}
 * is active -- the custom equivalent of the built-in "Basic blocks" insert panel.
 *
 * @since 1.0.0
 */
export interface MarkdownEditorCustomPanel
{
    /** Fixed panel height, used to reserve space above the keyboard while the panel is open. */
    readonly height: number;

    /** Renders the panel's content. */
    readonly render: ComponentType<MarkdownEditorCustomPanelContext>;
}

/**
 * Placement of a {@link MarkdownEditorCustomButton} relative to another button's id -- a built-in
 * main-row id (`"insert" | "format" | "speech" | "filePicker" | "turnInto" | "undo" | "redo" |
 * "remove" | "indent" | "outdent" | "moveUp" | "moveDown" | "copy" | "cut" | "paste" | "edit"` -- the last
 * four are not shown by
 * default, but remain valid anchors; `"redo"` only renders once there is a redo available, and
 * `"moveUp"`/`"moveDown"` only render once the selection identifies block(s) that can move in
 * that direction) or another custom button's `id`. At most one of `after`/`before` may be
 * supplied; omitting both appends the button to the end of the row.
 *
 * @since 1.0.0
 */
export type MarkdownEditorCustomButtonPlacement =
    | { readonly after: string; readonly before?: undefined }
    | { readonly after?: undefined; readonly before: string }
    | { readonly after?: undefined; readonly before?: undefined };

interface MarkdownEditorCustomButtonBase
{
    /** Icon for this button. Omit for a plain text label, matching the built-in buttons. */
    readonly icon?: ComponentType<MarkdownEditorIconProps>;

    /** Unique id for this button, used for placement and to identify its open panel. */
    readonly id: string;

    readonly label: string;
}

/**
 * A consumer-supplied button spliced into the main toolbar row -- never the format row or the
 * trailing hide-keyboard/close slot. Supply either `onPress` for a plain action button, or
 * `panel` to pair the button with a {@link MarkdownEditorCustomPanel}: pressing it then opens that
 * panel in place of the on-screen keyboard, and the button is highlighted the same way the
 * built-in "Insert" button is while its panel is open.
 *
 * @since 1.0.0
 */
export type MarkdownEditorCustomButton =
    MarkdownEditorCustomButtonBase
    & MarkdownEditorCustomButtonPlacement
    & (
        | { readonly onPress: () => void; readonly panel?: undefined }
        | { readonly onPress?: undefined; readonly panel: MarkdownEditorCustomPanel }
    );

/**
 * Props for the configured editor UI.
 *
 * @since 1.0.0
 */
export interface MarkdownEditorProps extends Omit<NativeEditorProps, "command" | "onEdit" | "snapshot">
{
    /** Horizontal inset applied to the WYSIWYG page content. The MAB is not affected. */
    readonly pagePaddingHorizontal?: number;

    /** Maximum width of the centered WYSIWYG page content. The default is 960 logical pixels. */
    readonly pageMaxWidth?: number;

    /** Document state. When omitted, a starter document is created and managed internally. */
    readonly snapshot?: EditorSnapshot;

    /** An externally controlled native command. */
    readonly command?: EditorCommand;

    /** Receives native editing events. Omit this callback for internally managed document state. */
    readonly onEdit?: (Event: { nativeEvent: EditorEvent }) => void;

    /** Receives actions selected in the editor UI, plus any level/color/type/mark/url/label it carries. */
    readonly onCommand?: (
        Action: EditorCommand["action"],
        Extra?: Pick<EditorCommand,
            "level" | "color" | "icon" | "type" | "toggle" | "mark" | "columnCount" | "url"
            | "label" | "blockId"
            | "duration" | "waveform" | "mimeType" | "fileName" | "fileSize">
    ) => void;

    /** Optional icon overrides for the editor UI. */
    readonly components?: MarkdownEditorComponents;

    /**
     * Replaces the built-in insert-media sheet. This is also the fallback for applications that
     * do not install the optional `expo-image-picker` peer.
     */
    readonly onInsertMedia?: () => void | Promise<void>;

    /** Replaces the built-in audio sheet opened by the existing `speech` toolbar button. */
    readonly onInsertAudio?: () => void | Promise<void>;

    /** Replaces the native file picker used by the Insert panel's File action. */
    readonly onFilePicker?: () => void | Promise<void>;

    /**
     * Receives selections made by the built-in insert-media sheet; image and
     * video assets are also displayed in the editor automatically.
     */
    readonly onMediaSelected?: (
        Selection: MarkdownEditorMediaSelection
    ) => void | Promise<void>;

    /** Observes picked, recorded, cancelled, and failed audio selections. */
    readonly onAudioSelected?: (
        Selection: MarkdownEditorAudioSelection
    ) => void | Promise<void>;

    /** Observes picked and cancelled selections from the built-in file picker. */
    readonly onFileSelected?: (
        Selection: MarkdownEditorFileSelection
    ) => void | Promise<void>;

    /** Requests that the dependent create a page reference for the current selection. */
    readonly onCreatePageReference?: (
        Selection: MarkdownEditorPageReferenceSelection
    ) => void | Promise<void>;

    /** Requests that the dependent edit the selected page reference. */
    readonly onEditPageReference?: (
        Reference: MarkdownEditorPageReference
    ) => void | Promise<void>;

    /** Prompts for a link URL and optional replacement label instead of using the built-in modal. */
    readonly onRequestLink?: (
        Selection: MarkdownEditorLinkSelection
    ) => MarkdownEditorLinkPromptResult;

    /** Handles page-reference taps, or falls back to the optional expo-linking peer. */
    readonly onOpenPageReference?: (url: string) => void | Promise<void>;

    /**
     * Replaces the built-in block-actions sheet -- opened by tapping a block that doesn't
     * otherwise receive the text cursor, currently the divider.
     */
    readonly onBlockActions?: (
        Selection: MarkdownEditorBlockActionsSelection
    ) => void | Promise<void>;

    /** Buttons spliced into the main toolbar row. Never shown in the format row or trailing slot. */
    readonly customButtons?: Array<MarkdownEditorCustomButton>;
}

interface ActionButtonProps
{
    /** Highlights the button as the active toggle for an open panel (e.g. "Insert" while open). */
    readonly active?: boolean;
    readonly activeBackground?: string;
    readonly button?: MarkdownEditorButton;
    readonly color: string;
    readonly components?: MarkdownEditorComponents;
    /** Dims the button and blocks presses, e.g. "Undo" with no history to undo. */
    readonly disabled?: boolean;
    /** Icon to use directly, taking precedence over `button`/`components` lookup -- for custom buttons. */
    readonly icon?: ComponentType<MarkdownEditorIconProps>;
    readonly label: string;
    readonly onPress: () => void;
}

interface BlockOptionProps
{
    readonly background: string;
    readonly button?: MarkdownEditorButton;
    /** Icon color -- muted, matching the toolbar's icon color. */
    readonly color: string;
    readonly components?: MarkdownEditorComponents;
    readonly fullWidth?: boolean;
    readonly grid?: boolean;
    readonly label: string;
    /** Label text color -- the editor's regular foreground, for contrast against the muted icon. */
    readonly labelColor: string;
    readonly disabled?: boolean;
    readonly onPress: () => void;
}

/** Resolve the MAB's text-label color while leaving each option's icon color untouched. */
function resolveMabLabelColor(labelColor: string): string
{
    if (labelColor === "#ada9a3") {return "#A8A8A8";}
    if (labelColor === "#8e8b86") {return "#646464";}
    return labelColor;
}

/**
 * Resolve a host-supplied icon override for a button, if any.
 *
 * Bundlers used by React Native (Metro) resolve every `require`/`import` specifier at build
 * time, even ones a JS-level `try`/`catch` guards at runtime -- so a literal, statically visible
 * import of the optional `lucide-react-native` peer here would force every consumer of
 * `editor/ui` to install it, and a *hidden* one (e.g. via `eval("require")`) is never bundled at
 * all and can thus never succeed even when the peer is present. Either way, this module cannot
 * auto-detect and load Lucide itself. Consumers who have the peer installed opt in explicitly by
 * importing {@link markdownEditorLucideIcons} from `react-native-notion-markdown/editor/ui/
 * lucide-icons` -- a separate module Metro only needs to resolve `lucide-react-native` for when
 * something actually imports it -- and passing it as `components`.
 *
 * @since 1.0.0
 */
function getButtonIcon(
    button: MarkdownEditorButton | undefined,
    components: MarkdownEditorComponents | undefined
): ComponentType<MarkdownEditorIconProps> | undefined
{
    if (button === undefined || components === undefined)
    {
        return undefined;
    }

    /* Keep the original `columns` override working for hosts that have not yet added the
       count-specific icons. */
    return components[ button ]
        ?? (button === "columns2" || button === "columns3" || button === "columns4" || button === "columns5"
            ? components.columns
            : undefined);
}

/**
 * Render an accessible editor action with a host-supplied icon override, or a text fallback.
 *
 * @since 1.0.0
 */
function ActionButton({
    active,
    activeBackground,
    button,
    color,
    components,
    disabled,
    icon,
    label,
    onPress
}: ActionButtonProps)
{
    const Icon = icon ?? getButtonIcon(button, components);
    const textStyle = useMemo(() => ({ color }), [ color ]);
    /* Borderless ripple to match Material's icon-button treatment; ignored on iOS. */
    const ripple = useMemo(() => ({ borderless: true, color: `${color}33` }), [ color ]);
    const accessibilityState = useMemo(
        () => ({ disabled: disabled === true, selected: active === true }),
        [ active, disabled ]
    );
    const buttonStyle = useMemo(
        () => [
            styles.button,
            active === true ? styles.buttonActive : undefined,
            active === true ? { backgroundColor: activeBackground, borderRadius: 8 } : undefined,
            disabled === true ? styles.buttonDisabled : undefined
        ],
        [ active, activeBackground, disabled ]
    );

    return <Pressable
        accessibilityLabel={ label }
        accessibilityRole="button"
        accessibilityState={ accessibilityState }
        android_ripple={ ripple }
        disabled={ disabled }
        onPress={ onPress }
        style={ buttonStyle }>
        {
            Icon === undefined
                ? <Text style={ textStyle }>{ label }</Text>
                : createElement(Icon, { color, size: 22, strokeWidth: 2 })
        }
    </Pressable>;
}

/**
 * Render a labeled block option for the "Basic blocks" panel -- an icon-and-label card, matching
 * Markdown's own insert-block picker rather than the toolbar's icon-only buttons.
 *
 * @since 1.0.0
 */
function BlockOption({
    background,
    button,
    color,
    components,
    disabled,
    fullWidth,
    grid,
    label,
    labelColor,
    onPress
}: BlockOptionProps)
{
    const Icon = getButtonIcon(button, components);
    const ripple = useMemo(() => ({ color: `${color}22` }), [ color ]);
    const cardStyle = useMemo(
        () => [
            styles.blockOption,
            fullWidth === true
                ? styles.blockOptionFull
                : grid === true ? styles.blockOptionGrid : styles.blockOptionHalf,
            disabled === true ? styles.buttonDisabled : undefined,
            { backgroundColor: background }
        ],
        [ background, disabled, fullWidth, grid ]
    );
    const labelStyle = useMemo(
        () => [ styles.blockOptionLabel, { color: resolveMabLabelColor(labelColor) } ],
        [ labelColor ]
    );
    const accessibilityState = useMemo(
        () => ({ disabled: disabled === true }), [ disabled ]
    );

    return <Pressable accessibilityLabel={ label }
        accessibilityRole="button"
        accessibilityState={ accessibilityState }
        android_ripple={ ripple }
        disabled={ disabled }
        onPress={ onPress }
        style={ cardStyle }>
        {
            Icon !== undefined && createElement(Icon, { color, size: 22, strokeWidth: 2 })
        }
        <Text style={ labelStyle }>{ label }</Text>
    </Pressable>;
}

interface EditorColorOption
{
    readonly background: boolean;
    readonly color: MarkdownColor | undefined;
    readonly hex: string | undefined;
}

/* The Markdown-formatted content text colors, plus their `_bg` background variants, offered by the
   selection color panel. `undefined` clears the selected blocks back to their default color. */
const editorColorOptions: ReadonlyArray<EditorColorOption> =
    [
        { background: false, color: undefined, hex: undefined },
        { background: false, color: "gray", hex: "#787774" },
        { background: false, color: "brown", hex: "#9F6B53" },
        { background: false, color: "orange", hex: "#D9730D" },
        { background: false, color: "yellow", hex: "#CB912F" },
        { background: false, color: "green", hex: "#448361" },
        { background: false, color: "blue", hex: "#337EA9" },
        { background: false, color: "purple", hex: "#9065B0" },
        { background: false, color: "pink", hex: "#C14C8A" },
        { background: false, color: "red", hex: "#D44C47" },
        { background: true, color: "gray_bg", hex: "#787774" },
        { background: true, color: "brown_bg", hex: "#9F6B53" },
        { background: true, color: "orange_bg", hex: "#D9730D" },
        { background: true, color: "yellow_bg", hex: "#CB912F" },
        { background: true, color: "green_bg", hex: "#448361" },
        { background: true, color: "blue_bg", hex: "#337EA9" },
        { background: true, color: "purple_bg", hex: "#9065B0" },
        { background: true, color: "pink_bg", hex: "#C14C8A" },
        { background: true, color: "red_bg", hex: "#D44C47" }
    ];

const editorTurnIntoTypes: ReadonlyArray<EditorBlock["type"]> =
    [ "text", "heading_1", "heading_2", "heading_3", "heading_4" ];

const editorColumnButtons: Readonly<Record<EditorColumnCount, Extract<MarkdownEditorButton,
    "columns2" | "columns3" | "columns4" | "columns5">>> =
    {
        2: "columns2",
        3: "columns3",
        4: "columns4",
        5: "columns5"
    };

/** Message id naming each block type, for the actions sheet's section-title label. */
const editorBlockNameMessageIds: Readonly<Record<EditorBlock["type"], EditorMessageId>> =
    {
        audio: "blockName.audio",
        bulleted_list_item: "blockName.bulletedListItem",
        callout: "blockName.callout",
        column_list: "blockName.columnList",
        divider: "blockName.divider",
        file: "blockName.file",
        heading_1: "blockName.heading1",
        heading_2: "blockName.heading2",
        heading_3: "blockName.heading3",
        heading_4: "blockName.heading4",
        image: "blockName.image",
        link_to_page: "blockName.linkToPage",
        numbered_list_item: "blockName.numberedListItem",
        quote: "blockName.quote",
        table_of_contents: "blockName.tableOfContents",
        text: "blockName.text",
        to_do: "blockName.toDo",
        video: "blockName.video"
    };

/** Return whether an editor block supports conversion to the requested editor block type. */
function canConvertEditorBlock(block: EditorBlock, type: EditorBlock["type"]): boolean
{
    return editorTurnIntoTypes.includes(block.type) && editorTurnIntoTypes.includes(type);
}

/**
 * Return whether a collapsed cursor at the given UTF-16 offset touches a word -- the character
 * immediately before or after the cursor is non-whitespace. This covers the beginning, middle,
 * and end of a word, matching the range the native side widens the format command to.
 *
 * @since 1.0.0
 */
function editorCursorTouchesWord(text: string, offset: number): boolean
{
    const before = offset > 0 ? text[offset - 1] : undefined;
    const after = offset < text.length ? text[offset] : undefined;
    return (before !== undefined && !/\s/.test(before)) || (after !== undefined && !/\s/.test(after));
}

/**
 * A human-readable accessibility label for a color swatch. The color catalog is a fixed, small
 * set of Markdown-defined names rather than host-facing copy, so it isn't routed through `t()`.
 *
 * @since 1.0.0
 */
function editorColorLabel(option: EditorColorOption, defaultLabel: string): string
{
    if (option.color === undefined) {return defaultLabel;}

    const base = option.background ? option.color.slice(0, -3) : option.color;
    const name = base.charAt(0).toUpperCase() + base.slice(1);
    return option.background ? `${name} background` : name;
}

interface ColorChoiceProps
{
    readonly cardBackground: string;
    readonly foreground: string;
    readonly iconColor: string;
    readonly label: string;
    readonly onPress: () => void;
    readonly option: EditorColorOption;
    readonly selected: boolean;
}

/**
 * One choice in the color panel. The letter is intentionally used instead of an optional icon
 * dependency so the default batteries-included UI always has the same visual affordance.
 *
 * @since 1.0.0
 */
function ColorChoice({
    cardBackground,
    foreground,
    iconColor,
    label,
    onPress,
    option,
    selected
}: ColorChoiceProps)
{
    const ripple = useMemo(() => ({ borderless: true, color: `${iconColor}33` }), [ iconColor ]);
    const iconBackground = option.background && option.hex !== undefined ? option.hex : "transparent";
    const iconForeground = option.background ? foreground : (option.hex ?? foreground);
    const iconBorder = option.background ? (selected ? foreground : "transparent") : iconColor;
    const iconStyle = useMemo(() => [
        styles.colorIcon,
        { backgroundColor: iconBackground, borderColor: iconBorder }
    ], [ iconBackground, iconBorder ]);
    const iconTextStyle = useMemo(
        () => [ styles.colorIconText, { color: iconForeground } ], [ iconForeground ]
    );
    const labelStyle = useMemo(() => [ styles.blockOptionLabel, { color: foreground } ], [ foreground ]);
    const accessibilityState = useMemo(() => ({ selected }), [ selected ]);
    const cardStyle = useMemo(
        () => [ styles.blockOption, styles.blockOptionHalf, { backgroundColor: cardBackground } ],
        [ cardBackground ]
    );

    return <Pressable accessibilityLabel={ label }
        accessibilityRole="button"
        accessibilityState={ accessibilityState }
        android_ripple={ ripple }
        onPress={ onPress }
        style={ cardStyle }>
        <View style={ iconStyle }>
            <Text style={ iconTextStyle }>A</Text>
        </View>
        <Text style={ labelStyle }>{ label }</Text>
    </Pressable>;
}

/** Split color options into rows of two for the color panel's two-column grids. */
function editorColorRows(
    options: ReadonlyArray<EditorColorOption>
): Array<Readonly<[EditorColorOption, EditorColorOption | undefined]>>
{
    const rows: Array<Readonly<[EditorColorOption, EditorColorOption | undefined]>> = [ ];
    for (let index = 0; index < options.length; index += 2)
    {
        const first = options[ index ];
        if (first !== undefined)
        {
            rows.push([ first, options[ index + 1 ] ]);
        }
    }

    return rows;
}

interface ColorOptionGridProps
{
    readonly cardBackground: string;
    readonly defaultLabel: string;
    readonly foreground: string;
    readonly iconColor: string;
    readonly onSelect: (color: MarkdownColor | undefined) => () => void;
    readonly options: ReadonlyArray<EditorColorOption>;
}

/** Render one two-column color-option grid for a color-panel section. */
function ColorOptionGrid({
    cardBackground,
    defaultLabel,
    foreground,
    iconColor,
    onSelect,
    options
}: ColorOptionGridProps)
{
    return <View>
        {
            editorColorRows(options).map((row: Readonly<[EditorColorOption, EditorColorOption | undefined]>) =>
            {
                const firstKey = row[ 0 ].color ?? "default";
                return <View key={ firstKey }
                    style={ styles.blockRow }>
                    <ColorChoice
                        cardBackground={ cardBackground }
                        foreground={ foreground }
                        iconColor={ iconColor }
                        label={ editorColorLabel(row[ 0 ], defaultLabel) }
                        onPress={ onSelect(row[ 0 ].color) }
                        option={ row[ 0 ] }
                        selected={ false } />
                    {
                        row[ 1 ] === undefined
                            ? <View style={ styles.blockOptionSpacer } />
                            : <ColorChoice
                                cardBackground={ cardBackground }
                                foreground={ foreground }
                                iconColor={ iconColor }
                                label={ editorColorLabel(row[ 1 ], defaultLabel) }
                                onPress={ onSelect(row[ 1 ].color) }
                                option={ row[ 1 ] }
                                selected={ false } />
                    }
                </View>;
            })
        }
    </View>;
}

type ToolbarRow =
    | "main"
    | "format";

type OpenPanel =
    | { readonly kind: "none" }
    | { readonly kind: "color" }
    | { readonly kind: "insert" }
    | { readonly kind: "turnInto" }
    | { readonly id: string; readonly kind: "custom" };

const NoPanelOpen: OpenPanel = { kind: "none" };

/**
 * Height of the main toolbar row, shared between its style and the
 * footer-height calculation below so the two can't drift out of sync.
 */
const ToolbarHeight = 48;

/** Default horizontal inset for the WYSIWYG page content, in logical pixels. */
const DefaultPagePaddingHorizontal = 24;

/** Default maximum width for the WYSIWYG page content, in logical pixels. */
const DefaultPageMaxWidth = 960;

/* Fixed height of the "Basic blocks" panel. Its content scrolls internally, so this only needs
   to comfortably fit the color row plus a few block options above the fold. */
const BasicBlocksPanelHeight = 300;

/* Fixed height of the color panel. Its two-column sections scroll vertically. */
const ColorPanelHeight = 300;

/** Width of the fade that blends the scrollable toolbar into the fixed trailing button. */
const ScrollFadeWidth = 20;

/* A small tolerance keeps a navigation-bar rounding difference from making a keyboard that is
   exactly below the editor look like it overlaps it. */
const KeyboardGeometryTolerance = 2;

/**
 * A pure-View approximation of a linear gradient (no `expo-linear-gradient`/native gradient
 * dependency): evenly spaced flat slices with increasing alpha read as a smooth fade at this
 * width. `steps` is intentionally small since a coarser gradient over ~20px is imperceptible.
 */
const ScrollFadeSteps = 8;

/**
 * The ready-to-use editor surface, including the keyboard-adjacent editor controls.
 *
 * @since 1.0.0
 */
export function MarkdownEditor({
    command: suppliedCommand,
    components,
    customButtons,
    dark: suppliedDark,
    onBlockActions,
    onCommand,
    onCreatePageReference,
    onEditPageReference,
    onRequestLink,
    onEdit,
    onFilePicker,
    onInsertMedia,
    onInsertAudio,
    onAudioSelected,
    onFileSelected,
    onMediaSelected,
    onOpenPageReference,
    emptyTogglePlaceholder: suppliedEmptyTogglePlaceholder,
    pageReferenceFallbackIcon: suppliedPageReferenceFallbackIcon,
    pagePaddingHorizontal = DefaultPagePaddingHorizontal,
    pageMaxWidth = DefaultPageMaxWidth,
    imageMaxWidth = DefaultPageMaxWidth,
    snapshot: suppliedSnapshot,
    ...viewProps
}: MarkdownEditorProps)
{
    const t = useMarkdownEditorTranslate();
    const [ defaultSnapshot ] = useState(CreateEditorDocument);
    const [ internalSnapshot, setInternalSnapshot ] = useState<EditorSnapshot>();
    const [ internalCommand, setInternalCommand ] = useState<EditorCommand>();
    const [ row, setRow ] = useState<ToolbarRow>("main");
    const [ openPanel, setOpenPanel ] = useState<OpenPanel>(NoPanelOpen);
    const refocusAfterPanelClose = useRef(false);
    const [ mediaSheetVisible, setMediaSheetVisible ] = useState(false);
    const [ audioSheetVisible, setAudioSheetVisible ] = useState(false);
    const [ audioSheetInitialAction, setAudioSheetInitialAction ] = useState<MarkdownEditorAudioAction>();
    const [ audioReplacementBlockId, setAudioReplacementBlockId ] = useState<string>();
    const [ linkSheetVisible, setLinkSheetVisible ] = useState(false);
    const [ linkRequest, setLinkRequest ] = useState<MarkdownEditorLinkSelection>();
    const [ blockActionsRequest, setBlockActionsRequest ] = useState<MarkdownEditorBlockActionsSelection>();
    const [ emojiSheetVisible, setEmojiSheetVisible ] = useState(false);
    const [ emojiSheetBlockId, setEmojiSheetBlockId ] = useState<string>();
    /* The native text layout's own content height, in dp -- reported by the native view since
       `shouldUseAndroidLayout` keeps its Yoga-assigned box fixed regardless of content (see
       NativeEditor's onContentSize doc). Sizing the page to this explicitly, rather than
       `flex: 1`, is what lets content taller than the viewport (e.g. a tall image) become
       reachable by scrolling instead of being silently clipped. `undefined` until the first
       report arrives, during which the page falls back to filling the available viewport. */
    const [ contentHeight, setContentHeight ] = useState<number>();
    const sequence = useRef(0);
    const currentSnapshot = useRef(suppliedSnapshot ?? internalSnapshot ?? defaultSnapshot);
    /* A JS-side history of past/undone snapshots for the internally-managed document. This needs
       no native undo support: undoing/redoing simply hands the native editor an older/newer
       snapshot under a bumped epoch, the same "replace the whole document" path already used for
       a host-supplied `snapshot` -- see MarkdownEditorView.kt's `setSnapshot`. Edits reported with
       `source === "replacement"` are our own history replay landing back through `onEdit`, not new
       user edits, so they're accepted into state but never pushed onto the undo stack. */
    const undoStack = useRef<Array<EditorSnapshot>>([ ]);
    const redoStack = useRef<Array<EditorSnapshot>>([ ]);
    const [ canUndo, setCanUndo ] = useState(false);
    const [ canRedo, setCanRedo ] = useState(false);
    /* The block(s) the current native selection spans, tracked from `EditorEvent.anchor`/`focus`
       so the move-up/move-down buttons can tell whether a contiguous block range is addressable
       and, if so, whether it's already at the top/bottom of the document. `undefined` until the
       native view reports its first selection (e.g. on focus), matching "only appear once the
       selection identifies block(s)". */
    const [ selectionAnchorBlockId, setSelectionAnchorBlockId ] = useState<string>();
    const [ selectionAnchorOffset, setSelectionAnchorOffset ] = useState<number>();
    const [ selectionFocusBlockId, setSelectionFocusBlockId ] = useState<string>();
    const [ selectionFocusOffset, setSelectionFocusOffset ] = useState<number>();
    const root = useRef<View>(null);
    const [ bottomGap, setBottomGap ] = useState(0);
    const bottomGapRef = useRef(0);
    const { height: windowHeight } = useWindowDimensions();
    const systemDark = useColorScheme() === "dark";
    const dark = suppliedDark ?? systemDark;
    const keyboardState = useKeyboardState();
    const previousKeyboardVisibility = useRef(keyboardState.isVisible);
    const { height, progress } = useReanimatedKeyboardAnimation();
    const foreground = dark ? "#eeeeee" : "#2C2C2B";
    const background = dark ? "#191919" : "#ffffff";
    /* Matches Markdown's own above-the-keyboard toolbar icon/label color, sampled from its
       mobile action bar in both themes -- a warm gray, not a neutral one. */
    const iconColor = dark ? "#ada9a3" : "#8e8b86";
    /* The "Basic blocks" panel sits on a slightly recessed surface, with raised cards for each
       option -- matching Markdown's own insert-block picker. */
    const panelBackground = dark ? "#2b2b2a" : "#f7f7f5";
    const cardBackground = dark ? "#3a3a39" : "#ffffff";
    const activeBackground = dark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";
    const dividerColor = dark ? "rgba(255, 255, 255, 0.14)" : "rgba(0, 0, 0, 0.12)";
    /* RGB channels of `background` (the toolbar's own surface), so the scroll fade can blend into
       it at increasing opacity instead of a plain, harder-edged divider. */
    const backgroundRgb = dark ? "25, 25, 25" : "255, 255, 255";
    const snapshot = suppliedSnapshot ?? internalSnapshot ?? defaultSnapshot;
    const columnLabels: Record<EditorColumnCount, string> =
        {
            2: t("insertPanel.columns2"),
            3: t("insertPanel.columns3"),
            4: t("insertPanel.columns4"),
            5: t("insertPanel.columns5")
        };
    const command = suppliedCommand ?? internalCommand;
    /* The contiguous block range spanned by the current selection, by index into `snapshot.
       blocks` -- or `undefined` when either endpoint no longer resolves to a block. */
    const selectionBlockRange = useMemo(() =>
    {
        if (selectionAnchorBlockId === undefined || selectionFocusBlockId === undefined)
        {
            return undefined;
        }

        const anchorIndex = snapshot.blocks.findIndex(
            (block: EditorBlock) => block.id === selectionAnchorBlockId
        );
        const focusIndex = snapshot.blocks.findIndex(
            (block: EditorBlock) => block.id === selectionFocusBlockId
        );

        return anchorIndex === -1 || focusIndex === -1
            ? undefined
            : { high: Math.max(anchorIndex, focusIndex), low: Math.min(anchorIndex, focusIndex) };
    }, [ selectionAnchorBlockId, selectionFocusBlockId, snapshot.blocks ]);
    const hasTextSelection = selectionAnchorBlockId !== undefined
        && selectionFocusBlockId !== undefined
        && selectionAnchorOffset !== undefined
        && selectionFocusOffset !== undefined
        && (selectionAnchorBlockId !== selectionFocusBlockId
            || selectionAnchorOffset !== selectionFocusOffset);
    const canColorSelection = hasTextSelection && selectionBlockRange !== undefined
        && snapshot.blocks.slice(selectionBlockRange.low, selectionBlockRange.high + 1).some(
            (block: EditorBlock) => block.type === "text"
                || block.type === "heading_1"
                || block.type === "heading_2"
                || block.type === "heading_3"
                || block.type === "heading_4"
        );
    /* A collapsed cursor (no range selected) formats the word it touches, so the sub-menu
       buttons stay enabled at the start, middle, or end of a word -- not just over a range. */
    const selectionIsCollapsed = selectionAnchorBlockId !== undefined
        && selectionFocusBlockId !== undefined
        && selectionAnchorOffset !== undefined
        && selectionFocusOffset !== undefined
        && selectionAnchorBlockId === selectionFocusBlockId
        && selectionAnchorOffset === selectionFocusOffset;
    const cursorBlock = selectionIsCollapsed
        ? snapshot.blocks.find((block: EditorBlock) => block.id === selectionAnchorBlockId)
        : undefined;
    const canFormatCollapsedCursor = cursorBlock !== undefined
        && cursorBlock.type !== "link_to_page"
        && editorCursorTouchesWord(cursorBlock.text, selectionAnchorOffset as number);
    const canFormatSelection = canFormatCollapsedCursor
        || (hasTextSelection && selectionBlockRange !== undefined
            && !snapshot.blocks.slice(selectionBlockRange.low, selectionBlockRange.high + 1).some(
                (block: EditorBlock) => block.type === "link_to_page"
            ));
    const canLinkSelection = canFormatSelection && selectionBlockRange !== undefined
        && snapshot.blocks.slice(selectionBlockRange.low, selectionBlockRange.high + 1).every(
            (block: EditorBlock) => [
                "text", "heading_1", "heading_2", "heading_3", "heading_4",
                "bulleted_list_item", "numbered_list_item", "to_do"
            ].includes(block.type)
        );
    const canIndent = selectionBlockRange !== undefined && selectionBlockRange.low > 0;
    const canOutdent = selectionBlockRange !== undefined
        && snapshot.blocks.slice(selectionBlockRange.low, selectionBlockRange.high + 1).some(
            (block: EditorBlock) => (block.depth ?? 0) > 0
        );
    const selectedPageReference = useMemo<MarkdownEditorPageReference | undefined>(() =>
    {
        if (selectionBlockRange === undefined || selectionBlockRange.low !== selectionBlockRange.high)
        {
            return undefined;
        }
        const block = snapshot.blocks[selectionBlockRange.low];
        return block?.type === "link_to_page" && block.url !== undefined
            ? { icon: block.icon, id: block.id, label: block.text, url: block.url }
            : undefined;
    }, [ selectionBlockRange, snapshot.blocks ]);
    const canEditPageReference = selectedPageReference !== undefined
        && onEditPageReference !== undefined;
    const selectedCallout = selectionBlockRange !== undefined
        && selectionBlockRange.low === selectionBlockRange.high
        && snapshot.blocks[ selectionBlockRange.low ]?.type === "callout";
    const allowedTurnIntoTypes = useMemo(() =>
    {
        if (selectionBlockRange === undefined)
        {
            return new Set<EditorBlock["type"]>();
        }

        const selectedBlocks = snapshot.blocks.slice(
            selectionBlockRange.low, selectionBlockRange.high + 1
        );
        return new Set<EditorBlock["type"]>(editorTurnIntoTypes.filter(
            (type: EditorBlock["type"]) => selectedBlocks.length > 0
                && selectedBlocks.every((block: EditorBlock) => canConvertEditorBlock(block, type))
        ));
    }, [ selectionBlockRange, snapshot.blocks ]);
    const customButtonsById = useMemo(() =>
    {
        const map = new Map<string, MarkdownEditorCustomButton>();
        customButtons?.forEach((button: MarkdownEditorCustomButton) => map.set(button.id, button));
        return map;
    }, [ customButtons ]);
    const mainRowOrder = useMemo(() =>
    {
        const order: Array<string> = canColorSelection ? [ "color" ] : [ ];
        order.push(
            "insert", "format", "speech", "filePicker", "turnInto", "undo", "redo", "remove", "indent",
            "outdent", "moveUp", "moveDown"
        );
        if (canEditPageReference)
        {
            order.push("edit");
        }

        customButtons?.forEach((button: MarkdownEditorCustomButton) =>
        {
            const existingIndex = order.indexOf(button.id);
            if (existingIndex !== -1)
            {
                /* A duplicate id (including one colliding with a built-in) -- the later entry
                   wins by replacing the earlier position below. */
                order.splice(existingIndex, 1);
            }

            let insertAt = order.length;
            if (button.after !== undefined)
            {
                const anchor = order.indexOf(button.after);
                insertAt = anchor === -1 ? order.length : anchor + 1;
            }
            else if (button.before !== undefined)
            {
                const anchor = order.indexOf(button.before);
                insertAt = anchor === -1 ? order.length : anchor;
            }

            order.splice(insertAt, 0, button.id);
        });

        return order;
    }, [ canColorSelection, canEditPageReference, customButtons ]);
    const panelOpen = openPanel.kind !== "none";
    const activeCustomPanel = openPanel.kind === "custom"
        ? customButtonsById.get(openPanel.id)?.panel
        : undefined;
    const CustomPanelContent = activeCustomPanel?.render;
    const openPanelHeight = openPanel.kind === "insert" || openPanel.kind === "turnInto"
        ? BasicBlocksPanelHeight
        : openPanel.kind === "color"
            ? ColorPanelHeight
            : activeCustomPanel?.height ?? 0;
    const footerHeight = ToolbarHeight + openPanelHeight;
    const canMoveUp = selectionBlockRange !== undefined && selectionBlockRange.low > 0;
    const canMoveDown = selectionBlockRange !== undefined
        && selectionBlockRange.high < snapshot.blocks.length - 1;
    /* In Samsung multi-window, the IME can be displayed in the other window region. In that
       case it is visible to Android but does not consume any of this editor's bottom edge. When
       a positive keyboard inset is reported, bottomGap >= that inset means the same thing: the
       IME starts at or below the editor's bottom rather than covering app content. */
    const keyboardIsOutsideApp = keyboardState.isVisible
        && (keyboardState.height <= KeyboardGeometryTolerance
            || bottomGap + KeyboardGeometryTolerance >= keyboardState.height);
    const viewport = useAnimatedStyle(() => ({
        marginBottom: keyboardIsOutsideApp
            ? footerHeight
            : Math.max(0, -height.value - bottomGap * progress.value) + footerHeight
    }));

    useEffect(() =>
    {
        if (suppliedSnapshot !== undefined)
        {
            currentSnapshot.current = suppliedSnapshot;
        }
    }, [ suppliedSnapshot ]);

    const { onLayout: externalOnLayout, style, testID, ...nativeViewProps } = viewProps;

    const measureBottomGap = useCallback(() =>
    {
        root.current?.measureInWindow((_x: number, y: number, _width: number, canvasHeight: number) =>
        {
            const nextBottomGap = Math.max(0, windowHeight - y - canvasHeight);
            if (bottomGapRef.current !== nextBottomGap)
            {
                bottomGapRef.current = nextBottomGap;
                setBottomGap(nextBottomGap);
            }
        });
    }, [ windowHeight ]);

    const measureCanvas = useCallback((event: LayoutChangeEvent) =>
    {
        externalOnLayout?.(event);
        measureBottomGap();
    }, [ externalOnLayout, measureBottomGap ]);

    /* A split-screen resize can change the window geometry without producing another layout event
       for this view, so refresh the gap when the reported window height changes as well. */
    useEffect(() =>
    {
        measureBottomGap();
    }, [ measureBottomGap ]);

    const send = useCallback((
        action: EditorCommand["action"],
        extra?: Pick<EditorCommand,
            "level" | "color" | "icon" | "type" | "toggle" | "mark" | "columnCount" | "url"
            | "label" | "blockId"
            | "duration" | "waveform" | "mimeType" | "fileName" | "fileSize">
    ) =>
    {
        if (onCommand !== undefined)
        {
            onCommand(action, extra);
            return;
        }

        const next: EditorCommand =
            {
                action,
                epoch: currentSnapshot.current.epoch,
                id: ++sequence.current,
                ...extra
            };

        setInternalCommand(next);
    }, [ onCommand ]);

    const refocusEditor = useCallback(() => send("focus"), [ send ]);

    /* A panel intentionally dismisses the keyboard when it opens. If the user summons the
       keyboard again while that panel is still visible, return to the compact toolbar so the
       keyboard and the MAB panel never compete for the same bottom edge. Track the transition
       rather than the steady visible state so opening a panel while the keyboard is already up
       does not immediately close the panel again. */
    useEffect(() =>
    {
        const wasVisible = previousKeyboardVisibility.current;
        previousKeyboardVisibility.current = keyboardState.isVisible;

        if (!wasVisible && keyboardState.isVisible && panelOpen)
        {
            refocusAfterPanelClose.current = false;
            setOpenPanel(NoPanelOpen);
        }
    }, [ keyboardState.isVisible, panelOpen ]);

    useEffect(() =>
    {
        if (!refocusAfterPanelClose.current || row !== "format" || openPanel.kind !== "none")
        {
            return;
        }
        refocusAfterPanelClose.current = false;
        const focusTimeout = setTimeout(refocusEditor, 160);
        return () => clearTimeout(focusTimeout);
    }, [ openPanel.kind, refocusEditor, row ]);

    /* Panel content replaces the keyboard, so enforce dismissal after the panel has actually
       entered the rendered tree as well as at the initiating button press. This also covers
       panels opened by future state transitions and closes the focus/IME race on Android. */
    useEffect(() =>
    {
        if (panelOpen || mediaSheetVisible || audioSheetVisible)
        {
            send("dismiss");
        }
    }, [ audioSheetVisible, mediaSheetVisible, panelOpen, send ]);

    const receiveEdit = useCallback(({ nativeEvent }: { nativeEvent: EditorEvent }) =>
    {
        setSelectionAnchorBlockId(nativeEvent.anchor.blockId);
        setSelectionAnchorOffset(nativeEvent.anchor.offset);
        setSelectionFocusBlockId(nativeEvent.focus.blockId);
        setSelectionFocusOffset(nativeEvent.focus.offset);

        if (suppliedSnapshot === undefined && onEdit === undefined)
        {
            const previous = currentSnapshot.current;
            const next = AcceptEditorEvent(previous, nativeEvent);
            if (next !== previous)
            {
                currentSnapshot.current = next;
                setInternalSnapshot(next);

                /* A follow-up selection/focus event right after a history-restoring
                   `setSnapshot` reload still bumps the native revision counter, so it reaches
                   here as "accepted" even though nothing textual changed -- `AcceptEditorEvent`
                   reuses unchanged block references, so comparing block identity (not just the
                   wrapper object) tells a real edit from that housekeeping event. */
                const blocksChanged = next.blocks.length !== previous.blocks.length
                    || next.blocks.some(
                        (block: EditorBlock, index: number) => block !== previous.blocks[ index ]
                    );

                if (nativeEvent.source !== "replacement" && blocksChanged)
                {
                    undoStack.current.push(previous);
                    redoStack.current = [ ];
                    setCanUndo(true);
                    setCanRedo(false);
                }
            }
        }

        onEdit?.({ nativeEvent });
    }, [ onEdit, suppliedSnapshot ]);

    const handleContentSize = useCallback(({
        nativeEvent
    }: { nativeEvent: NativeContentSizeEvent }) =>
    {
        setContentHeight(nativeEvent.height);
    }, [ ]);
    const handlePageReferencePress = useCallback(({
        nativeEvent
    }: { nativeEvent: NativePageReferencePressEvent }) =>
    {
        if (onOpenPageReference !== undefined)
        {
            void onOpenPageReference(nativeEvent.url);
        }
        else
        {
            void openPageReferenceUrl(nativeEvent.url);
        }
    }, [ onOpenPageReference ]);
    const handleBlockActionsPress = useCallback(({
        nativeEvent
    }: { nativeEvent: NativeBlockActionsPressEvent }) =>
    {
        const selection: MarkdownEditorBlockActionsSelection =
            { blockId: nativeEvent.id, blockType: nativeEvent.type };
        send("dismiss");
        if (onBlockActions !== undefined)
        {
            void onBlockActions(selection);
            return;
        }
        setBlockActionsRequest(selection);
    }, [ onBlockActions, send ]);
    const handleCalloutActions = useCallback(() =>
    {
        if (!selectedCallout || selectionBlockRange === undefined)
        {
            return;
        }
        const block = snapshot.blocks[ selectionBlockRange.low ];
        if (block === undefined)
        {
            return;
        }
        const selection: MarkdownEditorBlockActionsSelection =
            { blockId: block.id, blockType: "callout" };
        send("dismiss");
        if (onBlockActions !== undefined)
        {
            void onBlockActions(selection);
            return;
        }
        setBlockActionsRequest(selection);
    }, [ onBlockActions, selectedCallout, selectionBlockRange, send, snapshot.blocks ]);
    const handleBlockActionsDismiss = useCallback(() =>
    {
        setBlockActionsRequest(undefined);
        send("focus");
    }, [ send ]);
    const handleBlockAction = useCallback((action: MarkdownEditorBlockAction) =>
    {
        const blockId = blockActionsRequest?.blockId;
        setBlockActionsRequest(undefined);
        if (blockId === undefined) { send("focus"); return; }
        switch (action)
        {
            case "insertAbove": send("insertAbove", { blockId }); break;
            case "insertBelow": send("insertBelow", { blockId }); break;
            case "duplicate": send("duplicateBlock", { blockId }); break;
            case "delete": send("deleteBlock", { blockId }); break;
        }
    }, [ blockActionsRequest, send ]);
    const handleReplaceImage = useCallback((blockId: string, url: string) =>
        send("replaceImage", { blockId, url }), [ send ]);
    const handleReplaceAudio = useCallback((action: MarkdownEditorAudioAction) =>
    {
        const blockId = blockActionsRequest?.blockId;
        if (blockId === undefined)
        {
            send("focus");
            return;
        }
        setBlockActionsRequest(undefined);
        setAudioReplacementBlockId(blockId);
        setAudioSheetInitialAction(action);
        setAudioSheetVisible(true);
        send("dismiss");
    }, [ blockActionsRequest, send ]);
    const handleCalloutColor = useCallback((color: MarkdownColor | undefined) =>
    {
        const blockId = blockActionsRequest?.blockId;
        setBlockActionsRequest(undefined);
        if (blockId === undefined)
        {
            send("focus");
            return;
        }
        send("color", { blockId, color });
    }, [ blockActionsRequest, send ]);
    const handleEditCalloutIcon = useCallback(() =>
    {
        const blockId = blockActionsRequest?.blockId;
        setBlockActionsRequest(undefined);
        if (blockId === undefined)
        {
            send("focus");
            return;
        }
        setEmojiSheetBlockId(blockId);
        setEmojiSheetVisible(true);
        send("dismiss");
    }, [ blockActionsRequest, send ]);
    const handleEmojiSheetDismiss = useCallback(() =>
    {
        setEmojiSheetVisible(false);
        setEmojiSheetBlockId(undefined);
        send("focus");
    }, [ send ]);
    const handleCalloutIcon = useCallback((icon: string) =>
    {
        const blockId = emojiSheetBlockId;
        setEmojiSheetVisible(false);
        setEmojiSheetBlockId(undefined);
        if (blockId === undefined)
        {
            send("focus");
            return;
        }
        /* Selection also dismisses the picker, which queues a focus command. Let that command
           render first so the icon update remains the final command in this interaction. */
        setTimeout(() => send("icon", { blockId, icon }), 0);
    }, [ emojiSheetBlockId, send ]);

    const handleMode = useCallback((nextRow: ToolbarRow) => () =>
    {
        /* An open MAB panel means the native editor was explicitly dismissed. Returning to the
           style MAB must restore the editing connection so the keyboard can be summoned again. */
        const shouldRefocusEditor = nextRow === "format" && openPanel.kind !== "none";
        refocusAfterPanelClose.current = shouldRefocusEditor;
        setRow(nextRow);
        setOpenPanel(NoPanelOpen);
    }, [ openPanel.kind ]);
    const handleInsert = useCallback(() =>
    {
        setOpenPanel({ kind: "insert" });
        send("dismiss");
    }, [ send ]);
    const handleInsertMedia = useCallback(() =>
    {
        const override = onInsertMedia;
        if (override !== undefined)
        {
            send("dismiss");
            void override();
            return;
        }

        setMediaSheetVisible(true);
        send("dismiss");
    }, [ onInsertMedia, send ]);
    const handleInsertFile = useCallback(async () =>
    {
        setOpenPanel(NoPanelOpen);
        send("dismiss");
        if (onFilePicker !== undefined)
        {
            await onFilePicker();
            return;
        }

        const result = await DocumentPicker.getDocumentAsync({
            copyToCacheDirectory: true,
            multiple: false,
            type: "*/*"
        });
        const pickedAsset = result.canceled ? undefined : result.assets?.[ 0 ];
        const selection: MarkdownEditorFileSelection = {
            asset: pickedAsset === undefined
                ? undefined
                : {
                    fileName: pickedAsset.name,
                    fileSize: pickedAsset.size,
                    mimeType: pickedAsset.mimeType,
                    uri: pickedAsset.uri
                },
            canceled: result.canceled
        };
        if (selection.asset !== undefined)
        {
            send("insertFile", {
                fileName: selection.asset.fileName,
                fileSize: selection.asset.fileSize,
                mimeType: selection.asset.mimeType,
                url: selection.asset.uri
            });
        }
        await onFileSelected?.(selection);
    }, [ onFilePicker, onFileSelected, send ]);
    const handleInsertAudio = useCallback(() =>
    {
        if (onInsertAudio !== undefined)
        {
            send("dismiss");
            void onInsertAudio();
            return;
        }
        setAudioReplacementBlockId(undefined);
        setAudioSheetInitialAction(undefined);
        setAudioSheetVisible(true);
        send("dismiss");
    }, [ onInsertAudio, send ]);
    const handleMediaSheetDismiss = useCallback(() =>
    {
        setMediaSheetVisible(false);
        send("focus");
    }, [ send ]);
    const handleAudioSheetDismiss = useCallback(() =>
    {
        setAudioSheetVisible(false);
        setAudioSheetInitialAction(undefined);
        setAudioReplacementBlockId(undefined);
        send("focus");
    }, [ send ]);
    const handleLinkResult = useCallback((result: MarkdownEditorLinkResult | null | undefined) =>
    {
        setLinkSheetVisible(false);
        setLinkRequest(undefined);
        if (result === null || result === undefined || result.url.trim().length === 0)
        {
            send("focus");
            return;
        }
        send("link", { label: result.label, url: result.url });
    }, [ send ]);
    const handleLink = useCallback(() =>
    {
        if (!canLinkSelection || selectionBlockRange === undefined
            || selectionAnchorBlockId === undefined || selectionFocusBlockId === undefined
            || selectionAnchorOffset === undefined || selectionFocusOffset === undefined)
        {
            return;
        }
        const anchorIndex = snapshot.blocks.findIndex(
            (block: EditorBlock) => block.id === selectionAnchorBlockId
        );
        const focusIndex = snapshot.blocks.findIndex(
            (block: EditorBlock) => block.id === selectionFocusBlockId
        );
        if (anchorIndex === -1 || focusIndex === -1) {return;}
        const low = Math.min(anchorIndex, focusIndex);
        const high = Math.max(anchorIndex, focusIndex);
        const anchorIsFirst = anchorIndex < focusIndex
            || (anchorIndex === focusIndex && selectionAnchorOffset <= selectionFocusOffset);
        let startOffset = anchorIsFirst ? selectionAnchorOffset : selectionFocusOffset;
        let endOffset = anchorIsFirst ? selectionFocusOffset : selectionAnchorOffset;
        if (startOffset === endOffset && low === high)
        {
            const text = snapshot.blocks[ low ]?.text ?? "";
            let start = startOffset;
            let end = endOffset;
            while (start > 0 && !/\s/.test(text[ start - 1 ] ?? "")) {start -= 1;}
            while (end < text.length && !/\s/.test(text[ end ] ?? "")) {end += 1;}
            startOffset = start;
            endOffset = end;
        }
        const label = snapshot.blocks.slice(low, high + 1).map((block: EditorBlock, index: number) =>
        {
            const start = index === 0 ? startOffset : 0;
            const end = index === high - low ? endOffset : block.text.length;
            return block.text.slice(start, end);
        }).join("\n");
        const urls = new Set<string>();
        snapshot.blocks.slice(low, high + 1).forEach((block: EditorBlock, index: number) =>
        {
            const start = index === 0 ? startOffset : 0;
            const end = index === high - low ? endOffset : block.text.length;
            block.marks?.forEach((mark: EditorTextMark) =>
            {
                if (mark.kind === "link" && mark.url !== undefined
                    && mark.start < end && mark.end > start)
                {
                    urls.add(mark.url);
                }
            });
        });
        const request: MarkdownEditorLinkSelection =
            {
                anchor: {
                    blockId: selectionAnchorBlockId,
                    field: "rich_text",
                    offset: selectionAnchorOffset
                },
                focus: {
                    blockId: selectionFocusBlockId,
                    field: "rich_text",
                    offset: selectionFocusOffset
                },
                label,
                ...(urls.size === 1 ? { url: [ ...urls ][ 0 ] } : { })
            };
        send("dismiss");
        setOpenPanel(NoPanelOpen);
        if (onRequestLink !== undefined)
        {
            void Promise.resolve(onRequestLink(request))
                .then(handleLinkResult)
                .catch(() => handleLinkResult(undefined));
        }
        else
        {
            setLinkRequest(request);
            setLinkSheetVisible(true);
        }
    }, [
        canLinkSelection,
        handleLinkResult,
        onRequestLink,
        selectionAnchorBlockId,
        selectionAnchorOffset,
        selectionBlockRange,
        selectionFocusBlockId,
        selectionFocusOffset,
        send,
        snapshot.blocks
    ]);
    const closePanel = useCallback(() =>
    {
        setOpenPanel(NoPanelOpen);
        send("focus");
    }, [ send ]);
    const handleUndo = useCallback(() =>
    {
        const previous = undoStack.current.pop();
        if (previous === undefined) {return;}

        redoStack.current.push(currentSnapshot.current);
        const restored: EditorSnapshot = { ...previous, epoch: currentSnapshot.current.epoch + 1 };
        currentSnapshot.current = restored;
        setInternalSnapshot(restored);
        setCanUndo(undoStack.current.length > 0);
        setCanRedo(true);
    }, [ ]);
    const handleRedo = useCallback(() =>
    {
        const next = redoStack.current.pop();
        if (next === undefined) {return;}

        undoStack.current.push(currentSnapshot.current);
        const restored: EditorSnapshot = { ...next, epoch: currentSnapshot.current.epoch + 1 };
        currentSnapshot.current = restored;
        setInternalSnapshot(restored);
        setCanRedo(redoStack.current.length > 0);
        setCanUndo(true);
    }, [ ]);
    const handleMoveUp = useCallback(() => send("moveBlockUp"), [ send ]);
    const handleMoveDown = useCallback(() => send("moveBlockDown"), [ send ]);
    const handleRemove = useCallback(() => send("remove"), [ send ]);
    const handleIndent = useCallback(() => send("indent"), [ send ]);
    const handleOutdent = useCallback(() => send("outdent"), [ send ]);
    const handleTurnIntoPanel = useCallback(() =>
    {
        setOpenPanel({ kind: "turnInto" });
        send("dismiss");
    }, [ send ]);
    const handleTurnInto = useCallback((type: EditorBlock["type"]) => () =>
    {
        /* Turning a block into another type ends the MAB interaction. Close the panel before
           dispatching the native command so the toolbar immediately returns to its compact
           keyboard-adjacent state; the native transform requests the IME again. */
        setOpenPanel(NoPanelOpen);
        send("turnInto", { type });
    }, [ send ]);
    const handleColor = useCallback(() =>
    {
        if (!canColorSelection) {return;}
        setOpenPanel({ kind: "color" });
        send("dismiss");
    }, [ canColorSelection, send ]);
    const handleFormat = useCallback((mark: EditorTextMarkKind) => () =>
        send("format", { mark }), [ send ]);
    const handleEraseFormatting = useCallback(() => send("clearFormat"), [ send ]);
    const handleCustomPanelOpen = useCallback((id: string) => () =>
    {
        setOpenPanel({ id, kind: "custom" });
        send("dismiss");
    }, [ send ]);
    const handleSplit = useCallback(() => send("split"), [ send ]);
    const handleBulletedList = useCallback(() => send("bulletedList"), [ send ]);
    const handleNumberedList = useCallback(() => send("numberedList"), [ send ]);
    const handleUnavailableInsert = useCallback(() => { }, [ ]);
    const handleHeading1 = useCallback(
        () => send("heading", { level: 1 }), [ send ]
    );
    const handleHeading2 = useCallback(
        () => send("heading", { level: 2 }), [ send ]
    );
    const handleHeading3 = useCallback(
        () => send("heading", { level: 3 }), [ send ]
    );
    const handleHeading4 = useCallback(
        () => send("heading", { level: 4 }), [ send ]
    );
    const handleDivider = useCallback(() => send("divider"), [ send ]);
    const handleTableOfContents = useCallback(() => send("tableOfContents"), [ send ]);
    const handleColumns = useCallback((columnCount: EditorColumnCount) => () =>
        send("columns", { columnCount }), [ send ]);
    const handleToDo = useCallback(() => send("toDo"), [ send ]);
    const handleCallout = useCallback(() => send("callout"), [ send ]);
    const handleQuote = useCallback(() => send("quote"), [ send ]);
    const handleCreatePageReference = useCallback(() =>
    {
        if (onCreatePageReference === undefined
            || selectionAnchorBlockId === undefined
            || selectionFocusBlockId === undefined
            || selectionAnchorOffset === undefined
            || selectionFocusOffset === undefined)
        {
            return;
        }
        setOpenPanel(NoPanelOpen);
        void onCreatePageReference({
            anchor: {
                blockId: selectionAnchorBlockId,
                field: "rich_text",
                offset: selectionAnchorOffset
            },
            focus: {
                blockId: selectionFocusBlockId,
                field: "rich_text",
                offset: selectionFocusOffset
            }
        });
    }, [
        onCreatePageReference,
        selectionAnchorBlockId,
        selectionAnchorOffset,
        selectionFocusBlockId,
        selectionFocusOffset
    ]);
    const handleEditPageReference = useCallback(() =>
    {
        if (selectedPageReference !== undefined)
        {
            void onEditPageReference?.(selectedPageReference);
        }
    }, [ onEditPageReference, selectedPageReference ]);
    const handleToggleHeading1 = useCallback(
        () => send("heading", { level: 1, toggle: true }), [ send ]
    );
    const handleToggleHeading2 = useCallback(
        () => send("heading", { level: 2, toggle: true }), [ send ]
    );
    const handleToggleHeading3 = useCallback(
        () => send("heading", { level: 3, toggle: true }), [ send ]
    );
    const handleToggleHeading4 = useCallback(
        () => send("heading", { level: 4, toggle: true }), [ send ]
    );
    const handleMediaSelected = useCallback(async (selection: MarkdownEditorMediaSelection) =>
    {
        if (!selection.canceled && selection.assets !== undefined)
        {
            const mediaAsset = selection.assets.find((asset: MarkdownEditorMediaAsset) =>
            {
                const type = asset.type?.toLowerCase();
                const mimeType = asset.mimeType?.toLowerCase();
                const isImage = type === "image" || mimeType?.startsWith("image/") === true;
                const isVideo = type === "video" || mimeType?.startsWith("video/") === true;
                const hasKnownMediaType = isImage || isVideo;
                return selection.action === "video" ? isVideo || !hasKnownMediaType
                    : selection.action === "picture" ? isImage || !hasKnownMediaType : hasKnownMediaType;
            });
            if (mediaAsset !== undefined)
            {
                const isVideo = selection.action === "video"
                    || mediaAsset.type?.toLowerCase() === "video"
                    || mediaAsset.mimeType?.toLowerCase().startsWith("video/") === true;
                send(isVideo ? "insertVideo" : "insertImage", { url: mediaAsset.uri });
            }
        }
        await onMediaSelected?.(selection);
    }, [ onMediaSelected, send ]);
    const handleAudioSelected = useCallback(async (selection: MarkdownEditorAudioSelection) =>
    {
        if (!selection.canceled && selection.error === undefined && selection.asset !== undefined)
        {
            const extra = {
                duration: selection.asset.duration,
                fileName: selection.asset.fileName,
                fileSize: selection.asset.fileSize,
                mimeType: selection.asset.mimeType,
                url: selection.asset.uri,
                waveform: selection.asset.waveform
            };
            if (audioReplacementBlockId !== undefined)
            {
                send("replaceAudio", { ...extra, blockId: audioReplacementBlockId });
            }
            else
            {
                send("insertAudio", extra);
            }
        }
        await onAudioSelected?.(selection);
    }, [ audioReplacementBlockId, onAudioSelected, send ]);
    const handleSelectColor = useCallback(
        (color: MarkdownColor | undefined) => () => send("color", { color }), [ send ]
    );
    const handleCopy = useCallback(() => send("copy"), [ send ]);
    const handleCut = useCallback(() => send("cut"), [ send ]);
    const handlePaste = useCallback(() => send("paste"), [ send ]);
    const handleDismiss = useCallback(() => send("dismiss"), [ send ]);

    const handleLayout = useMemo(() => [ styles.root, style ], [ style ]);
    const stickyViewOffset = useMemo(() => ({ opened: bottomGap }), [ bottomGap ]);
    const stickyViewStyle = useMemo(
        () => [
            styles.footer,
            keyboardIsOutsideApp ? styles.floatingFooter : undefined,
            { backgroundColor: background }
        ],
        [ background, keyboardIsOutsideApp ]
    );
    const surfaceStyle = useMemo(() => [ styles.surface, viewport ], [ viewport ]);
    const panelStyle = useMemo(
        () => [ styles.panel, { backgroundColor: panelBackground } ],
        [ panelBackground ]
    );
    const colorPanelStyle = useMemo(
        () => [ styles.panel, styles.colorPanel, { backgroundColor: panelBackground } ],
        [ panelBackground ]
    );
    const panelTitleStyle = useMemo(() => [ styles.title, { color: iconColor } ], [ iconColor ]);
    const colorLabelStyle = useMemo(() => [ styles.colorLabel, { color: iconColor } ], [ iconColor ]);
    const customPanelStyle = useMemo(
        () => activeCustomPanel === undefined
            ? undefined
            : [ styles.panel, { backgroundColor: panelBackground, height: activeCustomPanel.height } ],
        [ activeCustomPanel, panelBackground ]
    );
    const trailingButtonStyle = useMemo(
        () => [ styles.trailingButton, { borderLeftColor: dividerColor } ],
        [ dividerColor ]
    );
    const pageStyle = useMemo(
        () => [ styles.page, { maxWidth: pageMaxWidth, paddingHorizontal: pagePaddingHorizontal } ],
        [ pageMaxWidth, pagePaddingHorizontal ]
    );
    /* `flex: 1` alone (styles.editor) still fills the viewport for a short document -- tapping
       the empty space below the last block should still focus it, as before. `minHeight` adds a
       floor `flex: 1` alone can't express: once content (e.g. a tall image) truly exceeds the
       viewport, this floor forces the page past it instead of being clipped to it, which is what
       gives the wrapping ScrollView something taller than the viewport to actually scroll. */
    const editorStyle = useMemo(
        () => contentHeight === undefined ? styles.editor : [ styles.editor, { minHeight: contentHeight } ],
        [ contentHeight ]
    );
    const scrollFadeLayerStyles = useMemo(
        () => Array.from({ length: ScrollFadeSteps }, (_unused: unknown, index: number) =>
        {
            const alpha = (index / (ScrollFadeSteps - 1)) * 0.92;
            return { backgroundColor: `rgba(${backgroundRgb}, ${alpha})`, flex: 1 };
        }),
        [ backgroundRgb ]
    );
    const mediaLabels = useMemo(() => ({
        captureVideo: t("mediaSheet.captureVideo"),
        openGallery: t("mediaSheet.openGallery"),
        takePicture: t("mediaSheet.takePicture"),
        title: t("mediaSheet.title")
    }), [ t ]);
    /* This title is intentionally coupled to callout blocks. The picker is only used for
       callouts for now, so a generic icon title would imply support we do not expose yet. */
    const emojiLabels = useMemo(() => ({
        common: t("emojiSheet.common"),
        filter: t("emojiSheet.filter"),
        title: t("emojiSheet.title")
    }), [ t ]);
    const audioLabels = useMemo(() => ({
        cancel: t("audioSheet.cancel"),
        chooseFile: t("audioSheet.chooseFile"),
        confirm: t("audioSheet.confirm"),
        error: t("audioSheet.error"),
        noAudio: t("audioSheet.noAudio"),
        pause: t("audioSheet.pause"),
        permissionDenied: t("audioSheet.permissionDenied"),
        play: t("audioSheet.play"),
        preparing: t("audioSheet.preparing"),
        preview: t("audioSheet.preview"),
        record: t("audioSheet.record"),
        recording: t("audioSheet.recording"),
        replace: t("audioSheet.replace"),
        start: t("audioSheet.start"),
        stop: t("audioSheet.stop"),
        title: t("audioSheet.title")
    }), [ t ]);
    const linkLabels = useMemo(() => ({
        apply: t("linkSheet.apply"),
        cancel: t("linkSheet.cancel"),
        label: t("linkSheet.label"),
        title: t("linkSheet.title"),
        url: t("linkSheet.url")
    }), [ t ]);
    const actionsLabels = useMemo(() => ({
        background: t("actionsSheet.background"),
        chooseAudio: t("audioSheet.chooseFile"),
        chooseColor: t("actionsSheet.chooseColor"),
        color: t("actionsSheet.color"),
        defaultColor: t("actionsSheet.defaultColor"),
        delete: t("actionsSheet.delete"),
        duplicate: t("actionsSheet.duplicate"),
        editIcon: t("actionsSheet.editIcon"),
        insertAbove: t("actionsSheet.insertAbove"),
        insertBelow: t("actionsSheet.insertBelow"),
        /* Reuses the insert-media sheet's own labels -- replacing an image performs the exact
           same gallery/camera pick as inserting one. */
        openGallery: t("mediaSheet.openGallery"),
        recordAudio: t("audioSheet.record"),
        takePicture: t("mediaSheet.takePicture"),
        text: t("actionsSheet.text"),
        title: t("actionsSheet.title")
    }), [ t ]);
    const blockActionsName = blockActionsRequest === undefined
        ? undefined
        : t(editorBlockNameMessageIds[ blockActionsRequest.blockType ]);
    return (
        <View
            { ...nativeViewProps }
            onLayout={ measureCanvas }
            ref={ root }
            style={ handleLayout }>
            <Animated.View style={ surfaceStyle }>
                <ScrollView
                    contentContainerStyle={ styles.pageScrollContent }
                    keyboardShouldPersistTaps="handled"
                    style={ styles.pageScroll }>
                    <View style={ pageStyle }>
                        <NativeEditor
                            { ...nativeViewProps }
                            command={ command }
                            dark={ dark }
                            emptyTogglePlaceholder={ suppliedEmptyTogglePlaceholder }
                            imageMaxWidth={ imageMaxWidth }
                            onBlockActionsPress={ handleBlockActionsPress }
                            onContentSize={ handleContentSize }
                            onEdit={ receiveEdit }
                            onPageReferencePress={ handlePageReferencePress }
                            pageReferenceFallbackIcon={ suppliedPageReferenceFallbackIcon
                                ?? (components?.linkToPage !== undefined ? "↗" : undefined) }
                            snapshot={ snapshot }
                            style={ editorStyle }
                            testID={ testID }
                        />
                    </View>
                </ScrollView>
            </Animated.View>
            <KeyboardStickyView
                enabled={ !keyboardIsOutsideApp }
                offset={ stickyViewOffset }
                style={ stickyViewStyle }>
                <View style={ styles.toolbar }>
                    <View style={ styles.scrollArea }>
                        <ScrollView
                            horizontal
                            keyboardShouldPersistTaps="always"
                            showsHorizontalScrollIndicator={ false }>
                            {
                                row === "format" ? <>
                                    <ActionButton button="back"
                                        color={ iconColor }
                                        components={ components }
                                        label={ t("toolbar.back") }
                                        onPress={ handleMode("main") } />
                                    <ActionButton button="bold"
                                        color={ iconColor }
                                        components={ components }
                                        disabled={ !canFormatSelection }
                                        label={ t("toolbar.bold") }
                                        onPress={ handleFormat("bold") } />
                                    <ActionButton button="italic"
                                        color={ iconColor }
                                        components={ components }
                                        disabled={ !canFormatSelection }
                                        label={ t("toolbar.italic") }
                                        onPress={ handleFormat("italic") } />
                                    <ActionButton button="strikethrough"
                                        color={ iconColor }
                                        components={ components }
                                        disabled={ !canFormatSelection }
                                        label={ t("toolbar.strikethrough") }
                                        onPress={ handleFormat("strikethrough") } />
                                    <ActionButton button="underline"
                                        color={ iconColor }
                                        components={ components }
                                        disabled={ !canFormatSelection }
                                        label={ t("toolbar.underline") }
                                        onPress={ handleFormat("underline") } />
                                    <ActionButton button="code"
                                        color={ iconColor }
                                        components={ components }
                                        disabled={ !canFormatSelection }
                                        label={ t("toolbar.code") }
                                        onPress={ handleFormat("code") } />
                                    <ActionButton button="link"
                                        color={ iconColor }
                                        components={ components }
                                        disabled={ !canLinkSelection }
                                        label={ t("toolbar.link") }
                                        onPress={ handleLink } />
                                    <ActionButton button="eraseFormatting"
                                        color={ iconColor }
                                        components={ components }
                                        disabled={ !canFormatSelection }
                                        label={ t("toolbar.eraseFormatting") }
                                        onPress={ handleEraseFormatting } />
                                </> : mainRowOrder.map((id: string) =>
                                {
                                    switch (id)
                                    {
                                        case "color": return <ActionButton
                                            active={ openPanel.kind === "color" }
                                            activeBackground={ activeBackground }
                                            button="color"
                                            color={ iconColor }
                                            components={ components }
                                            key="color"
                                            label={ t("toolbar.color") }
                                            onPress={ handleColor } />;
                                        case "insert": return <ActionButton
                                            active={ openPanel.kind === "insert" }
                                            activeBackground={ activeBackground }
                                            button="insert"
                                            color={ iconColor }
                                            components={ components }
                                            key="insert"
                                            label={ t("toolbar.insert") }
                                            onPress={ handleInsert } />;
                                        case "format": return <ActionButton button="format"
                                            color={ iconColor }
                                            components={ components }
                                            key="format"
                                            label={ t("toolbar.format") }
                                            onPress={ handleMode("format") } />;
                                        case "speech": return <ActionButton button="speech"
                                            color={ iconColor }
                                            components={ components }
                                            key="speech"
                                            label={ t("toolbar.speech") }
                                            onPress={ handleInsertAudio } />;
                                        case "filePicker": return <ActionButton button="gallery"
                                            color={ iconColor }
                                            components={ components }
                                            key="filePicker"
                                            label={ t("toolbar.filePicker") }
                                            onPress={ handleInsertMedia } />;
                                        case "turnInto": return <ActionButton
                                            active={ openPanel.kind === "turnInto" }
                                            activeBackground={ activeBackground }
                                            button="turnInto"
                                            color={ iconColor }
                                            components={ components }
                                            key="turnInto"
                                            label={ t("toolbar.turnInto") }
                                            onPress={ handleTurnIntoPanel } />;
                                        case "undo": return <ActionButton button="undo"
                                            color={ iconColor }
                                            components={ components }
                                            disabled={ !canUndo }
                                            key="undo"
                                            label={ t("toolbar.undo") }
                                            onPress={ handleUndo } />;
                                        /* Only occupies a slot once an undo has made a redo available. */
                                        case "redo": return canRedo
                                            ? <ActionButton button="redo"
                                                color={ iconColor }
                                                components={ components }
                                                key="redo"
                                                label={ t("toolbar.redo") }
                                                onPress={ handleRedo } />
                                            : null;
                                        case "remove": return <ActionButton button="remove"
                                            color={ iconColor }
                                            components={ components }
                                            key="remove"
                                            label={ t("toolbar.remove") }
                                            onPress={ handleRemove } />;
                                        case "indent": return <ActionButton button="indent"
                                            color={ iconColor }
                                            components={ components }
                                            disabled={ !canIndent }
                                            key="indent"
                                            label={ t("toolbar.indent") }
                                            onPress={ handleIndent } />;
                                        case "outdent": return <ActionButton button="outdent"
                                            color={ iconColor }
                                            components={ components }
                                            disabled={ !canOutdent }
                                            key="outdent"
                                            label={ t("toolbar.outdent") }
                                            onPress={ handleOutdent } />;
                                        /* Only occupies a slot once the selection identifies
                                           block(s) that aren't already at the top of the document. */
                                        case "moveUp": return canMoveUp
                                            ? <ActionButton button="moveUp"
                                                color={ iconColor }
                                                components={ components }
                                                key="moveUp"
                                                label={ t("toolbar.moveUp") }
                                                onPress={ handleMoveUp } />
                                            : null;
                                        /* Only occupies a slot once the selection identifies
                                           block(s) that aren't already at the bottom of the document. */
                                        case "moveDown": return canMoveDown
                                            ? <ActionButton button="moveDown"
                                                color={ iconColor }
                                                components={ components }
                                                key="moveDown"
                                                label={ t("toolbar.moveDown") }
                                                onPress={ handleMoveDown } />
                                            : null;
                                        case "copy": return <ActionButton button="copy"
                                            color={ iconColor }
                                            components={ components }
                                            key="copy"
                                            label={ t("toolbar.copy") }
                                            onPress={ handleCopy } />;
                                        case "cut": return <ActionButton button="cut"
                                            color={ iconColor }
                                            components={ components }
                                            key="cut"
                                            label={ t("toolbar.cut") }
                                            onPress={ handleCut } />;
                                        case "paste": return <ActionButton button="paste"
                                            color={ iconColor }
                                            components={ components }
                                            key="paste"
                                            label={ t("toolbar.paste") }
                                            onPress={ handlePaste } />;
                                        case "edit": return <ActionButton button="edit"
                                            color={ iconColor }
                                            components={ components }
                                            key="edit"
                                            label={ t("toolbar.edit") }
                                            onPress={ handleEditPageReference } />;
                                        default:
                                        {
                                            const custom = customButtonsById.get(id);
                                            if (custom === undefined)
                                            {
                                                return null;
                                            }

                                            const isActive = custom.panel !== undefined
                                                && openPanel.kind === "custom"
                                                && openPanel.id === custom.id;

                                            return <ActionButton
                                                active={ custom.panel === undefined ? undefined : isActive }
                                                activeBackground={ activeBackground }
                                                color={ iconColor }
                                                icon={ custom.icon }
                                                key={ custom.id }
                                                label={ custom.label }
                                                onPress={ custom.panel === undefined
                                                    ? custom.onPress
                                                    : handleCustomPanelOpen(custom.id) } />;
                                        }
                                    }
                                })
                            }
                        </ScrollView>
                        <View
                            pointerEvents="none"
                            style={ styles.scrollFade }>
                            {
                                scrollFadeLayerStyles.map((
                                    layerStyle: { backgroundColor: string; flex: number },
                                    index: number
                                ) => (
                                    <View
                                        key={ index }
                                        style={ layerStyle } />
                                ))
                            }
                        </View>
                    </View>
                    <View style={ trailingButtonStyle }>
                        {
                            panelOpen
                                ? <ActionButton button="close"
                                    color={ iconColor }
                                    components={ components }
                                    label={ t("toolbar.close") }
                                    onPress={ closePanel } />
                                : <ActionButton button="hideKeyboard"
                                    color={ iconColor }
                                    components={ components }
                                    label={ t("toolbar.hideKeyboard") }
                                    onPress={ handleDismiss } />
                        }
                        {
                            selectedCallout && <ActionButton
                                button="more"
                                color={ iconColor }
                                components={ components }
                                label={ t("actionsSheet.title") }
                                onPress={ handleCalloutActions } />
                        }
                    </View>
                </View>
                {
                    openPanel.kind === "insert" && <Animated.View entering={ FadeIn.duration(160) }
                        exiting={ FadeOut.duration(120) }
                        style={ panelStyle }>
                        <ScrollView contentContainerStyle={ styles.panelScrollContent }
                            keyboardShouldPersistTaps="always"
                            showsVerticalScrollIndicator={ false }
                            style={ styles.panelScroll }>
                            <Text accessibilityRole="header"
                                style={ panelTitleStyle }>{ t("insertPanel.title") }</Text>
                            <View style={ styles.blockGrid }>
                                <BlockOption background={ cardBackground }
                                    button="text"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.text") }
                                    labelColor={ iconColor }
                                    onPress={ handleSplit } />
                                <BlockOption background={ cardBackground }
                                    button="heading1"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.heading1") }
                                    labelColor={ iconColor }
                                    onPress={ handleHeading1 } />
                                <BlockOption background={ cardBackground }
                                    button="heading2"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.heading2") }
                                    labelColor={ iconColor }
                                    onPress={ handleHeading2 } />
                                <BlockOption background={ cardBackground }
                                    button="heading3"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.heading3") }
                                    labelColor={ iconColor }
                                    onPress={ handleHeading3 } />
                                <BlockOption background={ cardBackground }
                                    button="heading4"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.heading4") }
                                    labelColor={ iconColor }
                                    onPress={ handleHeading4 } />
                                <BlockOption background={ cardBackground }
                                    button="bulletedList"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.bulletedList") }
                                    labelColor={ iconColor }
                                    onPress={ handleBulletedList } />
                                <BlockOption background={ cardBackground }
                                    button="numberedList"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.numberedList") }
                                    labelColor={ iconColor }
                                    onPress={ handleNumberedList } />
                                <BlockOption background={ cardBackground }
                                    button="toDo"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.toDo") }
                                    labelColor={ iconColor }
                                    onPress={ handleToDo } />
                                <BlockOption background={ cardBackground }
                                    button="toggleList"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.toggleList") }
                                    labelColor={ iconColor }
                                    onPress={ handleUnavailableInsert } />
                                <BlockOption background={ cardBackground }
                                    button="callout"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.callout") }
                                    labelColor={ iconColor }
                                    onPress={ handleCallout } />
                                <BlockOption background={ cardBackground }
                                    button="quote"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.quote") }
                                    labelColor={ iconColor }
                                    onPress={ handleQuote } />
                                <BlockOption background={ cardBackground }
                                    button="table"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.table") }
                                    labelColor={ iconColor }
                                    onPress={ handleUnavailableInsert } />
                                <BlockOption background={ cardBackground }
                                    button="divider"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.divider") }
                                    labelColor={ iconColor }
                                    onPress={ handleDivider } />
                                <BlockOption background={ cardBackground }
                                    button="linkToPage"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.pageReference") }
                                    labelColor={ iconColor }
                                    onPress={ onCreatePageReference === undefined
                                        ? handleUnavailableInsert
                                        : handleCreatePageReference } />
                                { ([ 2, 3, 4, 5 ] as const).map((columnCount: EditorColumnCount) =>
                                    <BlockOption background={ cardBackground }
                                        button={ editorColumnButtons[ columnCount ] }
                                        color={ iconColor }
                                        components={ components }
                                        grid
                                        key={ columnCount }
                                        label={ columnLabels[ columnCount ] }
                                        labelColor={ iconColor }
                                        onPress={ handleColumns(columnCount) } />
                                ) }
                            </View>
                            <Text accessibilityRole="header"
                                style={ panelTitleStyle }>{ t("insertPanel.mediaTitle") }</Text>
                            <View style={ styles.blockGrid }>
                                <BlockOption background={ cardBackground }
                                    button="picture"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.image") }
                                    labelColor={ iconColor }
                                    onPress={ handleInsertMedia } />
                                <BlockOption background={ cardBackground }
                                    button="video"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.video") }
                                    labelColor={ iconColor }
                                    onPress={ handleInsertMedia } />
                                <BlockOption background={ cardBackground }
                                    button="speech"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.audio") }
                                    labelColor={ iconColor }
                                    onPress={ handleInsertAudio } />
                                <BlockOption background={ cardBackground }
                                    button="code"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.code") }
                                    labelColor={ iconColor }
                                    onPress={ handleUnavailableInsert } />
                                <BlockOption background={ cardBackground }
                                    button="filePicker"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.file") }
                                    labelColor={ iconColor }
                                    onPress={ handleInsertFile } />
                                <BlockOption background={ cardBackground }
                                    button="link"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.link") }
                                    labelColor={ iconColor }
                                    onPress={ handleUnavailableInsert } />
                            </View>
                            <Text accessibilityRole="header"
                                style={ panelTitleStyle }>{ t("insertPanel.advancedTitle") }</Text>
                            <View style={ styles.blockGrid }>
                                <BlockOption background={ cardBackground }
                                    button="tableOfContents"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.tableOfContents") }
                                    labelColor={ iconColor }
                                    onPress={ handleTableOfContents } />
                                <BlockOption background={ cardBackground }
                                    button="code"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.blockEquation") }
                                    labelColor={ iconColor }
                                    onPress={ handleUnavailableInsert } />
                                <BlockOption background={ cardBackground }
                                    button="copy"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.syncedBlock") }
                                    labelColor={ iconColor }
                                    onPress={ handleUnavailableInsert } />
                                <BlockOption background={ cardBackground }
                                    button="toggleHeading1"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.toggleHeading1") }
                                    labelColor={ iconColor }
                                    onPress={ handleToggleHeading1 } />
                                <BlockOption background={ cardBackground }
                                    button="toggleHeading2"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.toggleHeading2") }
                                    labelColor={ iconColor }
                                    onPress={ handleToggleHeading2 } />
                                <BlockOption background={ cardBackground }
                                    button="toggleHeading3"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.toggleHeading3") }
                                    labelColor={ iconColor }
                                    onPress={ handleToggleHeading3 } />
                                <BlockOption background={ cardBackground }
                                    button="toggleHeading4"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.toggleHeading4") }
                                    labelColor={ iconColor }
                                    onPress={ handleToggleHeading4 } />
                                <BlockOption background={ cardBackground }
                                    button="mermaid"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.mermaidDiagram") }
                                    labelColor={ iconColor }
                                    onPress={ handleUnavailableInsert } />
                            </View>
                        </ScrollView>
                        {/* <BlockOption background={ cardBackground }
                            button="returnToKeyboard"
                            color={ iconColor }
                            components={ components }
                            fullWidth
                            label={ t("insertPanel.returnToKeyboard") }
                            labelColor={ iconColor }
                            onPress={ closePanel } /> */}
                    </Animated.View>
                }
                {
                    openPanel.kind === "turnInto" && <Animated.View entering={ FadeIn.duration(160) }
                        exiting={ FadeOut.duration(120) }
                        style={ panelStyle }>
                        <Text accessibilityRole="header"
                            style={ panelTitleStyle }>{ t("turnIntoPanel.title") }</Text>
                        <View style={ styles.blockRow }>
                            <BlockOption background={ cardBackground }
                                button="text"
                                color={ iconColor }
                                components={ components }
                                disabled={ !allowedTurnIntoTypes.has("text") }
                                label={ t("insertPanel.text") }
                                labelColor={ iconColor }
                                onPress={ handleTurnInto("text") } />
                            <BlockOption background={ cardBackground }
                                button="heading1"
                                color={ iconColor }
                                components={ components }
                                disabled={ !allowedTurnIntoTypes.has("heading_1") }
                                label={ t("insertPanel.heading1") }
                                labelColor={ iconColor }
                                onPress={ handleTurnInto("heading_1") } />
                        </View>
                        <View style={ styles.blockRow }>
                            <BlockOption background={ cardBackground }
                                button="heading2"
                                color={ iconColor }
                                components={ components }
                                disabled={ !allowedTurnIntoTypes.has("heading_2") }
                                label={ t("insertPanel.heading2") }
                                labelColor={ iconColor }
                                onPress={ handleTurnInto("heading_2") } />
                            <BlockOption background={ cardBackground }
                                button="heading3"
                                color={ iconColor }
                                components={ components }
                                disabled={ !allowedTurnIntoTypes.has("heading_3") }
                                label={ t("insertPanel.heading3") }
                                labelColor={ iconColor }
                                onPress={ handleTurnInto("heading_3") } />
                        </View>
                        <BlockOption background={ cardBackground }
                            button="heading4"
                            color={ iconColor }
                            components={ components }
                            disabled={ !allowedTurnIntoTypes.has("heading_4") }
                            fullWidth
                            label={ t("insertPanel.heading4") }
                            labelColor={ iconColor }
                            onPress={ handleTurnInto("heading_4") } />
                    </Animated.View>
                }
                {
                    openPanel.kind === "color" && <Animated.View entering={ FadeIn.duration(160) }
                        exiting={ FadeOut.duration(120) }
                        style={ colorPanelStyle }>
                        <ScrollView
                            contentContainerStyle={ styles.panelScrollContent }
                            keyboardShouldPersistTaps="always"
                            showsVerticalScrollIndicator={ false }>
                            <Text style={ colorLabelStyle }>{ t("colorPanel.foreground") }</Text>
                            <ColorOptionGrid
                                cardBackground={ cardBackground }
                                defaultLabel={ t("colorPanel.default") }
                                foreground={ foreground }
                                iconColor={ iconColor }
                                onSelect={ handleSelectColor }
                                options={ editorColorOptions.filter(
                                    (option: EditorColorOption) => !option.background
                                ) } />
                            <Text style={ colorLabelStyle }>
                                { t("colorPanel.background") }
                            </Text>
                            <ColorOptionGrid
                                cardBackground={ cardBackground }
                                defaultLabel={ t("colorPanel.default") }
                                foreground={ foreground }
                                iconColor={ iconColor }
                                onSelect={ handleSelectColor }
                                options={ editorColorOptions.filter(
                                    (option: EditorColorOption) => option.background
                                        || option.color === undefined
                                ) } />
                        </ScrollView>
                    </Animated.View>
                }
                {
                    CustomPanelContent !== undefined && <Animated.View entering={ FadeIn.duration(160) }
                        exiting={ FadeOut.duration(120) }
                        style={ customPanelStyle }>
                        <CustomPanelContent
                            cardBackground={ cardBackground }
                            close={ closePanel }
                            foreground={ foreground }
                            iconColor={ iconColor }
                            panelBackground={ panelBackground } />
                    </Animated.View>
                }
            </KeyboardStickyView>
            {
                mediaSheetVisible && <MediaBottomSheet
                    components={ components }
                    labels={ mediaLabels }
                    onDismiss={ handleMediaSheetDismiss }
                    onSelected={ handleMediaSelected } />
            }
            {
                emojiSheetVisible && <EmojiBottomSheet
                    dark={ dark }
                    labels={ emojiLabels }
                    onDismiss={ handleEmojiSheetDismiss }
                    onSelected={ handleCalloutIcon } />
            }
            {
                audioSheetVisible && <AudioBottomSheet
                    components={ components }
                    initialAction={ audioSheetInitialAction }
                    labels={ audioLabels }
                    onDismiss={ handleAudioSheetDismiss }
                    onSelected={ handleAudioSelected }
                    replacement={ audioReplacementBlockId !== undefined } />
            }
            {
                linkSheetVisible && linkRequest !== undefined && <LinkBottomSheet
                    dark={ dark }
                    initialLabel={ linkRequest.label }
                    initialUrl={ linkRequest.url }
                    labels={ linkLabels }
                    onDismiss={ () => handleLinkResult(undefined) }
                    onSubmit={ handleLinkResult } />
            }
            {
                blockActionsRequest !== undefined && blockActionsName !== undefined
                    && <ActionsBottomSheet
                        blockName={ blockActionsName }
                        components={ components }
                        dark={ dark }
                        labels={ actionsLabels }
                        onAction={ handleBlockAction }
                        onColor={ handleCalloutColor }
                        onDismiss={ handleBlockActionsDismiss }
                        onEditIcon={ handleEditCalloutIcon }
                        onReplaceAudio={ handleReplaceAudio }
                        onReplaceImage={ (url: string) =>
                            handleReplaceImage(blockActionsRequest.blockId, url) }
                        showCalloutActions={ blockActionsRequest.blockType === "callout" }
                        showInsertAbove={ blockActionsRequest.blockType !== "divider" }
                        showReplaceAudio={ blockActionsRequest.blockType === "audio" }
                        showReplaceImage={ blockActionsRequest.blockType === "image" } />
            }
        </View>
    );
}

const styles = StyleSheet.create({
    blockGrid:
    {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        /* About one-third of the 54px MAB button height separates each section. */
        marginBottom: 18
    },
    blockOption:
    {
        alignItems: "center",
        borderRadius: 5,
        flexDirection: "row",
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 16
    },
    blockOptionFull:
    {
        marginBottom: 8,
        width: "100%"
    },
    blockOptionGrid:
    {
        flexBasis: "48%",
        flexGrow: 0,
        flexShrink: 0
    },
    blockOptionHalf:
    {
        flex: 1
    },
    blockOptionLabel:
    {
        fontSize: 15,
        fontWeight: "500"
    },
    blockOptionSpacer:
    {
        flex: 1
    },
    blockRow:
    {
        flexDirection: "row",
        gap: 8,
        marginBottom: 8
    },
    button:
    {
        alignItems: "center",
        justifyContent: "center",
        minHeight: 40,
        minWidth: 40,
        paddingHorizontal: 9
    },
    buttonActive:
    {
        /* The scroll row stretches buttons to 48px; keep the selected fill at 40px. */
        marginVertical: 4
    },
    buttonDisabled:
    {
        opacity: 0.35
    },
    colorIcon:
    {
        alignItems: "center",
        borderRadius: 2,
        borderWidth: StyleSheet.hairlineWidth,
        height: 20,
        justifyContent: "center",
        width: 20
    },
    colorIconText:
    {
        fontSize: 16,
        fontWeight: "400",
        includeFontPadding: false,
        lineHeight: 16,
        textAlignVertical: "center"
    },
    colorLabel:
    {
        fontSize: 11,
        fontWeight: "600",
        marginBottom: 6,
        textTransform: "uppercase"
    },
    colorPanel:
    {
        height: ColorPanelHeight
    },
    colorRow:
    {
        marginBottom: 8
    },
    editor:
    {
        flex: 1,
        minHeight: 48
    },
    floatingFooter:
    {
        /* Keep the MAB clear of the app edge while retaining a long, touchable surface. */
        borderRadius: 24,
        borderTopWidth: 0,
        bottom: 8,
        elevation: 4,
        left: 12,
        overflow: "hidden",
        right: 12,
        shadowColor: "#000000",
        shadowOffset: { height: 2, width: 0 },
        shadowOpacity: 0.16,
        shadowRadius: 6
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
    page:
    {
        alignSelf: "center",
        flex: 1,
        width: "100%"
    },
    pageScroll:
    {
        flex: 1
    },
    pageScrollContent:
    {
        flexGrow: 1
    },
    panel:
    {
        height: BasicBlocksPanelHeight,
        paddingBottom: 12,
        paddingHorizontal: 12,
        paddingTop: 12
    },
    panelScroll:
    {
        flex: 1
    },
    panelScrollContent:
    {
        paddingBottom: 4
    },
    root:
    {
        flex: 1
    },
    scrollArea:
    {
        flex: 1
    },
    scrollFade:
    {
        bottom: 0,
        flexDirection: "row",
        position: "absolute",
        right: 0,
        top: 0,
        width: ScrollFadeWidth
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
        fontSize: 13,
        fontWeight: "600",
        marginBottom: 10
    },
    toolbar:
    {
        alignItems: "center",
        flexDirection: "row",
        height: ToolbarHeight,
        paddingLeft: 8
    },
    trailingButton:
    {
        alignItems: "center",
        /* Explicit on both sides (rather than relying on the toolbar's own padding for the
           right edge) so the button sits evenly centered between the divider and the edge. */
        borderLeftWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        paddingHorizontal: 6
    }
});
