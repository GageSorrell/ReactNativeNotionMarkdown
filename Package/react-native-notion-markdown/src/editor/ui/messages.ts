/**
 * The canonical set of UI message identifiers and default English text for the editor. Consuming
 * applications translate these through {@link NotionEditorConfigProvider} rather than the package
 * depending on any particular i18n framework.
 *
 * @module react-native-notion-markdown/editor/ui/messages
 *
 * @file      messages.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Stable identifier for a translatable editor UI string.
 *
 * @since 1.0.0
 */
export type EditorMessageId =
    | "toolbar.back"
    | "toolbar.close"
    | "toolbar.insert"
    | "toolbar.color"
    | "toolbar.format"
    | "toolbar.bold"
    | "toolbar.italic"
    | "toolbar.strikethrough"
    | "toolbar.underline"
    | "toolbar.code"
    | "toolbar.eraseFormatting"
    | "toolbar.link"
    | "toolbar.speech"
    | "toolbar.filePicker"
    | "toolbar.turnInto"
    | "toolbar.undo"
    | "toolbar.redo"
    | "toolbar.remove"
    | "toolbar.indent"
    | "toolbar.outdent"
    | "toolbar.moveUp"
    | "toolbar.moveDown"
    | "toolbar.copy"
    | "toolbar.cut"
    | "toolbar.paste"
    | "toolbar.edit"
    | "toolbar.hideKeyboard"
    | "colorPanel.foreground"
    | "colorPanel.background"
    | "colorPanel.default"
    | "mediaSheet.title"
    | "mediaSheet.openGallery"
    | "mediaSheet.takePicture"
    | "mediaSheet.captureVideo"
    | "linkSheet.title"
    | "linkSheet.url"
    | "linkSheet.label"
    | "linkSheet.cancel"
    | "linkSheet.apply"
    | "insertPanel.title"
    | "insertPanel.columns"
    | "insertPanel.columns2"
    | "insertPanel.columns3"
    | "insertPanel.columns4"
    | "insertPanel.columns5"
    | "insertPanel.text"
    | "insertPanel.divider"
    | "insertPanel.tableOfContents"
    | "insertPanel.toDo"
    | "insertPanel.pageReference"
    | "insertPanel.heading1"
    | "insertPanel.heading2"
    | "insertPanel.heading3"
    | "insertPanel.heading4"
    | "insertPanel.toggleHeading1"
    | "insertPanel.toggleHeading2"
    | "insertPanel.toggleHeading3"
    | "insertPanel.toggleHeading4"
    | "insertPanel.returnToKeyboard"
    | "turnIntoPanel.title";

/**
 * A single translatable message: a stable id, its English default, and optional translator
 * context.
 *
 * @since 1.0.0
 */
export interface NotionEditorMessageDescriptor
{
    readonly id: EditorMessageId;
    readonly defaultMessage: string;
    readonly description?: string;
}

/**
 * Resolves a message descriptor to display text, optionally interpolating `Values`. Supplied by
 * the host application -- see {@link NotionEditorConfigProvider}.
 *
 * @since 1.0.0
 */
export type NotionEditorTranslate = (
    Message: NotionEditorMessageDescriptor,
    Values?: Readonly<Record<string, string | number>>
) => string;

export/**
       * The package's canonical English message catalog. Every {@link EditorMessageId} used by
       * the editor UI has an entry here.
       *
       * @since 1.0.0
       */
const defaultEditorMessages: Readonly<Record<EditorMessageId, NotionEditorMessageDescriptor>> =
    {
        "colorPanel.background":
        {
            defaultMessage: "Background color",
            description: "Section heading for background colors in the color panel",
            id: "colorPanel.background"
        },
        "colorPanel.default":
        {
            defaultMessage: "Default",
            description: "Accessibility label for clearing a selected color",
            id: "colorPanel.default"
        },
        "colorPanel.foreground":
        {
            defaultMessage: "Foreground color",
            description: "Section heading for foreground colors in the color panel",
            id: "colorPanel.foreground"
        },
        "insertPanel.columns":
        {
            defaultMessage: "Columns",
            description: "Legacy insert-panel label for the column block",
            id: "insertPanel.columns"
        },
        "insertPanel.columns2":
        {
            defaultMessage: "2 columns",
            description: "Insert-panel button that inserts a two-column block",
            id: "insertPanel.columns2"
        },
        "insertPanel.columns3":
        {
            defaultMessage: "3 columns",
            description: "Insert-panel button that inserts a three-column block",
            id: "insertPanel.columns3"
        },
        "insertPanel.columns4":
        {
            defaultMessage: "4 columns",
            description: "Insert-panel button that inserts a four-column block",
            id: "insertPanel.columns4"
        },
        "insertPanel.columns5":
        {
            defaultMessage: "5 columns",
            description: "Insert-panel button that inserts a five-column block",
            id: "insertPanel.columns5"
        },
        "insertPanel.divider":
        {
            defaultMessage: "Divider",
            description: "Insert-panel button that inserts a divider block",
            id: "insertPanel.divider"
        },
        "insertPanel.heading1":
        {
            defaultMessage: "Heading 1",
            description: "Insert-panel button that inserts a heading 1 block",
            id: "insertPanel.heading1"
        },
        "insertPanel.heading2":
        {
            defaultMessage: "Heading 2",
            description: "Insert-panel button that inserts a heading 2 block",
            id: "insertPanel.heading2"
        },
        "insertPanel.heading3":
        {
            defaultMessage: "Heading 3",
            description: "Insert-panel button that inserts a heading 3 block",
            id: "insertPanel.heading3"
        },
        "insertPanel.heading4":
        {
            defaultMessage: "Heading 4",
            description: "Insert-panel button that inserts a heading 4 block",
            id: "insertPanel.heading4"
        },
        "insertPanel.text":
        {
            defaultMessage: "Text block",
            description: "Insert-panel button that inserts a plain text block",
            id: "insertPanel.text"
        },
        "insertPanel.pageReference":
        {
            defaultMessage: "Page",
            description: "Insert-panel button that requests creation of a page reference",
            id: "insertPanel.pageReference"
        },
        "insertPanel.returnToKeyboard":
        {
            defaultMessage: "Return to keyboard",
            description: "Full-width insert-panel button that closes the panel and refocuses the keyboard",
            id: "insertPanel.returnToKeyboard"
        },
        "insertPanel.tableOfContents":
        {
            defaultMessage: "Table of contents",
            description: "Insert-panel button that inserts a table of contents block",
            id: "insertPanel.tableOfContents"
        },
        "insertPanel.title":
        {
            defaultMessage: "Insert a block",
            description: "Header title of the block-insert panel",
            id: "insertPanel.title"
        },
        "insertPanel.toDo":
        {
            defaultMessage: "To-do",
            description: "Insert-panel button that inserts a to-do block",
            id: "insertPanel.toDo"
        },
        "insertPanel.toggleHeading1":
        {
            defaultMessage: "Toggle Header 1",
            description: "Insert-panel button that inserts a toggle heading 1 block",
            id: "insertPanel.toggleHeading1"
        },
        "insertPanel.toggleHeading2":
        {
            defaultMessage: "Toggle Header 2",
            description: "Insert-panel button that inserts a toggle heading 2 block",
            id: "insertPanel.toggleHeading2"
        },
        "insertPanel.toggleHeading3":
        {
            defaultMessage: "Toggle Header 3",
            description: "Insert-panel button that inserts a toggle heading 3 block",
            id: "insertPanel.toggleHeading3"
        },
        "insertPanel.toggleHeading4":
        {
            defaultMessage: "Toggle Header 4",
            description: "Insert-panel button that inserts a toggle heading 4 block",
            id: "insertPanel.toggleHeading4"
        },
        "mediaSheet.captureVideo":
        {
            defaultMessage: "Capture Video",
            description: "Button that opens the camera in video-recording mode",
            id: "mediaSheet.captureVideo"
        },
        "mediaSheet.openGallery":
        {
            defaultMessage: "Open Gallery",
            description: "Button that opens the device media gallery",
            id: "mediaSheet.openGallery"
        },
        "mediaSheet.takePicture":
        {
            defaultMessage: "Take Picture",
            description: "Button that opens the camera in picture mode",
            id: "mediaSheet.takePicture"
        },
        "mediaSheet.title":
        {
            defaultMessage: "Insert Media",
            description: "Header title of the insert-media bottom sheet",
            id: "mediaSheet.title"
        },
        "linkSheet.apply":
        {
            defaultMessage: "Apply",
            description: "Submits the link URL and optional label",
            id: "linkSheet.apply"
        },
        "linkSheet.cancel":
        {
            defaultMessage: "Cancel",
            description: "Dismisses the link URL modal",
            id: "linkSheet.cancel"
        },
        "linkSheet.label":
        {
            defaultMessage: "Text",
            description: "Label field in the link URL modal",
            id: "linkSheet.label"
        },
        "linkSheet.title":
        {
            defaultMessage: "Add link",
            description: "Title of the link URL modal",
            id: "linkSheet.title"
        },
        "linkSheet.url":
        {
            defaultMessage: "URL",
            description: "URL field in the link URL modal",
            id: "linkSheet.url"
        },
        "toolbar.back":
        {
            defaultMessage: "Back",
            description: "Returns from text-formatting mode to the main toolbar",
            id: "toolbar.back"
        },
        "toolbar.bold":
        {
            defaultMessage: "Bold",
            description: "Applies or removes bold formatting from the selected text",
            id: "toolbar.bold"
        },
        "toolbar.close":
        {
            defaultMessage: "Close panel",
            description: "Closes the currently open toolbar panel (e.g. the block-insert panel)",
            id: "toolbar.close"
        },
        "toolbar.code":
        {
            defaultMessage: "Inline code",
            description: "Applies or removes inline code formatting from the selected text",
            id: "toolbar.code"
        },
        "toolbar.color":
        {
            defaultMessage: "Color",
            description: "Opens the color panel for the selected colorable block(s)",
            id: "toolbar.color"
        },
        "toolbar.copy":
        {
            defaultMessage: "Copy",
            description: "Copies the current selection",
            id: "toolbar.copy"
        },
        "toolbar.cut":
        {
            defaultMessage: "Cut",
            description: "Cuts the current selection",
            id: "toolbar.cut"
        },
        "toolbar.edit":
        {
            defaultMessage: "Edit",
            description: "Refocuses the native text field",
            id: "toolbar.edit"
        },
        "toolbar.eraseFormatting":
        {
            defaultMessage: "Erase formatting",
            description: "Removes all inline formatting from the selected text",
            id: "toolbar.eraseFormatting"
        },
        "toolbar.filePicker":
        {
            defaultMessage: "Insert media",
            description: "Inserts an image or file (not yet implemented)",
            id: "toolbar.filePicker"
        },
        "toolbar.format":
        {
            defaultMessage: "Aa",
            description: "Toggles text-formatting mode in the toolbar",
            id: "toolbar.format"
        },
        "toolbar.hideKeyboard":
        {
            defaultMessage: "Hide keyboard",
            description: "Dismisses the keyboard",
            id: "toolbar.hideKeyboard"
        },
        "toolbar.indent":
        {
            defaultMessage: "Indent",
            description: "Indents the selected block(s), when a preceding block can contain them",
            id: "toolbar.indent"
        },
        "toolbar.insert":
        {
            defaultMessage: "Insert",
            description: "Toggles the block-insert panel",
            id: "toolbar.insert"
        },
        "toolbar.italic":
        {
            defaultMessage: "Italic",
            description: "Applies or removes italic formatting from the selected text",
            id: "toolbar.italic"
        },
        "toolbar.link":
        {
            defaultMessage: "Link",
            description: "Adds or edits a hyperlink on the selected text",
            id: "toolbar.link"
        },
        "toolbar.moveDown":
        {
            defaultMessage: "Move down",
            description: "Moves the selected block(s) down. Only occupies a toolbar slot when " +
                "the selection identifies one or more blocks that can move down",
            id: "toolbar.moveDown"
        },
        "toolbar.moveUp":
        {
            defaultMessage: "Move up",
            description: "Moves the selected block(s) up. Only occupies a toolbar slot when " +
                "the selection identifies one or more blocks that can move up",
            id: "toolbar.moveUp"
        },
        "toolbar.outdent":
        {
            defaultMessage: "Outdent",
            description: "Outdents the selected block(s), when they are nested",
            id: "toolbar.outdent"
        },
        "toolbar.paste":
        {
            defaultMessage: "Paste",
            description: "Pastes clipboard contents",
            id: "toolbar.paste"
        },
        "toolbar.redo":
        {
            defaultMessage: "Redo",
            description: "Reapplies the most recently undone edit. Only occupies a toolbar slot " +
                "once a redo is available",
            id: "toolbar.redo"
        },
        "toolbar.remove":
        {
            defaultMessage: "Remove",
            description: "Removes the block containing the cursor or all blocks touched by the selection",
            id: "toolbar.remove"
        },
        "toolbar.speech":
        {
            defaultMessage: "Dictate",
            description: "Starts voice dictation into the current block (not yet implemented)",
            id: "toolbar.speech"
        },
        "toolbar.strikethrough":
        {
            defaultMessage: "Strikethrough",
            description: "Applies or removes strikethrough formatting from the selected text",
            id: "toolbar.strikethrough"
        },
        "toolbar.turnInto":
        {
            defaultMessage: "Turn into",
            description: "Opens the panel for converting the selected block(s) to another type",
            id: "toolbar.turnInto"
        },
        "toolbar.underline":
        {
            defaultMessage: "Underline",
            description: "Applies or removes underline formatting from the selected text",
            id: "toolbar.underline"
        },
        "toolbar.undo":
        {
            defaultMessage: "Undo",
            description: "Reverts the most recent edit",
            id: "toolbar.undo"
        },
        "turnIntoPanel.title":
        {
            defaultMessage: "Turn into",
            description: "Header title of the block-conversion panel",
            id: "turnIntoPanel.title"
        }
    };
