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
    type ProofBlock,
    type ProofColumnCount,
    type ProofCommand,
    type ProofEvent,
    type ProofPoint,
    type ProofSnapshot,
    type ProofTextMark,
    type ProofTextMarkKind
} from "../../prototype.ts";
import Animated, { FadeIn, FadeOut, useAnimatedStyle } from "react-native-reanimated";
import {
    KeyboardStickyView,
    useKeyboardState,
    useReanimatedKeyboardAnimation
} from "react-native-keyboard-controller";
import {
    type NativePageReferencePressEvent,
    NativeProofEditor,
    type NativeProofEditorProps
} from "../../NativeProofEditor.tsx";
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
import { LinkBottomSheet } from "./LinkBottomSheet.tsx";
import { MediaBottomSheet } from "./MediaBottomSheet.tsx";
import type { NotionMarkdownColor } from "../../document/types.ts";
import { openPageReferenceUrl } from "../../openPageReference.ts";
import { useNotionEditorTranslate } from "./config.tsx";

/**
 * Buttons that can display an icon in the editor UI.
 *
 * @since 1.0.0
 */
export type NotionEditorButton =
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
    | "eraseFormatting"
    | "link"
    | "speech"
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
    | "copy"
    | "cut"
    | "paste"
    | "edit"
    | "linkToPage"
    | "hideKeyboard"
    | "text"
    | "divider"
    | "tableOfContents"
    | "columns"
    | "toDo"
    | "callout"
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
export interface NotionEditorIconProps
{
    readonly color: string;
    readonly size: number;
    readonly strokeWidth: number;
}

/**
 * Optional per-button icon overrides. Toolbar buttons with no entry here fall back to a plain text
 * label. The built-in media sheet uses these overrides first, then the optional Lucide peer, then
 * its dependency-free SVG fallback. Import {@link notionEditorLucideIcons} from
 * `react-native-notion-markdown/editor/ui/lucide-icons` for a ready-made toolbar icon set.
 *
 * @since 1.0.0
 */
export interface NotionEditorComponents extends Partial<Record<
    NotionEditorButton,
    ComponentType<NotionEditorIconProps>
>> { }

/** The built-in media action selected from the insert-media sheet. */
export type NotionEditorMediaAction = "gallery" | "picture" | "video";

/** A portable description of one asset returned by Expo ImagePicker. */
export interface NotionEditorMediaAsset
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
export interface NotionEditorMediaSelection
{
    readonly action: NotionEditorMediaAction;
    readonly assets?: ReadonlyArray<NotionEditorMediaAsset>;
    readonly canceled: boolean;
}

/**
 * Display data for a page reference used by the editor.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface NotionEditorPageReference
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
export interface NotionEditorPageReferenceSelection
{
    readonly anchor: ProofPoint;
    readonly focus: ProofPoint;
}

/** The current text selection handed to a host link prompt. */
export interface NotionEditorLinkSelection
{
    readonly anchor: ProofPoint;
    readonly focus: ProofPoint;
    readonly label: string;
    readonly url?: string;
}

/** A link value returned by a host link prompt or the built-in link modal. */
export interface NotionEditorLinkResult
{
    readonly label?: string;
    readonly url: string;
}

/** Host-supplied link prompt result. Returning nothing leaves the selection unchanged. */
export type NotionEditorLinkPromptResult =
    | NotionEditorLinkResult
    | null
    | undefined
    | Promise<NotionEditorLinkResult | null | undefined>;

/**
 * Theme and control values handed to a {@link NotionEditorCustomPanel}'s `render` function, so
 * custom panel content can match the editor's current theme without re-deriving dark/light
 * itself, and can close the panel the same way the built-in "Return to keyboard" option does.
 *
 * @since 1.0.0
 */
export interface NotionEditorCustomPanelContext
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
 * A panel that replaces the on-screen keyboard while its owning {@link NotionEditorCustomButton}
 * is active -- the custom equivalent of the built-in "Basic blocks" insert panel.
 *
 * @since 1.0.0
 */
export interface NotionEditorCustomPanel
{
    /** Fixed panel height, used to reserve space above the keyboard while the panel is open. */
    readonly height: number;

    /** Renders the panel's content. */
    readonly render: ComponentType<NotionEditorCustomPanelContext>;
}

/**
 * Placement of a {@link NotionEditorCustomButton} relative to another button's id -- a built-in
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
export type NotionEditorCustomButtonPlacement =
    | { readonly after: string; readonly before?: undefined }
    | { readonly after?: undefined; readonly before: string }
    | { readonly after?: undefined; readonly before?: undefined };

interface NotionEditorCustomButtonBase
{
    /** Icon for this button. Omit for a plain text label, matching the built-in buttons. */
    readonly icon?: ComponentType<NotionEditorIconProps>;

    /** Unique id for this button, used for placement and to identify its open panel. */
    readonly id: string;

    readonly label: string;
}

/**
 * A consumer-supplied button spliced into the main toolbar row -- never the format row or the
 * trailing hide-keyboard/close slot. Supply either `onPress` for a plain action button, or
 * `panel` to pair the button with a {@link NotionEditorCustomPanel}: pressing it then opens that
 * panel in place of the on-screen keyboard, and the button is highlighted the same way the
 * built-in "Insert" button is while its panel is open.
 *
 * @since 1.0.0
 */
export type NotionEditorCustomButton =
    NotionEditorCustomButtonBase
    & NotionEditorCustomButtonPlacement
    & (
        | { readonly onPress: () => void; readonly panel?: undefined }
        | { readonly onPress?: undefined; readonly panel: NotionEditorCustomPanel }
    );

/**
 * Props for the configured editor UI.
 *
 * @since 1.0.0
 */
export interface NotionEditorProps extends Omit<NativeProofEditorProps, "command" | "onEdit" | "snapshot">
{
    /** Horizontal inset applied to the WYSIWYG page content. The MAB is not affected. */
    readonly pagePaddingHorizontal?: number;

    /** Maximum width of the centered WYSIWYG page content. The default is 960 logical pixels. */
    readonly pageMaxWidth?: number;

    /** Document state. When omitted, a starter document is created and managed internally. */
    readonly snapshot?: ProofSnapshot;

    /** An externally controlled native command. */
    readonly command?: ProofCommand;

    /** Receives native editing events. Omit this callback for internally managed document state. */
    readonly onEdit?: (Event: { nativeEvent: ProofEvent }) => void;

    /** Receives actions selected in the editor UI, plus any level/color/type/mark/url/label it carries. */
    readonly onCommand?: (
        Action: ProofCommand["action"],
        Extra?: Pick<ProofCommand,
            "level" | "color" | "type" | "toggle" | "mark" | "columnCount" | "url" | "label">
    ) => void;

    /** Optional icon overrides for the editor UI. */
    readonly components?: NotionEditorComponents;

    /**
     * Replaces the built-in insert-media sheet. This is also the fallback for applications that
     * do not install the optional `expo-image-picker` peer.
     */
    readonly onInsertMedia?: () => void | Promise<void>;

    /** Alias for {@link onInsertMedia}, named after the built-in `filePicker` button id. */
    readonly onFilePicker?: () => void | Promise<void>;

    /**
     * Receives selections made by the built-in insert-media sheet; image and
     * video assets are also displayed in the editor automatically.
     */
    readonly onMediaSelected?: (
        Selection: NotionEditorMediaSelection
    ) => void | Promise<void>;

    /** Requests that the dependent create a page reference for the current selection. */
    readonly onCreatePageReference?: (
        Selection: NotionEditorPageReferenceSelection
    ) => void | Promise<void>;

    /** Requests that the dependent edit the selected page reference. */
    readonly onEditPageReference?: (
        Reference: NotionEditorPageReference
    ) => void | Promise<void>;

    /** Prompts for a link URL and optional replacement label instead of using the built-in modal. */
    readonly onRequestLink?: (
        Selection: NotionEditorLinkSelection
    ) => NotionEditorLinkPromptResult;

    /** Handles page-reference taps, or falls back to the optional expo-linking peer. */
    readonly onOpenPageReference?: (url: string) => void | Promise<void>;

    /** Buttons spliced into the main toolbar row. Never shown in the format row or trailing slot. */
    readonly customButtons?: Array<NotionEditorCustomButton>;
}

interface ActionButtonProps
{
    /** Highlights the button as the active toggle for an open panel (e.g. "Insert" while open). */
    readonly active?: boolean;
    readonly activeBackground?: string;
    readonly button?: NotionEditorButton;
    readonly color: string;
    readonly components?: NotionEditorComponents;
    /** Dims the button and blocks presses, e.g. "Undo" with no history to undo. */
    readonly disabled?: boolean;
    /** Icon to use directly, taking precedence over `button`/`components` lookup -- for custom buttons. */
    readonly icon?: ComponentType<NotionEditorIconProps>;
    readonly label: string;
    readonly onPress: () => void;
}

interface BlockOptionProps
{
    readonly background: string;
    readonly button?: NotionEditorButton;
    /** Icon color -- muted, matching the toolbar's icon color. */
    readonly color: string;
    readonly components?: NotionEditorComponents;
    readonly fullWidth?: boolean;
    readonly grid?: boolean;
    readonly label: string;
    /** Label text color -- the editor's regular foreground, for contrast against the muted icon. */
    readonly labelColor: string;
    readonly disabled?: boolean;
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
 * importing {@link notionEditorLucideIcons} from `react-native-notion-markdown/editor/ui/
 * lucide-icons` -- a separate module Metro only needs to resolve `lucide-react-native` for when
 * something actually imports it -- and passing it as `components`.
 *
 * @since 1.0.0
 */
function getButtonIcon(
    button: NotionEditorButton | undefined,
    components: NotionEditorComponents | undefined
): ComponentType<NotionEditorIconProps> | undefined
{
    return button === undefined ? undefined : components?.[button];
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
 * Notion's own insert-block picker rather than the toolbar's icon-only buttons.
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
    const labelStyle = useMemo(() => [ styles.blockOptionLabel, { color: labelColor } ], [ labelColor ]);
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
            Icon !== undefined && createElement(Icon, { color, size: 20, strokeWidth: 2 })
        }
        <Text style={ labelStyle }>{ label }</Text>
    </Pressable>;
}

interface ProofColorOption
{
    readonly background: boolean;
    readonly color: NotionMarkdownColor | undefined;
    readonly hex: string | undefined;
}

/* The Notion-flavored Markdown text colors, plus their `_bg` background variants, offered by the
   selection color panel. `undefined` clears the selected blocks back to their default color. */
const proofColorOptions: ReadonlyArray<ProofColorOption> =
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

const proofTurnIntoTypes: ReadonlyArray<ProofBlock["type"]> =
    [ "text", "heading_1", "heading_2", "heading_3", "heading_4" ];

/** Return whether a proof block supports conversion to the requested proof block type. */
function canConvertProofBlock(block: ProofBlock, type: ProofBlock["type"]): boolean
{
    return proofTurnIntoTypes.includes(block.type) && proofTurnIntoTypes.includes(type);
}

/**
 * Return whether a collapsed cursor at the given UTF-16 offset touches a word -- the character
 * immediately before or after the cursor is non-whitespace. This covers the beginning, middle,
 * and end of a word, matching the range the native side widens the format command to.
 *
 * @since 1.0.0
 */
function proofCursorTouchesWord(text: string, offset: number): boolean
{
    const before = offset > 0 ? text[offset - 1] : undefined;
    const after = offset < text.length ? text[offset] : undefined;
    return (before !== undefined && !/\s/.test(before)) || (after !== undefined && !/\s/.test(after));
}

/**
 * A human-readable accessibility label for a color swatch. The color catalog is a fixed, small
 * set of Notion-defined names rather than host-facing copy, so it isn't routed through `t()`.
 *
 * @since 1.0.0
 */
function proofColorLabel(option: ProofColorOption, defaultLabel: string): string
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
    readonly option: ProofColorOption;
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
function proofColorRows(
    options: ReadonlyArray<ProofColorOption>
): Array<Readonly<[ProofColorOption, ProofColorOption | undefined]>>
{
    const rows: Array<Readonly<[ProofColorOption, ProofColorOption | undefined]>> = [ ];
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
    readonly onSelect: (color: NotionMarkdownColor | undefined) => () => void;
    readonly options: ReadonlyArray<ProofColorOption>;
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
            proofColorRows(options).map((row: Readonly<[ProofColorOption, ProofColorOption | undefined]>) =>
            {
                const firstKey = row[ 0 ].color ?? "default";
                return <View key={ firstKey }
                    style={ styles.blockRow }>
                    <ColorChoice
                        cardBackground={ cardBackground }
                        foreground={ foreground }
                        iconColor={ iconColor }
                        label={ proofColorLabel(row[ 0 ], defaultLabel) }
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
                                label={ proofColorLabel(row[ 1 ], defaultLabel) }
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
export function NotionEditor({
    command: suppliedCommand,
    components,
    customButtons,
    dark: suppliedDark,
    onCommand,
    onCreatePageReference,
    onEditPageReference,
    onRequestLink,
    onEdit,
    onFilePicker,
    onInsertMedia,
    onMediaSelected,
    onOpenPageReference,
    emptyTogglePlaceholder: suppliedEmptyTogglePlaceholder,
    pageReferenceFallbackIcon: suppliedPageReferenceFallbackIcon,
    pagePaddingHorizontal = DefaultPagePaddingHorizontal,
    pageMaxWidth = DefaultPageMaxWidth,
    imageMaxWidth = DefaultPageMaxWidth,
    snapshot: suppliedSnapshot,
    ...viewProps
}: NotionEditorProps)
{
    const t = useNotionEditorTranslate();
    const [ defaultSnapshot ] = useState(CreateProofDocument);
    const [ internalSnapshot, setInternalSnapshot ] = useState<ProofSnapshot>();
    const [ internalCommand, setInternalCommand ] = useState<ProofCommand>();
    const [ row, setRow ] = useState<ToolbarRow>("main");
    const [ openPanel, setOpenPanel ] = useState<OpenPanel>(NoPanelOpen);
    const [ mediaSheetVisible, setMediaSheetVisible ] = useState(false);
    const [ linkSheetVisible, setLinkSheetVisible ] = useState(false);
    const [ linkRequest, setLinkRequest ] = useState<NotionEditorLinkSelection>();
    const sequence = useRef(0);
    const currentSnapshot = useRef(suppliedSnapshot ?? internalSnapshot ?? defaultSnapshot);
    /* A JS-side history of past/undone snapshots for the internally-managed document. This needs
       no native undo support: undoing/redoing simply hands the native editor an older/newer
       snapshot under a bumped epoch, the same "replace the whole document" path already used for
       a host-supplied `snapshot` -- see NotionProofView.kt's `setSnapshot`. Edits reported with
       `source === "replacement"` are our own history replay landing back through `onEdit`, not new
       user edits, so they're accepted into state but never pushed onto the undo stack. */
    const undoStack = useRef<Array<ProofSnapshot>>([ ]);
    const redoStack = useRef<Array<ProofSnapshot>>([ ]);
    const [ canUndo, setCanUndo ] = useState(false);
    const [ canRedo, setCanRedo ] = useState(false);
    /* The block(s) the current native selection spans, tracked from `ProofEvent.anchor`/`focus`
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
    const { height, progress } = useReanimatedKeyboardAnimation();
    const foreground = dark ? "#eeeeee" : "#2C2C2B";
    const background = dark ? "#191919" : "#ffffff";
    /* Matches Notion's own above-the-keyboard toolbar icon/label color, sampled from its
       mobile action bar in both themes -- a warm gray, not a neutral one. */
    const iconColor = dark ? "#ada9a3" : "#8e8b86";
    /* The "Basic blocks" panel sits on a slightly recessed surface, with raised cards for each
       option -- matching Notion's own insert-block picker. */
    const panelBackground = dark ? "#2b2b2a" : "#f7f7f5";
    const cardBackground = dark ? "#3a3a39" : "#ffffff";
    const activeBackground = dark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";
    const dividerColor = dark ? "rgba(255, 255, 255, 0.14)" : "rgba(0, 0, 0, 0.12)";
    /* RGB channels of `background` (the toolbar's own surface), so the scroll fade can blend into
       it at increasing opacity instead of a plain, harder-edged divider. */
    const backgroundRgb = dark ? "25, 25, 25" : "255, 255, 255";
    const snapshot = suppliedSnapshot ?? internalSnapshot ?? defaultSnapshot;
    const columnLabels: Record<ProofColumnCount, string> =
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
            (block: ProofBlock) => block.id === selectionAnchorBlockId
        );
        const focusIndex = snapshot.blocks.findIndex(
            (block: ProofBlock) => block.id === selectionFocusBlockId
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
            (block: ProofBlock) => block.type === "text"
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
        ? snapshot.blocks.find((block: ProofBlock) => block.id === selectionAnchorBlockId)
        : undefined;
    const canFormatCollapsedCursor = cursorBlock !== undefined
        && cursorBlock.type !== "link_to_page"
        && proofCursorTouchesWord(cursorBlock.text, selectionAnchorOffset as number);
    const canFormatSelection = canFormatCollapsedCursor
        || (hasTextSelection && selectionBlockRange !== undefined
            && !snapshot.blocks.slice(selectionBlockRange.low, selectionBlockRange.high + 1).some(
                (block: ProofBlock) => block.type === "link_to_page"
            ));
    const canLinkSelection = canFormatSelection && selectionBlockRange !== undefined
        && snapshot.blocks.slice(selectionBlockRange.low, selectionBlockRange.high + 1).every(
            (block: ProofBlock) => [
                "text", "heading_1", "heading_2", "heading_3", "heading_4",
                "bulleted_list_item", "numbered_list_item", "to_do"
            ].includes(block.type)
        );
    const canIndent = selectionBlockRange !== undefined && selectionBlockRange.low > 0;
    const canOutdent = selectionBlockRange !== undefined
        && snapshot.blocks.slice(selectionBlockRange.low, selectionBlockRange.high + 1).some(
            (block: ProofBlock) => (block.depth ?? 0) > 0
        );
    const selectedPageReference = useMemo<NotionEditorPageReference | undefined>(() =>
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
    const allowedTurnIntoTypes = useMemo(() =>
    {
        if (selectionBlockRange === undefined)
        {
            return new Set<ProofBlock["type"]>();
        }

        const selectedBlocks = snapshot.blocks.slice(
            selectionBlockRange.low, selectionBlockRange.high + 1
        );
        return new Set<ProofBlock["type"]>(proofTurnIntoTypes.filter(
            (type: ProofBlock["type"]) => selectedBlocks.length > 0
                && selectedBlocks.every((block: ProofBlock) => canConvertProofBlock(block, type))
        ));
    }, [ selectionBlockRange, snapshot.blocks ]);
    const customButtonsById = useMemo(() =>
    {
        const map = new Map<string, NotionEditorCustomButton>();
        customButtons?.forEach((button: NotionEditorCustomButton) => map.set(button.id, button));
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

        customButtons?.forEach((button: NotionEditorCustomButton) =>
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
        action: ProofCommand["action"],
        extra?: Pick<ProofCommand,
            "level" | "color" | "type" | "toggle" | "mark" | "columnCount" | "url" | "label">
    ) =>
    {
        if (onCommand !== undefined)
        {
            onCommand(action, extra);
            return;
        }

        const next: ProofCommand =
            {
                action,
                epoch: currentSnapshot.current.epoch,
                id: ++sequence.current,
                ...extra
            };

        setInternalCommand(next);
    }, [ onCommand ]);

    /* Panel content replaces the keyboard, so enforce dismissal after the panel has actually
       entered the rendered tree as well as at the initiating button press. This also covers
       panels opened by future state transitions and closes the focus/IME race on Android. */
    useEffect(() =>
    {
        if (panelOpen || mediaSheetVisible)
        {
            send("dismiss");
        }
    }, [ mediaSheetVisible, panelOpen, send ]);

    const receiveEdit = useCallback(({ nativeEvent }: { nativeEvent: ProofEvent }) =>
    {
        setSelectionAnchorBlockId(nativeEvent.anchor.blockId);
        setSelectionAnchorOffset(nativeEvent.anchor.offset);
        setSelectionFocusBlockId(nativeEvent.focus.blockId);
        setSelectionFocusOffset(nativeEvent.focus.offset);

        if (suppliedSnapshot === undefined && onEdit === undefined)
        {
            const previous = currentSnapshot.current;
            const next = AcceptProofEvent(previous, nativeEvent);
            if (next !== previous)
            {
                currentSnapshot.current = next;
                setInternalSnapshot(next);

                /* A follow-up selection/focus event right after a history-restoring
                   `setSnapshot` reload still bumps the native revision counter, so it reaches
                   here as "accepted" even though nothing textual changed -- `AcceptProofEvent`
                   reuses unchanged block references, so comparing block identity (not just the
                   wrapper object) tells a real edit from that housekeeping event. */
                const blocksChanged = next.blocks.length !== previous.blocks.length
                    || next.blocks.some(
                        (block: ProofBlock, index: number) => block !== previous.blocks[ index ]
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

    const handleMode = useCallback((nextRow: ToolbarRow) => () =>
    {
        setRow(nextRow);
        setOpenPanel(NoPanelOpen);
    }, [ ]);
    const handleInsert = useCallback(() =>
    {
        setOpenPanel({ kind: "insert" });
        send("dismiss");
    }, [ send ]);
    const handleInsertMedia = useCallback(() =>
    {
        const override = onInsertMedia ?? onFilePicker;
        if (override !== undefined)
        {
            send("dismiss");
            void override();
            return;
        }

        setMediaSheetVisible(true);
        send("dismiss");
    }, [ onFilePicker, onInsertMedia, send ]);
    const handleMediaSheetDismiss = useCallback(() =>
    {
        setMediaSheetVisible(false);
        send("focus");
    }, [ send ]);
    const handleLinkResult = useCallback((result: NotionEditorLinkResult | null | undefined) =>
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
            (block: ProofBlock) => block.id === selectionAnchorBlockId
        );
        const focusIndex = snapshot.blocks.findIndex(
            (block: ProofBlock) => block.id === selectionFocusBlockId
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
        const label = snapshot.blocks.slice(low, high + 1).map((block: ProofBlock, index: number) =>
        {
            const start = index === 0 ? startOffset : 0;
            const end = index === high - low ? endOffset : block.text.length;
            return block.text.slice(start, end);
        }).join("\n");
        const urls = new Set<string>();
        snapshot.blocks.slice(low, high + 1).forEach((block: ProofBlock, index: number) =>
        {
            const start = index === 0 ? startOffset : 0;
            const end = index === high - low ? endOffset : block.text.length;
            block.marks?.forEach((mark: ProofTextMark) =>
            {
                if (mark.kind === "link" && mark.url !== undefined
                    && mark.start < end && mark.end > start)
                {
                    urls.add(mark.url);
                }
            });
        });
        const request: NotionEditorLinkSelection =
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
        const restored: ProofSnapshot = { ...previous, epoch: currentSnapshot.current.epoch + 1 };
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
        const restored: ProofSnapshot = { ...next, epoch: currentSnapshot.current.epoch + 1 };
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
    const handleTurnInto = useCallback((type: ProofBlock["type"]) => () =>
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
    const handleNoop = useCallback(() => { }, [ ]);
    const handleFormat = useCallback((mark: ProofTextMarkKind) => () =>
        send("format", { mark }), [ send ]);
    const handleEraseFormatting = useCallback(() => send("clearFormat"), [ send ]);
    const handleCustomPanelOpen = useCallback((id: string) => () =>
    {
        setOpenPanel({ id, kind: "custom" });
        send("dismiss");
    }, [ send ]);
    const handleSplit = useCallback(() => send("split"), [ send ]);
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
    const handleColumns = useCallback((columnCount: ProofColumnCount) => () =>
        send("columns", { columnCount }), [ send ]);
    const handleToDo = useCallback(() => send("toDo"), [ send ]);
    const handleCallout = useCallback(() => send("callout"), [ send ]);
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
    const handleMediaSelected = useCallback(async (selection: NotionEditorMediaSelection) =>
    {
        if (!selection.canceled && selection.assets !== undefined)
        {
            const mediaAsset = selection.assets.find((asset: NotionEditorMediaAsset) =>
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
    const handleSelectColor = useCallback(
        (color: NotionMarkdownColor | undefined) => () => send("color", { color }), [ send ]
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
    const linkLabels = useMemo(() => ({
        apply: t("linkSheet.apply"),
        cancel: t("linkSheet.cancel"),
        label: t("linkSheet.label"),
        title: t("linkSheet.title"),
        url: t("linkSheet.url")
    }), [ t ]);
    return (
        <View
            { ...nativeViewProps }
            onLayout={ measureCanvas }
            ref={ root }
            style={ handleLayout }>
            <Animated.View style={ surfaceStyle }>
                <View style={ pageStyle }>
                    <NativeProofEditor
                        { ...nativeViewProps }
                        command={ command }
                        dark={ dark }
                        emptyTogglePlaceholder={ suppliedEmptyTogglePlaceholder }
                        imageMaxWidth={ imageMaxWidth }
                        onEdit={ receiveEdit }
                        onPageReferencePress={ handlePageReferencePress }
                        pageReferenceFallbackIcon={ suppliedPageReferenceFallbackIcon
                            ?? (components?.linkToPage !== undefined ? "↗" : undefined) }
                        snapshot={ snapshot }
                        style={ styles.editor }
                        testID={ testID }
                    />
                </View>
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
                                            onPress={ handleNoop } />;
                                        case "filePicker": return <ActionButton button="filePicker"
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
                    </View>
                </View>
                {
                    openPanel.kind === "insert" && <Animated.View entering={ FadeIn.duration(160) }
                        exiting={ FadeOut.duration(120) }
                        style={ panelStyle }>
                        <Text accessibilityRole="header"
                            style={ panelTitleStyle }>{ t("insertPanel.title") }</Text>
                        <ScrollView contentContainerStyle={ styles.panelScrollContent }
                            keyboardShouldPersistTaps="always"
                            showsVerticalScrollIndicator={ false }
                            style={ styles.panelScroll }>
                            <View style={ styles.blockGrid }>
                                <BlockOption background={ cardBackground }
                                    button="text"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.text") }
                                    labelColor={ foreground }
                                    onPress={ handleSplit } />
                                {
                                    onCreatePageReference !== undefined && <BlockOption
                                        background={ cardBackground }
                                        button="linkToPage"
                                        color={ iconColor }
                                        components={ components }
                                        grid
                                        label={ t("insertPanel.pageReference") }
                                        labelColor={ foreground }
                                        onPress={ handleCreatePageReference } />
                                }
                                <BlockOption background={ cardBackground }
                                    button="divider"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.divider") }
                                    labelColor={ foreground }
                                    onPress={ handleDivider } />
                                <BlockOption background={ cardBackground }
                                    button="tableOfContents"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.tableOfContents") }
                                    labelColor={ foreground }
                                    onPress={ handleTableOfContents } />
                                { ([ 2, 3, 4, 5 ] as const).map((columnCount: ProofColumnCount) =>
                                    <BlockOption background={ cardBackground }
                                        button="columns"
                                        color={ iconColor }
                                        components={ components }
                                        grid
                                        key={ columnCount }
                                        label={ columnLabels[ columnCount ] }
                                        labelColor={ foreground }
                                        onPress={ handleColumns(columnCount) } />
                                ) }
                                <BlockOption background={ cardBackground }
                                    button="toDo"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.toDo") }
                                    labelColor={ foreground }
                                    onPress={ handleToDo } />
                                <BlockOption background={ cardBackground }
                                    button="callout"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.callout") }
                                    labelColor={ foreground }
                                    onPress={ handleCallout } />
                                <BlockOption background={ cardBackground }
                                    button="heading1"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.heading1") }
                                    labelColor={ foreground }
                                    onPress={ handleHeading1 } />
                                <BlockOption background={ cardBackground }
                                    button="heading2"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.heading2") }
                                    labelColor={ foreground }
                                    onPress={ handleHeading2 } />
                                <BlockOption background={ cardBackground }
                                    button="heading3"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.heading3") }
                                    labelColor={ foreground }
                                    onPress={ handleHeading3 } />
                                <BlockOption background={ cardBackground }
                                    button="heading4"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.heading4") }
                                    labelColor={ foreground }
                                    onPress={ handleHeading4 } />
                                <BlockOption background={ cardBackground }
                                    button="toggleHeading1"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.toggleHeading1") }
                                    labelColor={ foreground }
                                    onPress={ handleToggleHeading1 } />
                                <BlockOption background={ cardBackground }
                                    button="toggleHeading2"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.toggleHeading2") }
                                    labelColor={ foreground }
                                    onPress={ handleToggleHeading2 } />
                                <BlockOption background={ cardBackground }
                                    button="toggleHeading3"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.toggleHeading3") }
                                    labelColor={ foreground }
                                    onPress={ handleToggleHeading3 } />
                                <BlockOption background={ cardBackground }
                                    button="toggleHeading4"
                                    color={ iconColor }
                                    components={ components }
                                    grid
                                    label={ t("insertPanel.toggleHeading4") }
                                    labelColor={ foreground }
                                    onPress={ handleToggleHeading4 } />
                            </View>
                        </ScrollView>
                        {/* <BlockOption background={ cardBackground }
                            button="returnToKeyboard"
                            color={ iconColor }
                            components={ components }
                            fullWidth
                            label={ t("insertPanel.returnToKeyboard") }
                            labelColor={ foreground }
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
                                labelColor={ foreground }
                                onPress={ handleTurnInto("text") } />
                            <BlockOption background={ cardBackground }
                                button="heading1"
                                color={ iconColor }
                                components={ components }
                                disabled={ !allowedTurnIntoTypes.has("heading_1") }
                                label={ t("insertPanel.heading1") }
                                labelColor={ foreground }
                                onPress={ handleTurnInto("heading_1") } />
                        </View>
                        <View style={ styles.blockRow }>
                            <BlockOption background={ cardBackground }
                                button="heading2"
                                color={ iconColor }
                                components={ components }
                                disabled={ !allowedTurnIntoTypes.has("heading_2") }
                                label={ t("insertPanel.heading2") }
                                labelColor={ foreground }
                                onPress={ handleTurnInto("heading_2") } />
                            <BlockOption background={ cardBackground }
                                button="heading3"
                                color={ iconColor }
                                components={ components }
                                disabled={ !allowedTurnIntoTypes.has("heading_3") }
                                label={ t("insertPanel.heading3") }
                                labelColor={ foreground }
                                onPress={ handleTurnInto("heading_3") } />
                        </View>
                        <BlockOption background={ cardBackground }
                            button="heading4"
                            color={ iconColor }
                            components={ components }
                            disabled={ !allowedTurnIntoTypes.has("heading_4") }
                            fullWidth
                            label={ t("insertPanel.heading4") }
                            labelColor={ foreground }
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
                                options={ proofColorOptions.filter(
                                    (option: ProofColorOption) => !option.background
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
                                options={ proofColorOptions.filter(
                                    (option: ProofColorOption) => option.background
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
                linkSheetVisible && linkRequest !== undefined && <LinkBottomSheet
                    dark={ dark }
                    initialLabel={ linkRequest.label }
                    initialUrl={ linkRequest.url }
                    labels={ linkLabels }
                    onDismiss={ () => handleLinkResult(undefined) }
                    onSubmit={ handleLinkResult } />
            }
        </View>
    );
}

const styles = StyleSheet.create({
    blockGrid:
    {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8
    },
    blockOption:
    {
        alignItems: "center",
        borderRadius: 10,
        flexDirection: "row",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 14
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
        /* Explicit on both sides (rather than relying on the toolbar's own padding for the
           right edge) so the button sits evenly centered between the divider and the edge. */
        borderLeftWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 6
    }
});
