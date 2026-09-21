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
    ArrowLeft,
    Bold,
    Camera,
    CaseSensitive,
    CircleX,
    ClipboardPaste,
    Code2,
    Columns2,
    Copy,
    Eraser,
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
    ListChecks,
    MessageSquare,
    Mic,
    MoreHorizontal,
    MoveDown,
    MoveUp,
    Palette,
    Pencil,
    Play,
    Plus,
    Quote,
    Redo2,
    Repeat,
    Scissors,
    SeparatorHorizontal,
    SquarePlay,
    Strikethrough,
    TableOfContents,
    Trash2,
    Type,
    Underline,
    Undo2
} from "lucide-react-native";
import type { NotionEditorComponents, NotionEditorIconProps } from "./NotionEditor.tsx";
import { StyleSheet, View } from "react-native";
import type { ComponentType } from "react";
import { createElement } from "react";

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

export/**
       * Pass this to `NotionEditor`'s `components` prop for icon buttons instead of plain text labels.
       *
       * @since 1.0.0
       */
const notionEditorLucideIcons: NotionEditorComponents =
    {
        back: ArrowLeft,
        bold: Bold,
        callout: MessageSquare,
        close: CircleX,
        code: Code2,
        color: Palette,
        columns: Columns2,
        copy: Copy,
        cut: Scissors,
        divider: SeparatorHorizontal,
        edit: Pencil,
        eraseFormatting: Eraser,
        filePicker: Image,
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
        moveDown: MoveDown,
        moveUp: MoveUp,
        more: MoreHorizontal,
        outdent: IndentDecrease,
        paste: ClipboardPaste,
        picture: Camera,
        quote: Quote,
        redo: Redo2,
        remove: Trash2,
        returnToKeyboard: Keyboard,
        speech: Mic,
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
