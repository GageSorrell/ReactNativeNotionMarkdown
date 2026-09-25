/**
 * Customization types and built-in defaults for the "batteries included" editor: icons, toolbar
 * composition, custom buttons and panels, the insert/turn-into/color panels, and page layout.
 * Every field of {@link MarkdownEditorConfig} can be set app-wide on `MarkdownProvider`'s `editor`
 * prop, or per instance as a `MarkdownEditor` prop of the same name.
 *
 * @module react-native-notion-markdown/editor/ui/customization
 *
 * @file      customization.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import {
    type MarkdownColorName,
    type MarkdownEditorTheme,
    type MarkdownTheme,
    markdownColorNames
} from "../../provider/theme.ts";
import type { ComponentType } from "react";
import type { EditorBlock } from "../../prototype.ts";
import type { MarkdownColor } from "../../document/types.ts";
import type { MarkdownMessageId } from "../../provider/messages.ts";
import type { MarkdownTranslateById } from "../../provider/MarkdownProvider.tsx";

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
 * Per-button icon overrides. Toolbar buttons with no entry fall back to a plain text label. The
 * built-in sheets use these overrides first, then the optional Lucide peer, then a dependency-free
 * SVG fallback. Import `markdownEditorLucideIcons` from
 * `react-native-notion-markdown/editor/ui/lucide-icons` for a ready-made set.
 *
 * @since 1.0.0
 */
export type MarkdownEditorIcons =
    Partial<Record<MarkdownEditorButton, ComponentType<MarkdownEditorIconProps>>>;

/**
 * Ids of the built-in buttons that can appear in the main toolbar row. `color` only shows while
 * text that can be colored is selected, `edit` only while a page reference is selected (and
 * `onEditPageReference` is supplied), `redo` only once an undo has made a redo available, and
 * `moveUp`/`moveDown` only when the selected block(s) can move that way.
 *
 * @since 1.0.0
 */
export type MarkdownEditorMainToolbarItem =
    | "color"
    | "insert"
    | "format"
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
    | "copy"
    | "cut"
    | "paste"
    | "edit";

/**
 * Ids of the built-in buttons that can appear in the text-formatting toolbar row. The row's
 * leading "Back" button is always shown and is not listed here.
 *
 * @since 1.0.0
 */
export type MarkdownEditorFormatToolbarItem =
    | "bold"
    | "italic"
    | "strikethrough"
    | "underline"
    | "code"
    | "link"
    | "eraseFormatting";

/**
 * The ordered contents of each toolbar row. Each entry is a built-in id or a
 * {@link MarkdownEditorCustomButton}'s `id`; leaving an id out hides that button.
 *
 * @since 1.0.0
 */
export interface MarkdownEditorToolbar
{
    readonly main?: ReadonlyArray<MarkdownEditorMainToolbarItem | (string & Record<never, never>)>;
    readonly format?: ReadonlyArray<MarkdownEditorFormatToolbarItem | (string & Record<never, never>)>;
}

/**
 * Theme and control values handed to a {@link MarkdownEditorCustomPanel}'s `render` component, so
 * custom panel content can match the editor's theme and close the panel the same way the built-in
 * panels do.
 *
 * @since 1.0.0
 */
export interface MarkdownEditorCustomPanelContext
{
    /** Closes this panel and refocuses the native keyboard. */
    readonly close: () => void;

    /** The resolved theme for the current color scheme; \`theme.editor.panel\` styles panels. */
    readonly theme: MarkdownTheme;
}

/**
 * A panel that replaces the on-screen keyboard while its owning {@link MarkdownEditorCustomButton}
 * is active -- the custom equivalent of the built-in insert panel.
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

interface MarkdownEditorCustomButtonBase
{
    /** Icon for this button. Omit for a plain text label, matching the built-in buttons. */
    readonly icon?: ComponentType<MarkdownEditorIconProps>;

    /** Unique id for this button, listed in {@link MarkdownEditorToolbar} to position it. */
    readonly id: string;

    /** Accessibility label, and the visible label when there is no icon. */
    readonly label: string;
}

/**
 * A consumer-supplied toolbar button. List its `id` in `toolbar.main` or `toolbar.format` to
 * position it; a custom button listed in neither row is appended to the end of the main row.
 * Supply either `onPress` for a plain action button, or `panel` to pair the button with a
 * {@link MarkdownEditorCustomPanel}: pressing it then opens that panel in place of the on-screen
 * keyboard, and the button is highlighted the way the built-in "Insert" button is while its panel
 * is open.
 *
 * @since 1.0.0
 */
export type MarkdownEditorCustomButton =
    MarkdownEditorCustomButtonBase
    & (
        | { readonly onPress: () => void; readonly panel?: undefined }
        | { readonly onPress?: undefined; readonly panel: MarkdownEditorCustomPanel }
    );

/**
 * Ids of the built-in insert-panel options.
 *
 * @since 1.0.0
 */
export type MarkdownEditorInsertItem =
    | "text"
    | "heading1"
    | "heading2"
    | "heading3"
    | "heading4"
    | "bulletedList"
    | "numberedList"
    | "toDo"
    | "toggleList"
    | "callout"
    | "quote"
    | "table"
    | "divider"
    | "pageReference"
    | "columns2"
    | "columns3"
    | "columns4"
    | "columns5"
    | "image"
    | "video"
    | "audio"
    | "code"
    | "file"
    | "link"
    | "tableOfContents"
    | "blockEquation"
    | "syncedBlock"
    | "toggleHeading1"
    | "toggleHeading2"
    | "toggleHeading3"
    | "toggleHeading4"
    | "mermaidDiagram";

/**
 * Values handed to a {@link MarkdownEditorCustomInsertItem}'s `onPress`.
 *
 * @since 1.0.0
 */
export interface MarkdownEditorInsertContext
{
    /** Closes the insert panel and refocuses the native keyboard. */
    readonly close: () => void;
}

/**
 * A consumer-supplied insert-panel option.
 *
 * @since 1.0.0
 */
export interface MarkdownEditorCustomInsertItem
{
    readonly icon?: ComponentType<MarkdownEditorIconProps>;
    readonly id: string;
    readonly label: string;
    readonly onPress: (context: MarkdownEditorInsertContext) => void;
}

/**
 * One titled section of the insert panel.
 *
 * @since 1.0.0
 */
export interface MarkdownEditorInsertSection
{
    readonly id: string;

    /**
     * The section heading. A {@link MarkdownMessageId} is translated through the provider's
     * localization; any other string is shown as-is.
     */
    readonly title: MarkdownMessageId | (string & Record<never, never>);
    readonly items: ReadonlyArray<MarkdownEditorInsertItem | MarkdownEditorCustomInsertItem>;
}

/**
 * The insert panel's sections, in order.
 *
 * @since 1.0.0
 */
export interface MarkdownEditorInsertPanel
{
    readonly sections?: ReadonlyArray<MarkdownEditorInsertSection>;
}

/**
 * Block types the turn-into panel can convert the selection to.
 *
 * @since 1.0.0
 */
export type MarkdownEditorTurnIntoItem = Extract<EditorBlock["type"],
    "text" | "heading_1" | "heading_2" | "heading_3" | "heading_4"
    | "bulleted_list_item" | "numbered_list_item" | "to_do" | "toggle" | "code" | "quote"
    | "callout" | "equation" | "synced_block">
    | "toggle_heading_1" | "toggle_heading_2" | "toggle_heading_3" | "toggle_heading_4"
    | "columns2" | "columns3" | "columns4" | "columns5";

/**
 * The turn-into panel's options, in order.
 *
 * @since 1.0.0
 */
export interface MarkdownEditorTurnIntoPanel
{
    readonly items?: ReadonlyArray<MarkdownEditorTurnIntoItem>;
}

/**
 * The hues offered by the editor's color pickers -- the selection color panel and the callout and
 * table color pickers. Swatch colors come from the theme's palette.
 *
 * @since 1.0.0
 */
export interface MarkdownEditorColorPanel
{
    /** Text-color hues, in order. */
    readonly text?: ReadonlyArray<MarkdownColorName>;

    /** Background-color hues, in order. */
    readonly background?: ReadonlyArray<MarkdownColorName>;

    /** Whether a "Default" option that clears the color leads each section. */
    readonly showDefault?: boolean;
}

/**
 * Page layout of the WYSIWYG surface. The toolbar is not affected.
 *
 * @since 1.0.0
 */
export interface MarkdownEditorLayout
{
    /** Horizontal inset applied to the page content. */
    readonly pagePaddingHorizontal?: number;

    /** Maximum width of the centered page content. */
    readonly pageMaxWidth?: number;

    /** Maximum rendered width of image and video blocks. */
    readonly imageMaxWidth?: number;
}

/**
 * Every configurable aspect of the "batteries included" editor. Set app-wide through
 * `MarkdownProvider`'s `editor` prop, or per instance as `MarkdownEditor` props of the same names.
 * A prop's object-valued field merges key by key over the provider's; any other value replaces it.
 *
 * @since 1.0.0
 */
export interface MarkdownEditorConfig
{
    readonly icons?: MarkdownEditorIcons;
    readonly toolbar?: MarkdownEditorToolbar;
    readonly customButtons?: ReadonlyArray<MarkdownEditorCustomButton>;
    readonly insertPanel?: MarkdownEditorInsertPanel;
    readonly turnIntoPanel?: MarkdownEditorTurnIntoPanel;
    readonly colorPanel?: MarkdownEditorColorPanel;
    readonly layout?: MarkdownEditorLayout;

    /** Glyph drawn beside a page reference that has no fetched page icon. */
    readonly pageReferenceFallbackGlyph?: string;
}

export/**
       * The built-in toolbar rows.
       *
       * @since 1.0.0
       */
const defaultMarkdownEditorToolbar: Required<MarkdownEditorToolbar> =
    {
        format: [ "bold", "italic", "strikethrough", "underline", "code", "link", "eraseFormatting" ],
        main: [
            "color", "insert", "format", "speech", "filePicker", "turnInto", "undo", "redo", "remove",
            "indent", "outdent", "moveUp", "moveDown", "edit"
        ]
    };

export/**
       * The built-in insert-panel sections.
       *
       * @since 1.0.0
       */
const defaultMarkdownEditorInsertSections: ReadonlyArray<MarkdownEditorInsertSection> =
    [
        {
            id: "basic",
            items: [
                "text", "heading1", "heading2", "heading3", "heading4", "bulletedList", "numberedList",
                "toDo", "toggleList", "callout", "quote", "table", "divider", "pageReference",
                "columns2", "columns3", "columns4", "columns5"
            ],
            title: "insertPanel.title"
        },
        {
            id: "media",
            items: [ "image", "video", "audio", "code", "file", "link" ],
            title: "insertPanel.mediaTitle"
        },
        {
            id: "advanced",
            items: [
                "tableOfContents", "blockEquation", "syncedBlock", "toggleHeading1", "toggleHeading2",
                "toggleHeading3", "toggleHeading4", "mermaidDiagram"
            ],
            title: "insertPanel.advancedTitle"
        }
    ];

export/**
       * The built-in turn-into options.
       *
       * @since 1.0.0
       */
const defaultMarkdownEditorTurnIntoItems: ReadonlyArray<MarkdownEditorTurnIntoItem> =
    [
        "text", "heading_1", "heading_2", "heading_3", "heading_4", "bulleted_list_item",
        "numbered_list_item", "to_do", "toggle", "code", "quote", "callout", "equation",
        "synced_block", "toggle_heading_1", "toggle_heading_2", "toggle_heading_3", "toggle_heading_4",
        "columns2", "columns3", "columns4", "columns5"
    ];

/**
 * One option in an editor color picker. `hue` is `undefined` for the "Default" option, which
 * clears the color.
 *
 * @internal
 */
export interface EditorColorChoice
{
    readonly background: boolean;
    readonly color: MarkdownColor | undefined;
    readonly hue: MarkdownColorName | undefined;
    readonly label: string;
}

/**
 * Build the text and background sections of an editor color picker from the configured hues, with
 * each option's label translated.
 *
 * @internal
 */
export function editorColorChoices(
    colorPanel: MarkdownEditorColorPanel | undefined,
    t: MarkdownTranslateById,
    defaultLabel: string
): { readonly background: ReadonlyArray<EditorColorChoice>; readonly text: ReadonlyArray<EditorColorChoice> }
{
    const showDefault = colorPanel?.showDefault ?? true;
    const section = (
        hues: ReadonlyArray<MarkdownColorName>,
        background: boolean
    ): Array<EditorColorChoice> => [
        ...(showDefault
            ? [ { background, color: undefined, hue: undefined, label: defaultLabel } ]
            : [ ]),
        ...hues.map((hue: MarkdownColorName): EditorColorChoice => ({
            background,
            color: (background ? `${ hue }_bg` : hue) as MarkdownColor,
            hue,
            label: t(background ? `color.${ hue }Background` : `color.${ hue }`)
        }))
    ];

    return {
        background: section(colorPanel?.background ?? markdownColorNames, true),
        text: section(colorPanel?.text ?? markdownColorNames, false)
    };
}

/**
 * The text style carrying the editor UI's font family. A `null` family uses the system font.
 *
 * @internal
 */
export function editorFontStyle(theme: MarkdownEditorTheme): { readonly fontFamily?: string }
{
    return theme.fontFamily === null ? { } : { fontFamily: theme.fontFamily };
}

/** Where a toolbar id resolved to: a built-in button, or a custom button. */
export type ResolvedToolbarItem<Builtin extends string> =
    | { readonly kind: "builtin"; readonly id: Builtin }
    | { readonly kind: "custom"; readonly button: MarkdownEditorCustomButton };

/**
 * Resolve one toolbar row's ordered ids to the buttons to render. Ids naming a custom button
 * resolve to it (a custom button whose id collides with a built-in replaces the built-in); other
 * known built-in ids resolve to themselves; unknown ids and repeats are dropped. When
 * `appendUnlisted` is set, custom buttons listed in neither row are appended in declaration order.
 *
 * @since 1.0.0
 */
export function resolveToolbarItems<Builtin extends string>(
    list: ReadonlyArray<string>,
    builtins: ReadonlyArray<Builtin>,
    customButtons: ReadonlyArray<MarkdownEditorCustomButton>,
    options?: { readonly appendUnlisted?: boolean; readonly otherRows?: ReadonlyArray<ReadonlyArray<string>> }
): Array<ResolvedToolbarItem<Builtin>>
{
    const customById = new Map<string, MarkdownEditorCustomButton>();
    customButtons.forEach((button: MarkdownEditorCustomButton) => customById.set(button.id, button));

    const seen = new Set<string>();
    const resolved: Array<ResolvedToolbarItem<Builtin>> = [ ];
    const add = (id: string): void =>
    {
        if (seen.has(id))
        {
            return;
        }
        const custom = customById.get(id);
        if (custom !== undefined)
        {
            seen.add(id);
            resolved.push({ button: custom, kind: "custom" });
        }
        else if ((builtins as ReadonlyArray<string>).includes(id))
        {
            seen.add(id);
            resolved.push({ id: id as Builtin, kind: "builtin" });
        }
    };

    list.forEach(add);

    if (options?.appendUnlisted === true)
    {
        const listedElsewhere = new Set((options.otherRows ?? [ ]).flat());
        customById.forEach((_button: MarkdownEditorCustomButton, id: string) =>
        {
            if (!listedElsewhere.has(id))
            {
                add(id);
            }
        });
    }

    return resolved;
}
