/**
 * The "batteries included" editor: the native WYSIWYG surface plus its keyboard-adjacent toolbar,
 * panels, and sheets. Theme, strings, icons, toolbar and panel composition, and layout come from
 * the nearest `MarkdownProvider`; any of them passed as props override the provider for this
 * instance.
 *
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
    type EditorBlockActionScope,
    type EditorColumnCount,
    type EditorCommand,
    type EditorEvent,
    type EditorPoint,
    type EditorSnapshot,
    type EditorTableSelection,
    type EditorTextMark,
    type EditorTextMarkKind
} from "../../prototype.ts";
import Animated, { FadeIn, FadeOut, useAnimatedStyle } from "react-native-reanimated";
import { Circle, Svg } from "react-native-svg";
import {
    type EditorColorChoice,
    type MarkdownEditorButton,
    type MarkdownEditorConfig,
    type MarkdownEditorCustomButton,
    type MarkdownEditorCustomInsertItem,
    type MarkdownEditorFormatToolbarItem,
    type MarkdownEditorIconProps,
    type MarkdownEditorIcons,
    type MarkdownEditorInsertItem,
    type MarkdownEditorInsertSection,
    type MarkdownEditorMainToolbarItem,
    type MarkdownEditorTurnIntoItem,
    type ResolvedToolbarItem,
    defaultMarkdownEditorInsertSections,
    defaultMarkdownEditorToolbar,
    defaultMarkdownEditorTurnIntoItems,
    editorColorChoices,
    editorFontStyle,
    resolveToolbarItems
} from "./customization.ts";
import {
    KeyboardStickyView,
    useKeyboardState,
    useReanimatedKeyboardAnimation
} from "react-native-keyboard-controller";
import {
    type LayoutChangeEvent,
    Pressable,
    ScrollView,
    type StyleProp,
    StyleSheet,
    Text,
    type TextStyle,
    View,
    type ViewProps,
    useWindowDimensions
} from "react-native";
import type {
    MarkdownEditorBlockAction,
    MarkdownEditorTableAction
} from "./ActionsBottomSheet.tsx";
import { type MarkdownMessageId, defaultMarkdownMessages } from "../../provider/messages.ts";
import {
    MarkdownProvider,
    type MarkdownSharedConfig,
    useResolvedEditorConfig
} from "../../provider/MarkdownProvider.tsx";
import {
    type NativeBlockActionsPressEvent,
    type NativeContentSizeEvent,
    NativeEditor,
    type NativeEditorLabels,
    type NativePageReferencePressEvent,
    nativeEditorTheme
} from "../../NativeEditor.tsx";
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionsBottomSheet } from "./ActionsBottomSheet.tsx";
import { AudioBottomSheet } from "./AudioBottomSheet.tsx";
import type { ComponentType } from "react";
import { EmojiBottomSheet } from "./EmojiBottomSheet.tsx";
import { LinkBottomSheet } from "./LinkBottomSheet.tsx";
import type { MarkdownColor } from "../../document/types.ts";
import { MediaBottomSheet } from "./MediaBottomSheet.tsx";
import { openPageReferenceUrl } from "../../openPageReference.ts";
import { withAlpha } from "../../provider/theme.ts";

/** Dependency-free rendering of Lucide's Ellipsis icon for the built-in cell-actions button. */
function DefaultMoreIcon({ color, size, strokeWidth }: MarkdownEditorIconProps)
{
    return <Svg height={ size } viewBox="0 0 24 24" width={ size }>
        <Circle cx="5" cy="12" fill="none" r="1" stroke={ color } strokeWidth={ strokeWidth } />
        <Circle cx="12" cy="12" fill="none" r="1" stroke={ color } strokeWidth={ strokeWidth } />
        <Circle cx="19" cy="12" fill="none" r="1" stroke={ color } strokeWidth={ strokeWidth } />
    </Svg>;
}

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
    readonly scope?: EditorBlockActionScope;
    readonly selection?: EditorTableSelection;
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
 * Props for the "batteries included" editor.
 *
 * Configuration -- the color scheme, theme, localization, link opening, and every
 * {@link MarkdownEditorConfig} field -- defaults to the nearest `MarkdownProvider`'s; passing any of
 * it here overrides the provider for this editor only. The remaining props (document state and
 * callbacks about this document) exist only on the component.
 *
 * @since 1.0.0
 */
export interface MarkdownEditorProps extends ViewProps, MarkdownSharedConfig, MarkdownEditorConfig
{
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
            "level" | "color" | "colorTarget" | "icon" | "type" | "toggle" | "mark" | "columnCount" | "url"
            | "label" | "blockId"
            | "duration" | "waveform" | "mimeType" | "fileName" | "fileSize"
            | "selection" | "row" | "column">
    ) => void;

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

    /**
     * Replaces the built-in block-actions sheet -- opened by tapping a block that doesn't
     * otherwise receive the text cursor, currently the divider.
     */
    readonly onBlockActions?: (
        Selection: MarkdownEditorBlockActionsSelection
    ) => void | Promise<void>;
}

interface ActionButtonProps
{
    /** Highlights the button as the active toggle for an open panel (e.g. "Insert" while open). */
    readonly active?: boolean;
    readonly button?: MarkdownEditorButton;
    /** Dims the button and blocks presses, e.g. "Undo" with no history to undo. */
    readonly disabled?: boolean;
    /** Icon to use directly, taking precedence over the `button` icon lookup -- for custom buttons. */
    readonly icon?: ComponentType<MarkdownEditorIconProps>;
    readonly label: string;
    readonly onPress: () => void;
}

/** How a panel option card is sized within its section. */
type BlockOptionLayout = "full" | "grid" | "half";

interface BlockOptionProps
{
    readonly button?: MarkdownEditorButton;
    readonly disabled?: boolean;
    /** Icon to use directly, taking precedence over the `button` icon lookup -- for custom items. */
    readonly icon?: ComponentType<MarkdownEditorIconProps>;
    readonly label: string;
    readonly layout: BlockOptionLayout;
    readonly onPress: () => void;
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
 * importing `markdownEditorLucideIcons` from `react-native-notion-markdown/editor/ui/
 * lucide-icons` -- a separate module Metro only needs to resolve `lucide-react-native` for when
 * something actually imports it -- and passing it as `icons`.
 *
 * @since 1.0.0
 */
function getButtonIcon(
    button: MarkdownEditorButton | undefined,
    icons: MarkdownEditorIcons | undefined
): ComponentType<MarkdownEditorIconProps> | undefined
{
    if (button === undefined)
    {
        return undefined;
    }

    if (button === "more" && icons?.more === undefined)
    {
        return DefaultMoreIcon;
    }

    if (icons === undefined)
    {
        return undefined;
    }

    /* Keep a single `columns` override working for hosts that have not added the count-specific
       icons. */
    return icons[ button ]
        ?? (button === "columns2" || button === "columns3" || button === "columns4" || button === "columns5"
            ? icons.columns
            : undefined);
}

/**
 * Render an accessible toolbar action with a host-supplied icon, or a text fallback.
 *
 * @since 1.0.0
 */
function ActionButton({
    active,
    button,
    disabled,
    icon,
    label,
    onPress
}: ActionButtonProps)
{
    const { config, theme } = useResolvedEditorConfig();
    const { iconSize, iconStrokeWidth, toolbar } = theme.editor;
    const color = toolbar.icon;
    const Icon = icon ?? getButtonIcon(button, config.icons);
    const { fontFamily } = editorFontStyle(theme.editor);
    const textStyle = useMemo(() => ({ color, fontFamily }), [ color, fontFamily ]);
    /* Borderless ripple to match Material's icon-button treatment; ignored on iOS. */
    const ripple = useMemo(() => ({ borderless: true, color: withAlpha(color, 0.2) }), [ color ]);
    const accessibilityState = useMemo(
        () => ({ disabled: disabled === true, selected: active === true }),
        [ active, disabled ]
    );
    const buttonStyle = useMemo(
        () => [
            styles.button,
            active === true ? styles.buttonActive : undefined,
            active === true ? { backgroundColor: toolbar.activeBackground, borderRadius: 8 } : undefined,
            disabled === true ? styles.buttonDisabled : undefined
        ],
        [ active, disabled, toolbar.activeBackground ]
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
                : createElement(Icon, { color, size: iconSize, strokeWidth: iconStrokeWidth })
        }
    </Pressable>;
}

/**
 * Render a labeled option card for the insert and turn-into panels -- an icon-and-label card,
 * matching Notion's own insert-block picker rather than the toolbar's icon-only buttons.
 *
 * @since 1.0.0
 */
function BlockOption({
    button,
    disabled,
    icon,
    label,
    layout,
    onPress
}: BlockOptionProps)
{
    const { config, theme } = useResolvedEditorConfig();
    const { iconSize, iconStrokeWidth, panel, toolbar } = theme.editor;
    const color = toolbar.icon;
    const Icon = icon ?? getButtonIcon(button, config.icons);
    const ripple = useMemo(() => ({ color: withAlpha(color, 0.13) }), [ color ]);
    const cardStyle = useMemo(
        () => [
            styles.blockOption,
            layout === "full"
                ? styles.blockOptionFull
                : layout === "grid" ? styles.blockOptionGrid : styles.blockOptionHalf,
            disabled === true ? styles.buttonDisabled : undefined,
            { backgroundColor: panel.card }
        ],
        [ disabled, layout, panel.card ]
    );
    const { fontFamily } = editorFontStyle(theme.editor);
    const labelStyle = useMemo(
        () => [ styles.blockOptionLabel, { color: panel.label, fontFamily } ],
        [ fontFamily, panel.label ]
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
            Icon !== undefined && createElement(Icon, { color, size: iconSize, strokeWidth: iconStrokeWidth })
        }
        <Text style={ labelStyle }>{ label }</Text>
    </Pressable>;
}

const editorTurnIntoTypes: ReadonlyArray<EditorBlock["type"]> =
    [
        "text", "heading_1", "heading_2", "heading_3", "heading_4", "bulleted_list_item",
        "numbered_list_item", "to_do", "toggle", "code", "quote", "callout", "equation",
        "synced_block"
    ];
const editorTurnIntoTargetTypes: ReadonlyArray<EditorBlock["type"]> = [
    ...editorTurnIntoTypes, "column_list"
];

const editorColumnButtons: Readonly<Record<EditorColumnCount, Extract<MarkdownEditorButton,
    "columns2" | "columns3" | "columns4" | "columns5">>> =
    {
        2: "columns2",
        3: "columns3",
        4: "columns4",
        5: "columns5"
    };

/** Message id naming each block type, for the actions sheet's section-title label. */
const editorBlockNameMessageIds: Readonly<Record<EditorBlock["type"], MarkdownMessageId>> =
    {
        audio: "blockName.audio",
        bulleted_list_item: "blockName.bulletedListItem",
        callout: "blockName.callout",
        code: "blockName.code",
        column_list: "blockName.columnList",
        divider: "blockName.divider",
        equation: "blockName.equation",
        file: "blockName.file",
        heading_1: "blockName.heading1",
        heading_2: "blockName.heading2",
        heading_3: "blockName.heading3",
        heading_4: "blockName.heading4",
        image: "blockName.image",
        link_to_page: "blockName.linkToPage",
        numbered_list_item: "blockName.numberedListItem",
        quote: "blockName.quote",
        synced_block: "blockName.syncedBlock",
        table_of_contents: "blockName.tableOfContents",
        table: "blockName.table",
        text: "blockName.text",
        to_do: "blockName.toDo",
        toggle: "blockName.toggle",
        video: "blockName.video"
    };

/** Return whether an editor block supports conversion to the requested editor block type. */
function canConvertEditorBlock(block: EditorBlock, type: EditorBlock["type"]): boolean
{
    return editorTurnIntoTypes.includes(block.type) && editorTurnIntoTargetTypes.includes(type);
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

interface ColorChoiceProps
{
    readonly choice: EditorColorChoice;
    readonly onSelect: (color: MarkdownColor | undefined) => void;
}

/**
 * One choice in the color panel. The letter is intentionally used instead of an optional icon
 * dependency so the default batteries-included UI always has the same visual affordance.
 *
 * @since 1.0.0
 */
function ColorChoice({ choice, onSelect }: ColorChoiceProps)
{
    const { theme } = useResolvedEditorConfig();
    const { panel, toolbar } = theme.editor;
    const hueText = choice.hue === undefined ? undefined : theme.palette.text[ choice.hue ];
    const backgroundSwatch = choice.hue !== undefined && choice.background;
    const iconBackground = backgroundSwatch && choice.hue !== undefined
        ? theme.palette.background[ choice.hue ]
        : "transparent";
    const iconForeground = backgroundSwatch ? panel.foreground : (hueText ?? panel.foreground);
    const iconBorder = backgroundSwatch ? "transparent" : toolbar.icon;
    const { fontFamily } = editorFontStyle(theme.editor);
    const ripple = useMemo(
        () => ({ borderless: true, color: withAlpha(toolbar.icon, 0.2) }),
        [ toolbar.icon ]
    );
    const iconStyle = useMemo(() => [
        styles.colorIcon,
        { backgroundColor: iconBackground, borderColor: iconBorder }
    ], [ iconBackground, iconBorder ]);
    const iconTextStyle = useMemo(
        () => [ styles.colorIconText, { color: iconForeground, fontFamily } ],
        [ fontFamily, iconForeground ]
    );
    const labelStyle = useMemo(
        () => [ styles.blockOptionLabel, { color: panel.foreground, fontFamily } ],
        [ fontFamily, panel.foreground ]
    );
    const cardStyle = useMemo(
        () => [ styles.blockOption, styles.blockOptionHalf, { backgroundColor: panel.card } ],
        [ panel.card ]
    );
    const handlePress = useCallback(() => onSelect(choice.color), [ choice.color, onSelect ]);

    return <Pressable accessibilityLabel={ choice.label }
        accessibilityRole="button"
        android_ripple={ ripple }
        onPress={ handlePress }
        style={ cardStyle }>
        <View style={ iconStyle }>
            <Text style={ iconTextStyle }>A</Text>
        </View>
        <Text style={ labelStyle }>{ choice.label }</Text>
    </Pressable>;
}

/** Split items into rows of two for the panels' two-column layouts. */
function rowsOfTwo<Item>(items: ReadonlyArray<Item>): Array<Readonly<[Item, Item | undefined]>>
{
    const rows: Array<Readonly<[Item, Item | undefined]>> = [ ];
    for (let index = 0; index < items.length; index += 2)
    {
        const first = items[ index ];
        if (first !== undefined)
        {
            rows.push([ first, items[ index + 1 ] ]);
        }
    }

    return rows;
}

interface ColorOptionGridProps
{
    readonly choices: ReadonlyArray<EditorColorChoice>;
    readonly onSelect: (color: MarkdownColor | undefined) => void;
}

/** Render one two-column color-choice grid for a color-panel section. */
function ColorOptionGrid({ choices, onSelect }: ColorOptionGridProps)
{
    const rows = useMemo(() => rowsOfTwo(choices), [ choices ]);

    return <View>
        {
            rows.map((row: Readonly<[EditorColorChoice, EditorColorChoice | undefined]>) =>
                <View key={ row[ 0 ].color ?? "default" }
                    style={ styles.blockRow }>
                    <ColorChoice choice={ row[ 0 ] }
                        onSelect={ onSelect } />
                    {
                        row[ 1 ] === undefined
                            ? <View style={ styles.blockOptionSpacer } />
                            : <ColorChoice choice={ row[ 1 ] }
                                onSelect={ onSelect } />
                    }
                </View>)
        }
    </View>;
}

/** Return whether a string names a message in the catalog, rather than being literal text. */
function isMessageId(value: string): value is MarkdownMessageId
{
    return Object.prototype.hasOwnProperty.call(defaultMarkdownMessages, value);
}

const editorBlockColorTypes: ReadonlyArray<EditorBlock[ "type" ]> = [
    "text",
    "heading_1",
    "heading_2",
    "heading_3",
    "heading_4",
    "bulleted_list_item",
    "numbered_list_item",
    "to_do",
    "quote",
    "callout"
];

/** A built-in toolbar button, resolved against the editor's current state. */
interface ToolbarButtonModel
{
    readonly active?: boolean;
    readonly button: MarkdownEditorButton;
    readonly disabled?: boolean;
    readonly label: string;
    readonly onPress: () => void;

    /** `false` while the button's action doesn't apply, so it takes no slot. */
    readonly visible?: boolean;
}

/** Every built-in main-row button, by id. */
type MainToolbarModels = Readonly<Record<MarkdownEditorMainToolbarItem, ToolbarButtonModel>>;

/** Every built-in format-row button, by id. */
type FormatToolbarModels = Readonly<Record<MarkdownEditorFormatToolbarItem, ToolbarButtonModel>>;

/** One row of the turn-into panel: two options, or a final lone option. */
type TurnIntoRow = Readonly<[MarkdownEditorTurnIntoItem, MarkdownEditorTurnIntoItem | undefined]>;

/** A built-in insert-panel option, resolved against the editor's current state. */
interface InsertOptionModel
{
    readonly button: MarkdownEditorButton;
    readonly label: string;
    readonly onPress: () => void;
}

/** The ids of the built-in main-row buttons, used to resolve `toolbar.main`. */
const mainToolbarItems: ReadonlyArray<MarkdownEditorMainToolbarItem> =
    [
        "color", "insert", "format", "speech", "filePicker", "turnInto", "undo", "redo", "remove", "indent",
        "outdent", "moveUp", "moveDown", "copy", "cut", "paste", "edit"
    ];

/** The ids of the built-in format-row buttons, used to resolve `toolbar.format`. */
const formatToolbarItems: ReadonlyArray<MarkdownEditorFormatToolbarItem> =
    [ "bold", "italic", "strikethrough", "underline", "code", "link", "eraseFormatting" ];

/** The icon, label, and native command of each turn-into option. */
const turnIntoOptions: Readonly<Record<MarkdownEditorTurnIntoItem, {
    readonly button: MarkdownEditorButton;
    readonly message: MarkdownMessageId;
    readonly command: Pick<EditorCommand, "type" | "toggle" | "columnCount">;
}>> =
    {
        bulleted_list_item: {
            button: "bulletedList",
            command: { type: "bulleted_list_item" },
            message: "insertPanel.bulletedList"
        },
        callout: { button: "callout", command: { type: "callout" }, message: "insertPanel.callout" },
        code: { button: "code", command: { type: "code" }, message: "insertPanel.code" },
        columns2: {
            button: "columns2",
            command: { columnCount: 2, type: "column_list" },
            message: "insertPanel.columns2"
        },
        columns3: {
            button: "columns3",
            command: { columnCount: 3, type: "column_list" },
            message: "insertPanel.columns3"
        },
        columns4: {
            button: "columns4",
            command: { columnCount: 4, type: "column_list" },
            message: "insertPanel.columns4"
        },
        columns5: {
            button: "columns5",
            command: { columnCount: 5, type: "column_list" },
            message: "insertPanel.columns5"
        },
        equation: {
            button: "code", command: { type: "equation" }, message: "insertPanel.blockEquation"
        },
        heading_1: {
            button: "heading1", command: { type: "heading_1" }, message: "insertPanel.heading1"
        },
        heading_2: {
            button: "heading2", command: { type: "heading_2" }, message: "insertPanel.heading2"
        },
        heading_3: {
            button: "heading3", command: { type: "heading_3" }, message: "insertPanel.heading3"
        },
        heading_4: {
            button: "heading4", command: { type: "heading_4" }, message: "insertPanel.heading4"
        },
        numbered_list_item: {
            button: "numberedList",
            command: { type: "numbered_list_item" },
            message: "insertPanel.numberedList"
        },
        quote: { button: "quote", command: { type: "quote" }, message: "insertPanel.quote" },
        synced_block: {
            button: "copy", command: { type: "synced_block" }, message: "insertPanel.syncedBlock"
        },
        text: { button: "text", command: { type: "text" }, message: "insertPanel.text" },
        to_do: { button: "toDo", command: { type: "to_do" }, message: "insertPanel.toDo" },
        toggle: { button: "toggleList", command: { type: "toggle" }, message: "insertPanel.toggleList" },
        toggle_heading_1: {
            button: "toggleHeading1",
            command: { toggle: true, type: "heading_1" },
            message: "insertPanel.toggleHeading1"
        },
        toggle_heading_2: {
            button: "toggleHeading2",
            command: { toggle: true, type: "heading_2" },
            message: "insertPanel.toggleHeading2"
        },
        toggle_heading_3: {
            button: "toggleHeading3",
            command: { toggle: true, type: "heading_3" },
            message: "insertPanel.toggleHeading3"
        },
        toggle_heading_4: {
            button: "toggleHeading4",
            command: { toggle: true, type: "heading_4" },
            message: "insertPanel.toggleHeading4"
        }
    };

interface CustomInsertOptionProps
{
    readonly close: () => void;
    readonly item: MarkdownEditorCustomInsertItem;
}

/** Render a host-supplied insert-panel option. */
function CustomInsertOption({ close, item }: CustomInsertOptionProps)
{
    const handlePress = useCallback(() => item.onPress({ close }), [ close, item ]);

    return <BlockOption icon={ item.icon }
        label={ item.label }
        layout="grid"
        onPress={ handlePress } />;
}

interface InsertPanelSectionProps
{
    readonly close: () => void;
    readonly models: Readonly<Record<MarkdownEditorInsertItem, InsertOptionModel>>;
    readonly section: MarkdownEditorInsertSection;
    readonly titleStyle: StyleProp<TextStyle>;
}

/** Render one titled section of the insert panel. */
function InsertPanelSection({ close, models, section, titleStyle }: InsertPanelSectionProps)
{
    const { t } = useResolvedEditorConfig();

    return <View>
        <Text accessibilityRole="header"
            style={ titleStyle }>
            { isMessageId(section.title) ? t(section.title) : section.title }
        </Text>
        <View style={ styles.blockGrid }>
            {
                section.items.map((item: MarkdownEditorInsertItem | MarkdownEditorCustomInsertItem) =>
                {
                    if (typeof item !== "string")
                    {
                        return <CustomInsertOption close={ close }
                            item={ item }
                            key={ item.id } />;
                    }

                    const model = models[ item ] as InsertOptionModel | undefined;
                    return model === undefined
                        ? null
                        : <BlockOption button={ model.button }
                            key={ item }
                            label={ model.label }
                            layout="grid"
                            onPress={ model.onPress } />;
                })
            }
        </View>
    </View>;
}

interface CustomToolbarButtonProps
{
    readonly button: MarkdownEditorCustomButton;
    readonly onOpenPanel: (id: string) => () => void;
    readonly openPanel: OpenPanel;
}

/** Render one custom toolbar button, highlighted while its panel is open. */
function CustomToolbarButton({ button, onOpenPanel, openPanel }: CustomToolbarButtonProps)
{
    const handlePress = useMemo(
        () => button.panel === undefined ? button.onPress : onOpenPanel(button.id),
        [ button, onOpenPanel ]
    );
    const active = button.panel === undefined
        ? undefined
        : openPanel.kind === "custom" && openPanel.id === button.id;

    return <ActionButton active={ active }
        icon={ button.icon }
        label={ button.label }
        onPress={ handlePress } />;
}

interface ToolbarRowItemsProps<Builtin extends string>
{
    readonly items: ReadonlyArray<ResolvedToolbarItem<Builtin>>;
    readonly models: Readonly<Record<Builtin, ToolbarButtonModel>>;
    readonly onOpenPanel: (id: string) => () => void;
    readonly openPanel: OpenPanel;
}

/** Render one toolbar row's resolved items: built-in buttons (when they apply), or custom ones. */
function ToolbarRowItems<Builtin extends string>({
    items,
    models,
    onOpenPanel,
    openPanel
}: ToolbarRowItemsProps<Builtin>)
{
    return <>
        {
            items.map((item: ResolvedToolbarItem<Builtin>) =>
            {
                if (item.kind === "custom")
                {
                    return <CustomToolbarButton button={ item.button }
                        key={ item.button.id }
                        onOpenPanel={ onOpenPanel }
                        openPanel={ openPanel } />;
                }

                const model = models[ item.id ];
                return model.visible === false
                    ? null
                    : <ActionButton active={ model.active }
                        button={ model.button }
                        disabled={ model.disabled }
                        key={ item.id }
                        label={ model.label }
                        onPress={ model.onPress } />;
            })
        }
    </>;
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

/** Default horizontal inset for the WYSIWYG page content, in logical pixels. */
const DefaultPagePaddingHorizontal = 24;

/** Default maximum width for the WYSIWYG page content, in logical pixels. */
const DefaultPageMaxWidth = 960;

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

/** The editor body, reading its theme and configuration from the scoped provider. */
function MarkdownEditorContent({
    command: suppliedCommand,
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
    snapshot: suppliedSnapshot,
    ...viewProps
}: MarkdownEditorContentProps)
{
    const { config, onOpenUrl, t, theme } = useResolvedEditorConfig();
    const { icons } = config;
    const customButtons = useMemo(() => config.customButtons ?? [ ], [ config.customButtons ]);
    const pagePaddingHorizontal = config.layout?.pagePaddingHorizontal ?? DefaultPagePaddingHorizontal;
    const pageMaxWidth = config.layout?.pageMaxWidth ?? DefaultPageMaxWidth;
    const imageMaxWidth = config.layout?.imageMaxWidth ?? DefaultPageMaxWidth;
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
    const [ selectionAnchorPoint, setSelectionAnchorPoint ] = useState<EditorPoint>();
    const [ selectionFocusBlockId, setSelectionFocusBlockId ] = useState<string>();
    const [ selectionFocusOffset, setSelectionFocusOffset ] = useState<number>();
    const [ selectionFocusPoint, setSelectionFocusPoint ] = useState<EditorPoint>();
    const root = useRef<View>(null);
    const [ bottomGap, setBottomGap ] = useState(0);
    const bottomGapRef = useRef(0);
    const { height: windowHeight } = useWindowDimensions();
    const keyboardState = useKeyboardState();
    const previousKeyboardVisibility = useRef(keyboardState.isVisible);
    const { height, progress } = useReanimatedKeyboardAnimation();
    const { panel, toolbar } = theme.editor;
    const { fontFamily } = editorFontStyle(theme.editor);
    const snapshot = suppliedSnapshot ?? internalSnapshot ?? defaultSnapshot;
    const columnLabels = useMemo<Readonly<Record<EditorColumnCount, string>>>(() => (
        {
            2: t("insertPanel.columns2"),
            3: t("insertPanel.columns3"),
            4: t("insertPanel.columns4"),
            5: t("insertPanel.columns5")
        }
    ), [ t ]);
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
        && snapshot.blocks.slice(selectionBlockRange.low, selectionBlockRange.high + 1).every(
            (block: EditorBlock) => [
                "text", "heading_1", "heading_2", "heading_3", "heading_4",
                "bulleted_list_item", "numbered_list_item", "to_do", "quote", "callout", "table"
            ].includes(block.type)
        );
    /* A collapsed cursor (no range selected) formats the word it touches, so the sub-menu
       buttons stay enabled at the start, middle, or end of a word -- not just over a range. */
    const selectionIsCollapsed = selectionAnchorBlockId !== undefined
        && selectionFocusBlockId !== undefined
        && selectionAnchorOffset !== undefined
        && selectionFocusOffset !== undefined
        && selectionAnchorBlockId === selectionFocusBlockId
        && selectionAnchorOffset === selectionFocusOffset
        && (selectionAnchorPoint?.field !== "cell"
            || selectionFocusPoint?.field !== "cell"
            || (selectionAnchorPoint.row === selectionFocusPoint.row
                && selectionAnchorPoint.column === selectionFocusPoint.column));
    const cursorBlock = selectionIsCollapsed
        ? snapshot.blocks.find((block: EditorBlock) => block.id === selectionAnchorBlockId)
        : undefined;
    const tableCellSelection = useMemo<EditorTableSelection | undefined>(() =>
    {
        if (!selectionIsCollapsed
            || cursorBlock?.type !== "table"
            || selectionAnchorPoint?.field !== "cell"
            || selectionFocusPoint?.field !== "cell"
            || selectionAnchorPoint.blockId !== cursorBlock.id
            || selectionFocusPoint.blockId !== cursorBlock.id
            || selectionAnchorPoint.row !== selectionFocusPoint.row
            || selectionAnchorPoint.column !== selectionFocusPoint.column)
        {
            return undefined;
        }
        return {
            blockId: cursorBlock.id,
            anchor: { row: selectionAnchorPoint.row, column: selectionAnchorPoint.column },
            focus: { row: selectionFocusPoint.row, column: selectionFocusPoint.column }
        };
    }, [ cursorBlock, selectionAnchorPoint, selectionFocusPoint, selectionIsCollapsed ]);
    const tableCellActions = tableCellSelection !== undefined;
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
            return new Set<MarkdownEditorTurnIntoItem>();
        }

        const selectedBlocks = snapshot.blocks.slice(
            selectionBlockRange.low, selectionBlockRange.high + 1
        );
        return new Set<MarkdownEditorTurnIntoItem>(
            (Object.keys(turnIntoOptions) as Array<MarkdownEditorTurnIntoItem>).filter(
                (item: MarkdownEditorTurnIntoItem) => selectedBlocks.length > 0
                    && turnIntoOptions[ item ].command.type !== undefined
                    && selectedBlocks.every((block: EditorBlock) =>
                        canConvertEditorBlock(block, turnIntoOptions[ item ].command.type!))
            )
        );
    }, [ selectionBlockRange, snapshot.blocks ]);
    const customButtonsById = useMemo(() =>
    {
        const map = new Map<string, MarkdownEditorCustomButton>();
        customButtons.forEach((button: MarkdownEditorCustomButton) => map.set(button.id, button));
        return map;
    }, [ customButtons ]);
    const panelOpen = openPanel.kind !== "none";
    const activeCustomPanel = openPanel.kind === "custom"
        ? customButtonsById.get(openPanel.id)?.panel
        : undefined;
    const CustomPanelContent = activeCustomPanel?.render;
    const openPanelHeight = openPanel.kind === "insert" || openPanel.kind === "turnInto"
        ? panel.height
        : openPanel.kind === "color"
            ? panel.colorHeight
            : activeCustomPanel?.height ?? 0;
    const footerHeight = toolbar.height + openPanelHeight;
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
            "level" | "color" | "colorTarget" | "icon" | "type" | "toggle" | "mark" | "columnCount" | "url"
            | "label" | "blockId"
            | "duration" | "waveform" | "mimeType" | "fileName" | "fileSize"
            | "selection" | "row" | "column">
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
        setSelectionAnchorPoint(nativeEvent.anchor);
        setSelectionFocusBlockId(nativeEvent.focus.blockId);
        setSelectionFocusOffset(nativeEvent.focus.offset);
        setSelectionFocusPoint(nativeEvent.focus);

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
        void (onOpenUrl ?? openPageReferenceUrl)(nativeEvent.url);
    }, [ onOpenUrl ]);
    const handleBlockActionsPress = useCallback(({
        nativeEvent
    }: { nativeEvent: NativeBlockActionsPressEvent }) =>
    {
        const selection: MarkdownEditorBlockActionsSelection =
            {
                blockId: nativeEvent.id,
                blockType: nativeEvent.type,
                scope: nativeEvent.scope,
                selection: nativeEvent.selection
            };
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
    const handleTableCellActions = useCallback(() =>
    {
        if (!tableCellActions || tableCellSelection === undefined)
        {
            return;
        }
        const request: MarkdownEditorBlockActionsSelection =
            {
                blockId: tableCellSelection.blockId,
                blockType: "table",
                scope: "cell",
                selection: tableCellSelection
            };
        send("dismiss");
        if (onBlockActions !== undefined)
        {
            void onBlockActions(request);
            return;
        }
        setBlockActionsRequest(request);
    }, [ onBlockActions, send, tableCellActions, tableCellSelection ]);
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
    const handleTableAction = useCallback((action: MarkdownEditorTableAction) =>
    {
        const request = blockActionsRequest;
        setBlockActionsRequest(undefined);
        if (request === undefined)
        {
            send("focus");
            return;
        }
        const selection = request.selection;
        const extra = {
            blockId: request.blockId,
            column: selection?.anchor.column,
            row: selection?.anchor.row,
            selection
        };
        send(action, extra);
    }, [ blockActionsRequest, send ]);
    const handleTableColor = useCallback((color: MarkdownColor | undefined) =>
    {
        const request = blockActionsRequest;
        setBlockActionsRequest(undefined);
        if (request === undefined)
        {
            send("focus");
            return;
        }
        const action = request.scope === "row"
            ? "rowColor"
            : request.scope === "column"
                ? "columnColor"
                : request.scope === "cell" || request.scope === "cells"
                    ? "cellColor"
                    : "tableColor";
        send(action, {
            blockId: request.blockId,
            color,
            column: request.selection?.anchor.column,
            row: request.selection?.anchor.row,
            selection: request.selection
        });
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
        send("color", { blockId, color, colorTarget: "block" });
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
    const handleTurnInto = useCallback((item: MarkdownEditorTurnIntoItem) => () =>
    {
        /* Turning a block into another type ends the MAB interaction. Close the panel before
           dispatching the native command so the toolbar immediately returns to its compact
           keyboard-adjacent state; the native transform requests the IME again. */
        setOpenPanel(NoPanelOpen);
        send("turnInto", turnIntoOptions[ item ].command);
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
    const handleTable = useCallback(() => send("insertTable"), [ send ]);
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
        (color: MarkdownColor | undefined) => send("color", { color, colorTarget: "inline" }), [ send ]
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
            { backgroundColor: toolbar.background, borderColor: toolbar.border },
            keyboardIsOutsideApp ? [ styles.floatingFooter, { shadowColor: theme.editor.shadow } ] : undefined
        ],
        [ keyboardIsOutsideApp, theme.editor.shadow, toolbar.background, toolbar.border ]
    );
    const toolbarStyle = useMemo(() => [ styles.toolbar, { height: toolbar.height } ], [ toolbar.height ]);
    const surfaceStyle = useMemo(() => [ styles.surface, viewport ], [ viewport ]);
    const panelStyle = useMemo(
        () => [ styles.panel, { backgroundColor: panel.background, height: panel.height } ],
        [ panel.background, panel.height ]
    );
    const colorPanelStyle = useMemo(
        () => [ styles.panel, { backgroundColor: panel.background, height: panel.colorHeight } ],
        [ panel.background, panel.colorHeight ]
    );
    const panelTitleStyle = useMemo(
        () => [ styles.title, { color: panel.title, fontFamily } ],
        [ fontFamily, panel.title ]
    );
    const colorLabelStyle = useMemo(
        () => [ styles.colorLabel, { color: panel.title, fontFamily } ],
        [ fontFamily, panel.title ]
    );
    const customPanelStyle = useMemo(
        () => activeCustomPanel === undefined
            ? undefined
            : [ styles.panel, { backgroundColor: panel.background, height: activeCustomPanel.height } ],
        [ activeCustomPanel, panel.background ]
    );
    const trailingButtonStyle = useMemo(
        () => [ styles.trailingButton, { borderLeftColor: toolbar.divider } ],
        [ toolbar.divider ]
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
            return { backgroundColor: withAlpha(toolbar.background, alpha), flex: 1 };
        }),
        [ toolbar.background ]
    );
    const mediaLabels = useMemo(() => ({
        captureVideo: t("mediaSheet.captureVideo"),
        dismiss: t("mediaSheet.dismiss"),
        openGallery: t("mediaSheet.openGallery"),
        takePicture: t("mediaSheet.takePicture"),
        title: t("mediaSheet.title")
    }), [ t ]);
    /* This title is intentionally coupled to callout blocks. The picker is only used for
       callouts for now, so a generic icon title would imply support we do not expose yet. */
    const emojiLabels = useMemo(() => ({
        common: t("emojiSheet.common"),
        dismiss: t("emojiSheet.dismiss"),
        filter: t("emojiSheet.filter"),
        shuffle: t("emojiSheet.shuffle"),
        title: t("emojiSheet.title")
    }), [ t ]);
    const audioLabels = useMemo(() => ({
        cancel: t("audioSheet.cancel"),
        chooseFile: t("audioSheet.chooseFile"),
        confirm: t("audioSheet.confirm"),
        dismiss: t("audioSheet.dismiss"),
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
        title: t("audioSheet.title"),
        untitled: t("audioSheet.untitled")
    }), [ t ]);
    const linkLabels = useMemo(() => ({
        apply: t("linkSheet.apply"),
        cancel: t("linkSheet.cancel"),
        label: t("linkSheet.label"),
        title: t("linkSheet.title"),
        url: t("linkSheet.url"),
        urlPlaceholder: t("linkSheet.urlPlaceholder")
    }), [ t ]);
    const actionsLabels = useMemo(() => ({
        background: t("actionsSheet.background"),
        chooseAudio: t("audioSheet.chooseFile"),
        chooseColor: t("actionsSheet.chooseColor"),
        color: t("actionsSheet.color"),
        defaultColor: t("actionsSheet.defaultColor"),
        delete: t("actionsSheet.delete"),
        dismiss: t("actionsSheet.dismiss"),
        duplicate: t("actionsSheet.duplicate"),
        editIcon: t("actionsSheet.editIcon"),
        insertAbove: t("actionsSheet.insertAbove"),
        insertBelow: t("actionsSheet.insertBelow"),
        fitTableWidth: t("actionsSheet.fitTableWidth"),
        headerRow: t("actionsSheet.headerRow"),
        headerColumn: t("actionsSheet.headerColumn"),
        insertTableRowAbove: t("actionsSheet.insertTableRowAbove"),
        insertTableRowBelow: t("actionsSheet.insertTableRowBelow"),
        insertTableColumnLeft: t("actionsSheet.insertTableColumnLeft"),
        insertTableColumnRight: t("actionsSheet.insertTableColumnRight"),
        duplicateTableRow: t("actionsSheet.duplicateTableRow"),
        duplicateTableColumn: t("actionsSheet.duplicateTableColumn"),
        deleteTableRow: t("actionsSheet.deleteTableRow"),
        deleteTableColumn: t("actionsSheet.deleteTableColumn"),
        clearTableContents: t("actionsSheet.clearTableContents"),
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
    const blockActionsTable = blockActionsRequest?.blockType === "table"
        ? snapshot.blocks.find((block: EditorBlock) => block.id === blockActionsRequest.blockId)?.table
        : undefined;
    const handleMainRow = useMemo(() => handleMode("main"), [ handleMode ]);
    const handleFormatRow = useMemo(() => handleMode("format"), [ handleMode ]);
    const handleLinkDismiss = useCallback(() => handleLinkResult(undefined), [ handleLinkResult ]);
    const handleReplaceBlockImage = useCallback(
        (url: string) => blockActionsRequest === undefined
            ? undefined
            : handleReplaceImage(blockActionsRequest.blockId, url),
        [ blockActionsRequest, handleReplaceImage ]
    );

    /* Every built-in button, resolved against the editor's current state. `toolbar.main` and
       `toolbar.format` choose which of these appear, and in what order. */
    const mainToolbarModels = useMemo<MainToolbarModels>(() => (
        {
            color: {
                active: openPanel.kind === "color",
                button: "color",
                label: t("toolbar.color"),
                onPress: handleColor,
                visible: canColorSelection
            },
            copy: { button: "copy", label: t("toolbar.copy"), onPress: handleCopy },
            cut: { button: "cut", label: t("toolbar.cut"), onPress: handleCut },
            edit: {
                button: "edit",
                label: t("toolbar.edit"),
                onPress: handleEditPageReference,
                visible: canEditPageReference
            },
            filePicker: { button: "gallery", label: t("toolbar.filePicker"), onPress: handleInsertMedia },
            format: { button: "format", label: t("toolbar.format"), onPress: handleFormatRow },
            indent: {
                button: "indent",
                disabled: !canIndent,
                label: t("toolbar.indent"),
                onPress: handleIndent
            },
            insert: {
                active: openPanel.kind === "insert",
                button: "insert",
                label: t("toolbar.insert"),
                onPress: handleInsert
            },
            moveDown: {
                button: "moveDown",
                label: t("toolbar.moveDown"),
                onPress: handleMoveDown,
                visible: canMoveDown
            },
            moveUp: {
                button: "moveUp",
                label: t("toolbar.moveUp"),
                onPress: handleMoveUp,
                visible: canMoveUp
            },
            outdent: {
                button: "outdent",
                disabled: !canOutdent,
                label: t("toolbar.outdent"),
                onPress: handleOutdent
            },
            paste: { button: "paste", label: t("toolbar.paste"), onPress: handlePaste },
            redo: { button: "redo", label: t("toolbar.redo"), onPress: handleRedo, visible: canRedo },
            remove: { button: "remove", label: t("toolbar.remove"), onPress: handleRemove },
            speech: { button: "speech", label: t("toolbar.speech"), onPress: handleInsertAudio },
            turnInto: {
                active: openPanel.kind === "turnInto",
                button: "turnInto",
                label: t("toolbar.turnInto"),
                onPress: handleTurnIntoPanel
            },
            undo: { button: "undo", disabled: !canUndo, label: t("toolbar.undo"), onPress: handleUndo }
        }
    ), [
        canColorSelection,
        canEditPageReference,
        canIndent,
        canMoveDown,
        canMoveUp,
        canOutdent,
        canRedo,
        canUndo,
        handleColor,
        handleCopy,
        handleCut,
        handleEditPageReference,
        handleFormatRow,
        handleIndent,
        handleInsert,
        handleInsertAudio,
        handleInsertMedia,
        handleMoveDown,
        handleMoveUp,
        handleOutdent,
        handlePaste,
        handleRedo,
        handleRemove,
        handleTurnIntoPanel,
        handleUndo,
        openPanel.kind,
        t
    ]);
    const formatToolbarModels = useMemo<FormatToolbarModels>(() => (
        {
            bold: {
                button: "bold",
                disabled: !canFormatSelection,
                label: t("toolbar.bold"),
                onPress: handleFormat("bold")
            },
            code: {
                button: "code",
                disabled: !canFormatSelection,
                label: t("toolbar.code"),
                onPress: handleFormat("code")
            },
            eraseFormatting: {
                button: "eraseFormatting",
                disabled: !canFormatSelection,
                label: t("toolbar.eraseFormatting"),
                onPress: handleEraseFormatting
            },
            italic: {
                button: "italic",
                disabled: !canFormatSelection,
                label: t("toolbar.italic"),
                onPress: handleFormat("italic")
            },
            link: {
                button: "link",
                disabled: !canLinkSelection,
                label: t("toolbar.link"),
                onPress: handleLink
            },
            strikethrough: {
                button: "strikethrough",
                disabled: !canFormatSelection,
                label: t("toolbar.strikethrough"),
                onPress: handleFormat("strikethrough")
            },
            underline: {
                button: "underline",
                disabled: !canFormatSelection,
                label: t("toolbar.underline"),
                onPress: handleFormat("underline")
            }
        }
    ), [ canFormatSelection, canLinkSelection, handleEraseFormatting, handleFormat, handleLink, t ]);
    const mainToolbarList = config.toolbar?.main ?? defaultMarkdownEditorToolbar.main;
    const formatToolbarList = config.toolbar?.format ?? defaultMarkdownEditorToolbar.format;
    const mainRowItems = useMemo(
        () => resolveToolbarItems(mainToolbarList, mainToolbarItems, customButtons, {
            appendUnlisted: true,
            otherRows: [ formatToolbarList ]
        }),
        [ customButtons, formatToolbarList, mainToolbarList ]
    );
    const formatRowItems = useMemo(
        () => resolveToolbarItems(formatToolbarList, formatToolbarItems, customButtons),
        [ customButtons, formatToolbarList ]
    );

    /* Every built-in insert-panel option. `insertPanel.sections` chooses which appear, where. */
    const insertOptionModels = useMemo<Readonly<Record<MarkdownEditorInsertItem, InsertOptionModel>>>(() => (
        {
            audio: { button: "speech", label: t("insertPanel.audio"), onPress: handleInsertAudio },
            blockEquation: {
                button: "code",
                label: t("insertPanel.blockEquation"),
                onPress: handleUnavailableInsert
            },
            bulletedList: {
                button: "bulletedList",
                label: t("insertPanel.bulletedList"),
                onPress: handleBulletedList
            },
            callout: { button: "callout", label: t("insertPanel.callout"), onPress: handleCallout },
            code: { button: "code", label: t("insertPanel.code"), onPress: handleUnavailableInsert },
            columns2: {
                button: editorColumnButtons[ 2 ],
                label: columnLabels[ 2 ],
                onPress: handleColumns(2)
            },
            columns3: {
                button: editorColumnButtons[ 3 ],
                label: columnLabels[ 3 ],
                onPress: handleColumns(3)
            },
            columns4: {
                button: editorColumnButtons[ 4 ],
                label: columnLabels[ 4 ],
                onPress: handleColumns(4)
            },
            columns5: {
                button: editorColumnButtons[ 5 ],
                label: columnLabels[ 5 ],
                onPress: handleColumns(5)
            },
            divider: { button: "divider", label: t("insertPanel.divider"), onPress: handleDivider },
            file: { button: "filePicker", label: t("insertPanel.file"), onPress: handleInsertFile },
            heading1: { button: "heading1", label: t("insertPanel.heading1"), onPress: handleHeading1 },
            heading2: { button: "heading2", label: t("insertPanel.heading2"), onPress: handleHeading2 },
            heading3: { button: "heading3", label: t("insertPanel.heading3"), onPress: handleHeading3 },
            heading4: { button: "heading4", label: t("insertPanel.heading4"), onPress: handleHeading4 },
            image: { button: "picture", label: t("insertPanel.image"), onPress: handleInsertMedia },
            link: { button: "link", label: t("insertPanel.link"), onPress: handleUnavailableInsert },
            mermaidDiagram: {
                button: "mermaid",
                label: t("insertPanel.mermaidDiagram"),
                onPress: handleUnavailableInsert
            },
            numberedList: {
                button: "numberedList",
                label: t("insertPanel.numberedList"),
                onPress: handleNumberedList
            },
            pageReference: {
                button: "linkToPage",
                label: t("insertPanel.pageReference"),
                onPress: onCreatePageReference === undefined
                    ? handleUnavailableInsert
                    : handleCreatePageReference
            },
            quote: { button: "quote", label: t("insertPanel.quote"), onPress: handleQuote },
            syncedBlock: {
                button: "copy",
                label: t("insertPanel.syncedBlock"),
                onPress: handleUnavailableInsert
            },
            table: { button: "table", label: t("insertPanel.table"), onPress: handleTable },
            tableOfContents: {
                button: "tableOfContents",
                label: t("insertPanel.tableOfContents"),
                onPress: handleTableOfContents
            },
            text: { button: "text", label: t("insertPanel.text"), onPress: handleSplit },
            toDo: { button: "toDo", label: t("insertPanel.toDo"), onPress: handleToDo },
            toggleHeading1: {
                button: "toggleHeading1",
                label: t("insertPanel.toggleHeading1"),
                onPress: handleToggleHeading1
            },
            toggleHeading2: {
                button: "toggleHeading2",
                label: t("insertPanel.toggleHeading2"),
                onPress: handleToggleHeading2
            },
            toggleHeading3: {
                button: "toggleHeading3",
                label: t("insertPanel.toggleHeading3"),
                onPress: handleToggleHeading3
            },
            toggleHeading4: {
                button: "toggleHeading4",
                label: t("insertPanel.toggleHeading4"),
                onPress: handleToggleHeading4
            },
            toggleList: {
                button: "toggleList",
                label: t("insertPanel.toggleList"),
                onPress: handleUnavailableInsert
            },
            video: { button: "video", label: t("insertPanel.video"), onPress: handleInsertMedia }
        }
    ), [
        columnLabels,
        handleBulletedList,
        handleCallout,
        handleColumns,
        handleCreatePageReference,
        handleDivider,
        handleHeading1,
        handleHeading2,
        handleHeading3,
        handleHeading4,
        handleInsertAudio,
        handleInsertFile,
        handleInsertMedia,
        handleNumberedList,
        handleQuote,
        handleSplit,
        handleTable,
        handleTableOfContents,
        handleToDo,
        handleToggleHeading1,
        handleToggleHeading2,
        handleToggleHeading3,
        handleToggleHeading4,
        handleUnavailableInsert,
        onCreatePageReference,
        t
    ]);
    const insertSections = config.insertPanel?.sections ?? defaultMarkdownEditorInsertSections;
    const turnIntoRows = useMemo(
        () => rowsOfTwo(config.turnIntoPanel?.items ?? defaultMarkdownEditorTurnIntoItems),
        [ config.turnIntoPanel?.items ]
    );
    const colorChoices = useMemo(
        () => editorColorChoices(config.colorPanel, t, t("colorPanel.default")),
        [ config.colorPanel, t ]
    );
    const nativeTheme = useMemo(() => nativeEditorTheme(theme), [ theme ]);
    const nativeLabels = useMemo<NativeEditorLabels>(() => (
        {
            audio: t("native.audio"),
            editableTableCells: t("native.editableTableCells"),
            emptyToDoPlaceholder: t("native.emptyToDoPlaceholder"),
            emptyTogglePlaceholder: t("native.emptyTogglePlaceholder"),
            file: t("native.file"),
            fitTableWidth: t("native.fitTableWidth"),
            selectTableColumn: t("native.selectTableColumn"),
            selectTableRow: t("native.selectTableRow"),
            tableActions: t("native.tableActions"),
            tableCell: t("native.tableCell"),
            tableOfContents: t("native.tableOfContents"),
            tableSelectionEnd: t("native.tableSelectionEnd"),
            tableSelectionStart: t("native.tableSelectionStart"),
            unknownFileSize: t("native.unknownFileSize")
        }
    ), [ t ]);
    const pageReferenceFallbackGlyph = config.pageReferenceFallbackGlyph
        ?? (icons?.linkToPage !== undefined ? "↗" : undefined);

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
                            command={ command }
                            imageMaxWidth={ imageMaxWidth }
                            labels={ nativeLabels }
                            onBlockActionsPress={ handleBlockActionsPress }
                            onContentSize={ handleContentSize }
                            onEdit={ receiveEdit }
                            onPageReferencePress={ handlePageReferencePress }
                            pageReferenceFallbackIcon={ pageReferenceFallbackGlyph }
                            snapshot={ snapshot }
                            style={ editorStyle }
                            testID={ testID }
                            theme={ nativeTheme }
                        />
                    </View>
                </ScrollView>
            </Animated.View>
            <KeyboardStickyView
                enabled={ !keyboardIsOutsideApp }
                offset={ stickyViewOffset }
                style={ stickyViewStyle }>
                <View style={ toolbarStyle }>
                    <View style={ styles.scrollArea }>
                        <ScrollView
                            horizontal
                            keyboardShouldPersistTaps="always"
                            showsHorizontalScrollIndicator={ false }>
                            {
                                row === "format" ? <>
                                    <ActionButton button="back"
                                        label={ t("toolbar.back") }
                                        onPress={ handleMainRow } />
                                    <ToolbarRowItems items={ formatRowItems }
                                        models={ formatToolbarModels }
                                        onOpenPanel={ handleCustomPanelOpen }
                                        openPanel={ openPanel } />
                                </> : <ToolbarRowItems items={ mainRowItems }
                                    models={ mainToolbarModels }
                                    onOpenPanel={ handleCustomPanelOpen }
                                    openPanel={ openPanel } />
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
                                    label={ t("toolbar.close") }
                                    onPress={ closePanel } />
                                : <ActionButton button="hideKeyboard"
                                    label={ t("toolbar.hideKeyboard") }
                                    onPress={ handleDismiss } />
                        }
                        {
                            selectedCallout
                                ? <ActionButton
                                    button="more"
                                    label={ t("actionsSheet.title") }
                                    onPress={ handleCalloutActions } />
                                : tableCellActions && <ActionButton
                                    button="more"
                                    label={ t("actionsSheet.title") }
                                    onPress={ handleTableCellActions } />
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
                            {
                                insertSections.map((section: MarkdownEditorInsertSection) =>
                                    <InsertPanelSection close={ closePanel }
                                        key={ section.id }
                                        models={ insertOptionModels }
                                        section={ section }
                                        titleStyle={ panelTitleStyle } />)
                            }
                        </ScrollView>
                    </Animated.View>
                }
                {
                    openPanel.kind === "turnInto" && <Animated.View entering={ FadeIn.duration(160) }
                        exiting={ FadeOut.duration(120) }
                        style={ panelStyle }>
                        <Text accessibilityRole="header"
                            style={ panelTitleStyle }>{ t("turnIntoPanel.title") }</Text>
                        {
                            turnIntoRows.map((
                                pair: TurnIntoRow
                            ) => pair[ 1 ] === undefined
                                ? <BlockOption button={ turnIntoOptions[ pair[ 0 ] ].button }
                                    disabled={ !allowedTurnIntoTypes.has(pair[ 0 ]) }
                                    key={ pair[ 0 ] }
                                    label={ t(turnIntoOptions[ pair[ 0 ] ].message) }
                                    layout="full"
                                    onPress={ handleTurnInto(pair[ 0 ]) } />
                                : <View key={ pair[ 0 ] }
                                    style={ styles.blockRow }>
                                    {
                                        pair.map((type: MarkdownEditorTurnIntoItem | undefined) =>
                                            type !== undefined
                                            && <BlockOption button={ turnIntoOptions[ type ].button }
                                                disabled={ !allowedTurnIntoTypes.has(type) }
                                                key={ type }
                                                label={ t(turnIntoOptions[ type ].message) }
                                                layout="half"
                                                onPress={ handleTurnInto(type) } />)
                                    }
                                </View>)
                        }
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
                            <ColorOptionGrid choices={ colorChoices.text }
                                onSelect={ handleSelectColor } />
                            <Text style={ colorLabelStyle }>
                                { t("colorPanel.background") }
                            </Text>
                            <ColorOptionGrid choices={ colorChoices.background }
                                onSelect={ handleSelectColor } />
                        </ScrollView>
                    </Animated.View>
                }
                {
                    CustomPanelContent !== undefined && <Animated.View entering={ FadeIn.duration(160) }
                        exiting={ FadeOut.duration(120) }
                        style={ customPanelStyle }>
                        <CustomPanelContent
                            close={ closePanel }
                            theme={ theme } />
                    </Animated.View>
                }
            </KeyboardStickyView>
            {
                mediaSheetVisible && <MediaBottomSheet
                    labels={ mediaLabels }
                    onDismiss={ handleMediaSheetDismiss }
                    onSelected={ handleMediaSelected } />
            }
            {
                emojiSheetVisible && <EmojiBottomSheet
                    labels={ emojiLabels }
                    onDismiss={ handleEmojiSheetDismiss }
                    onSelected={ handleCalloutIcon } />
            }
            {
                audioSheetVisible && <AudioBottomSheet
                    initialAction={ audioSheetInitialAction }
                    labels={ audioLabels }
                    onDismiss={ handleAudioSheetDismiss }
                    onSelected={ handleAudioSelected }
                    replacement={ audioReplacementBlockId !== undefined } />
            }
            {
                linkSheetVisible && linkRequest !== undefined && <LinkBottomSheet
                    initialLabel={ linkRequest.label }
                    initialUrl={ linkRequest.url }
                    labels={ linkLabels }
                    onDismiss={ handleLinkDismiss }
                    onSubmit={ handleLinkResult } />
            }
            {
                blockActionsRequest !== undefined && blockActionsName !== undefined
                    && <ActionsBottomSheet
                        blockName={ blockActionsName }
                        labels={ actionsLabels }
                        onAction={ handleBlockAction }
                        onColor={ handleCalloutColor }
                        onDismiss={ handleBlockActionsDismiss }
                        onEditIcon={ handleEditCalloutIcon }
                        onReplaceAudio={ handleReplaceAudio }
                        onReplaceImage={ handleReplaceBlockImage }
                        onTableAction={ handleTableAction }
                        onTableColor={ handleTableColor }
                        showBlockColorActions={ editorBlockColorTypes.includes(blockActionsRequest.blockType) }
                        showCalloutActions={ blockActionsRequest.blockType === "callout" }
                        showInsertAbove={ blockActionsRequest.blockType !== "divider" }
                        showReplaceAudio={ blockActionsRequest.blockType === "audio" }
                        showReplaceImage={ blockActionsRequest.blockType === "image" }
                        showTableActions={ blockActionsRequest.blockType === "table" }
                        tableActionScope={ blockActionsRequest.scope ?? "table" }
                        tableFitPageWidth={ blockActionsTable?.fitPageWidth ?? false } />
            }
        </View>
    );
}

/** The editor's props, less the configuration handed to its scoped `MarkdownProvider`. */
type MarkdownEditorContentProps =
    Omit<MarkdownEditorProps, keyof MarkdownSharedConfig | keyof MarkdownEditorConfig>;

/**
 * The ready-to-use editor surface, including the keyboard-adjacent editor controls. Configuration
 * props override the nearest `MarkdownProvider` for this editor only.
 *
 * @since 1.0.0
 */
export function MarkdownEditor({
    colorPanel,
    colorScheme,
    customButtons,
    icons,
    insertPanel,
    layout,
    localization,
    onOpenUrl,
    pageReferenceFallbackGlyph,
    theme,
    toolbar,
    turnIntoPanel,
    ...props
}: MarkdownEditorProps)
{
    const editor = useMemo<MarkdownEditorConfig>(() => (
        {
            colorPanel,
            customButtons,
            icons,
            insertPanel,
            layout,
            pageReferenceFallbackGlyph,
            toolbar,
            turnIntoPanel
        }
    ), [
        colorPanel,
        customButtons,
        icons,
        insertPanel,
        layout,
        pageReferenceFallbackGlyph,
        toolbar,
        turnIntoPanel
    ]);

    return <MarkdownProvider colorScheme={ colorScheme }
        editor={ editor }
        localization={ localization }
        onOpenUrl={ onOpenUrl }
        theme={ theme }>
        <MarkdownEditorContent { ...props } />
    </MarkdownProvider>;
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
        shadowOffset: { height: 2, width: 0 },
        shadowOpacity: 0.16,
        shadowRadius: 6
    },
    footer:
    {
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
