/**
 * A ready-made {@link NotionEditorComponents} set backed by `lucide-react-native`.
 *
 * This lives in its own module, deliberately never imported by `editor/ui`'s main entry point
 * (`index.ts`), so that Metro only needs to resolve the optional `lucide-react-native` peer for
 * consumers who import this file specifically. The toolbar cannot auto-detect and load an
 * optional peer: Metro resolves every `require`/`import` specifier at build time, so a
 * statically visible import of `lucide-react-native` in a module every consumer touches would
 * force all of them to install it, regardless of a runtime `try`/`catch`. Importing this file is
 * the opt-in -- do it only from an app that actually declares `lucide-react-native` as a
 * dependency.
 *
 * @module react-native-notion-markdown/editor/ui/lucideIcons
 *
 * @file      lucideIcons.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import {
    ArrowDownFromLine,
    ArrowLeft,
    ArrowUpFromLine,
    Bold,
    Camera,
    CaseSensitive,
    Check,
    CircleX,
    ClipboardPaste,
    Code2,
    Columns2,
    Copy,
    Eraser,
    FileText,
    Heading1,
    Heading2,
    Heading3,
    Heading4,
    Image,
    IndentDecrease,
    IndentIncrease,
    Italic,
    Keyboard,
    KeyboardOff,
    Link2,
    List,
    ListChecks,
    ListOrdered,
    MessageSquare,
    Mic,
    MoreHorizontal,
    Palette,
    Pause,
    Pencil,
    Play,
    Plus,
    Quote,
    Redo2,
    Repeat,
    Scissors,
    SeparatorHorizontal,
    Square,
    SquarePlay,
    Strikethrough,
    TableOfContents,
    Trash2,
    Type,
    Underline,
    Undo2
} from "lucide-react-native";
import { type ComponentType, createElement } from "react";
import { Line, Rect, Svg } from "react-native-svg";
import { StyleSheet, View } from "react-native";
// The type-only relative import is intentionally kept after the runtime dependencies.
// eslint-disable-next-line sort-imports
import { type NotionEditorComponents, type NotionEditorIconProps } from "./NotionEditor.tsx";

const toggleHeadingIconStyles = StyleSheet.create({
    root:
    {
        alignItems: "center",
        flexDirection: "row",
        height: 22,
        justifyContent: "flex-start",
        width: 22
    }
});

/** Compose a small disclosure triangle with one of the regular heading icons. */
function createToggleHeadingIcon(
    HeadingIcon: ComponentType<NotionEditorIconProps>
): ComponentType<NotionEditorIconProps>
{
    /** Render a composed toggle-heading icon. */
    function ToggleHeadingIcon({ color, size, strokeWidth }: NotionEditorIconProps)
    {
        return createElement(
            View,
            { style: toggleHeadingIconStyles.root },
            [
                createElement(Play, {
                    color,
                    fill: color,
                    key: "disclosure",
                    size: size * 0.32,
                    strokeWidth
                }),
                createElement(HeadingIcon, {
                    color,
                    key: "heading",
                    size: size * 0.78,
                    strokeWidth
                })
            ]
        );
    }

    return ToggleHeadingIcon;
}

const ToggleHeading1 = createToggleHeadingIcon(Heading1);
const ToggleHeading2 = createToggleHeadingIcon(Heading2);
const ToggleHeading3 = createToggleHeadingIcon(Heading3);
const ToggleHeading4 = createToggleHeadingIcon(Heading4);

/** Create a columns icon with a bar for each column, while retaining Lucide's rounded-square shape. */
function createColumnsIcon(columnCount: 2 | 3 | 4 | 5): ComponentType<NotionEditorIconProps>
{
    const bars: Array<number> = Array.from(
        { length: columnCount - 1 },
        (_value: unknown, index: number): number =>
            3 + (18 * (index + 1)) / columnCount
    );

    /** Render a count-specific columns icon. */
    function ColumnsIcon({ color, size, strokeWidth }: NotionEditorIconProps)
    {
        return createElement(
            Svg,
            { height: size, viewBox: "0 0 24 24", width: size },
            [
                createElement(Rect, {
                    fill: "none",
                    height: "18",
                    key: "frame",
                    rx: "2",
                    stroke: color,
                    strokeWidth,
                    width: "18",
                    x: "3",
                    y: "3"
                }),
                ...bars.map((x: number, index: number) => createElement(Line, {
                    key: index,
                    stroke: color,
                    strokeLinecap: "round",
                    strokeWidth,
                    x1: x,
                    x2: x,
                    y1: "6",
                    y2: "18"
                }))
            ]
        );
    }

    return ColumnsIcon;
}

const Columns2Icon = createColumnsIcon(2);
const Columns3Icon = createColumnsIcon(3);
const Columns4Icon = createColumnsIcon(4);
const Columns5Icon = createColumnsIcon(5);

export/**
       * Pass this to `NotionEditor`'s `components` prop for icon buttons instead of plain text labels.
       *
       * @since 1.0.0
       */
const notionEditorLucideIcons: NotionEditorComponents =
    {
        back: ArrowLeft,
        bold: Bold,
        bulletedList: List,
        callout: MessageSquare,
        cancel: CircleX,
        check: Check,
        close: CircleX,
        code: Code2,
        color: Palette,
        columns: Columns2,
        columns2: Columns2Icon,
        columns3: Columns3Icon,
        columns4: Columns4Icon,
        columns5: Columns5Icon,
        copy: Copy,
        cut: Scissors,
        divider: SeparatorHorizontal,
        edit: Pencil,
        eraseFormatting: Eraser,
        filePicker: FileText,
        format: CaseSensitive,
        gallery: Image,
        heading1: Heading1,
        heading2: Heading2,
        heading3: Heading3,
        heading4: Heading4,
        hideKeyboard: KeyboardOff,
        indent: IndentIncrease,
        insert: Plus,
        italic: Italic,
        link: Link2,
        linkToPage: Link2,
        more: MoreHorizontal,
        moveDown: ArrowDownFromLine,
        moveUp: ArrowUpFromLine,
        numberedList: ListOrdered,
        outdent: IndentDecrease,
        paste: ClipboardPaste,
        pause: Pause,
        picture: Camera,
        play: Play,
        quote: Quote,
        record: Mic,
        redo: Redo2,
        remove: Trash2,
        returnToKeyboard: Keyboard,
        speech: Mic,
        stop: Square,
        strikethrough: Strikethrough,
        tableOfContents: TableOfContents,
        text: Type,
        toDo: ListChecks,
        toggleHeading1: ToggleHeading1,
        toggleHeading2: ToggleHeading2,
        toggleHeading3: ToggleHeading3,
        toggleHeading4: ToggleHeading4,
        turnInto: Repeat,
        underline: Underline,
        undo: Undo2,
        video: SquarePlay
    };
