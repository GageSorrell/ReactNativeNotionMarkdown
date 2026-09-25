/**
 * The canonical set of UI message identifiers and default English text for the editor and the
 * renderer. Consuming applications translate these through {@link MarkdownProvider} rather than
 * the package depending on any particular i18n framework.
 *
 * @module react-native-notion-markdown/provider/messages
 *
 * @file      messages.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Stable identifier for a translatable editor or renderer UI string. `native.*` messages are drawn
 * by the editor's native view; `renderer.*` messages by the renderer; `color.*` messages name the
 * palette's hues wherever a color picker shows them.
 *
 * @since 1.0.0
 */
export type MarkdownMessageId =
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
    | "emojiSheet.title"
    | "emojiSheet.common"
    | "emojiSheet.filter"
    | "mediaSheet.title"
    | "mediaSheet.openGallery"
    | "mediaSheet.takePicture"
    | "mediaSheet.captureVideo"
    | "audioSheet.title"
    | "audioSheet.chooseFile"
    | "audioSheet.record"
    | "audioSheet.cancel"
    | "audioSheet.confirm"
    | "audioSheet.start"
    | "audioSheet.stop"
    | "audioSheet.preview"
    | "audioSheet.play"
    | "audioSheet.pause"
    | "audioSheet.recording"
    | "audioSheet.permissionDenied"
    | "audioSheet.error"
    | "audioSheet.preparing"
    | "audioSheet.noAudio"
    | "audioSheet.replace"
    | "linkSheet.title"
    | "linkSheet.url"
    | "linkSheet.label"
    | "linkSheet.cancel"
    | "linkSheet.apply"
    | "actionsSheet.title"
    | "actionsSheet.insertAbove"
    | "actionsSheet.insertBelow"
    | "actionsSheet.fitTableWidth"
    | "actionsSheet.headerRow"
    | "actionsSheet.headerColumn"
    | "actionsSheet.insertTableRowAbove"
    | "actionsSheet.insertTableRowBelow"
    | "actionsSheet.insertTableColumnLeft"
    | "actionsSheet.insertTableColumnRight"
    | "actionsSheet.duplicateTableRow"
    | "actionsSheet.duplicateTableColumn"
    | "actionsSheet.deleteTableRow"
    | "actionsSheet.deleteTableColumn"
    | "actionsSheet.clearTableContents"
    | "actionsSheet.duplicate"
    | "actionsSheet.delete"
    | "actionsSheet.color"
    | "actionsSheet.editIcon"
    | "actionsSheet.chooseColor"
    | "actionsSheet.text"
    | "actionsSheet.background"
    | "actionsSheet.defaultColor"
    | "blockName.text"
    | "blockName.code"
    | "blockName.heading1"
    | "blockName.heading2"
    | "blockName.heading3"
    | "blockName.heading4"
    | "blockName.bulletedListItem"
    | "blockName.numberedListItem"
    | "blockName.toDo"
    | "blockName.callout"
    | "blockName.quote"
    | "blockName.table"
    | "blockName.divider"
    | "blockName.equation"
    | "blockName.file"
    | "blockName.tableOfContents"
    | "blockName.syncedBlock"
    | "blockName.toggle"
    | "blockName.columnList"
    | "blockName.image"
    | "blockName.video"
    | "blockName.audio"
    | "blockName.linkToPage"
    | "insertPanel.title"
    | "insertPanel.bulletedList"
    | "insertPanel.numberedList"
    | "insertPanel.image"
    | "insertPanel.audio"
    | "insertPanel.video"
    | "insertPanel.file"
    | "insertPanel.code"
    | "insertPanel.link"
    | "insertPanel.mediaTitle"
    | "insertPanel.advancedTitle"
    | "insertPanel.blockEquation"
    | "insertPanel.syncedBlock"
    | "insertPanel.mermaidDiagram"
    | "insertPanel.callout"
    | "insertPanel.quote"
    | "insertPanel.columns"
    | "insertPanel.columns2"
    | "insertPanel.columns3"
    | "insertPanel.columns4"
    | "insertPanel.columns5"
    | "insertPanel.text"
    | "insertPanel.table"
    | "insertPanel.divider"
    | "insertPanel.tableOfContents"
    | "insertPanel.toDo"
    | "insertPanel.toggleList"
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
    | "turnIntoPanel.title"
    | "color.gray"
    | "color.brown"
    | "color.orange"
    | "color.yellow"
    | "color.green"
    | "color.blue"
    | "color.purple"
    | "color.pink"
    | "color.red"
    | "color.grayBackground"
    | "color.brownBackground"
    | "color.orangeBackground"
    | "color.yellowBackground"
    | "color.greenBackground"
    | "color.blueBackground"
    | "color.purpleBackground"
    | "color.pinkBackground"
    | "color.redBackground"
    | "native.audio"
    | "native.editableTableCells"
    | "native.emptyToDoPlaceholder"
    | "native.emptyTogglePlaceholder"
    | "native.file"
    | "native.fitTableWidth"
    | "native.selectTableColumn"
    | "native.selectTableRow"
    | "native.tableActions"
    | "native.tableOfContents"
    | "native.tableSelectionEnd"
    | "native.tableSelectionStart"
    | "native.unknownFileSize"
    | "renderer.audioUnavailable"
    | "renderer.circularSyncedReference"
    | "renderer.closePreview"
    | "renderer.collapseToggle"
    | "renderer.divider"
    | "renderer.emptyBlock"
    | "renderer.emptyTogglePlaceholder"
    | "renderer.expandToggle"
    | "renderer.image"
    | "renderer.imageUnavailable"
    | "renderer.imageWithCaption"
    | "renderer.invalidMermaidSource"
    | "renderer.lineBreak"
    | "renderer.loading"
    | "renderer.loadingEquation"
    | "renderer.loadingSyncedContent"
    | "renderer.loadMermaidPreview"
    | "renderer.mermaidPreviewError"
    | "renderer.mermaidPreviewFailed"
    | "renderer.openFile"
    | "renderer.pauseAudio"
    | "renderer.playAudio"
    | "renderer.referenceUnavailable"
    | "renderer.resourceUnavailable"
    | "renderer.resourceUnavailableOrInvalid"
    | "renderer.retry"
    | "renderer.retryMermaidPreview"
    | "renderer.retryPreview"
    | "renderer.retrySyncedContent"
    | "renderer.syncedContentUnavailable"
    | "renderer.tableOfContents"
    | "renderer.unsupportedBlock"
    | "renderer.videoUnavailable"
    | "renderer.webPageFavicon"
    | "renderer.audioStatusPaused"
    | "renderer.audioStatusPlaying"
    | "renderer.closeMediaPreview"
    | "renderer.closeMermaidPreview"
    | "renderer.equation"
    | "renderer.invalidEquation"
    | "renderer.invalidMermaidSourceWithError"
    | "renderer.loadingMedia"
    | "renderer.loadMediaPreview"
    | "renderer.mediaKindAudio"
    | "renderer.mediaKindFile"
    | "renderer.mediaKindImage"
    | "renderer.mediaKindPdf"
    | "renderer.mediaKindVideo"
    | "renderer.pdfUnavailable"
    | "actionsSheet.dismiss"
    | "audioSheet.dismiss"
    | "audioSheet.untitled"
    | "emojiSheet.dismiss"
    | "emojiSheet.shuffle"
    | "linkSheet.urlPlaceholder"
    | "mediaSheet.dismiss"
    | "native.tableCell";

/**
 * A single translatable message: a stable id, its English default, and optional translator
 * context.
 *
 * @since 1.0.0
 */
export interface MarkdownMessageDescriptor
{
    readonly id: MarkdownMessageId;
    readonly defaultMessage: string;
    readonly description?: string;
}

/**
 * Resolves a message descriptor to display text, optionally interpolating `Values`. Supplied by
 * the host application -- see {@link MarkdownProvider}.
 *
 * @since 1.0.0
 */
export type MarkdownTranslate = (
    Message: MarkdownMessageDescriptor,
    Values?: Readonly<Record<string, string | number>>
) => string;

export/**
       * The package's canonical English message catalog. Every {@link MarkdownMessageId} used by
       * the editor UI has an entry here.
       *
       * @since 1.0.0
       */
const defaultMarkdownMessages: Readonly<Record<MarkdownMessageId, MarkdownMessageDescriptor>> =
    {
        "actionsSheet.background":
        {
            defaultMessage: "Background",
            description: "Callout color chooser section for background colors",
            id: "actionsSheet.background"
        },
        "actionsSheet.chooseColor":
        {
            defaultMessage: "Choose a color",
            description: "Title of the callout color chooser",
            id: "actionsSheet.chooseColor"
        },
        "actionsSheet.clearTableContents":
        {
            defaultMessage: "Clear cell contents",
            description: "Table action-sheet button that clears the selected cells",
            id: "actionsSheet.clearTableContents"
        },
        "actionsSheet.color":
        {
            defaultMessage: "Color",
            description: "Callout action-sheet button that opens the color chooser",
            id: "actionsSheet.color"
        },
        "actionsSheet.defaultColor":
        {
            defaultMessage: "Default",
            description: "Callout color chooser button that clears the block color",
            id: "actionsSheet.defaultColor"
        },
        "actionsSheet.delete":
        {
            defaultMessage: "Delete",
            description: "Block-actions sheet button that deletes the target block",
            id: "actionsSheet.delete"
        },
        "actionsSheet.deleteTableColumn":
        {
            defaultMessage: "Delete column",
            description: "Table action-sheet button that deletes the selected column",
            id: "actionsSheet.deleteTableColumn"
        },
        "actionsSheet.deleteTableRow":
        {
            defaultMessage: "Delete row",
            description: "Table action-sheet button that deletes the selected row",
            id: "actionsSheet.deleteTableRow"
        },
        "actionsSheet.dismiss":
        {
            defaultMessage: "Dismiss actions",
            description: "Accessibility label of the scrim that closes the block-actions sheet",
            id: "actionsSheet.dismiss"
        },
        "actionsSheet.duplicate":
        {
            defaultMessage: "Duplicate",
            description: "Block-actions sheet button that duplicates the target block",
            id: "actionsSheet.duplicate"
        },
        "actionsSheet.duplicateTableColumn":
        {
            defaultMessage: "Duplicate column",
            description: "Table action-sheet button that duplicates the selected column",
            id: "actionsSheet.duplicateTableColumn"
        },
        "actionsSheet.duplicateTableRow":
        {
            defaultMessage: "Duplicate row",
            description: "Table action-sheet button that duplicates the selected row",
            id: "actionsSheet.duplicateTableRow"
        },
        "actionsSheet.editIcon":
        {
            defaultMessage: "Edit icon",
            description: "Callout action-sheet button that opens the emoji picker",
            id: "actionsSheet.editIcon"
        },
        "actionsSheet.fitTableWidth":
        {
            defaultMessage: "Fit to page width",
            description: "Table action-sheet button that toggles page-width fitting",
            id: "actionsSheet.fitTableWidth"
        },
        "actionsSheet.headerColumn":
        {
            defaultMessage: "Toggle header column",
            description: "Table action-sheet button that toggles the header column",
            id: "actionsSheet.headerColumn"
        },
        "actionsSheet.headerRow":
        {
            defaultMessage: "Toggle header row",
            description: "Table action-sheet button that toggles the header row",
            id: "actionsSheet.headerRow"
        },
        "actionsSheet.insertAbove":
        {
            defaultMessage: "Insert above",
            description: "Block-actions sheet button that inserts an empty block above the target block",
            id: "actionsSheet.insertAbove"
        },
        "actionsSheet.insertBelow":
        {
            defaultMessage: "Insert below",
            description: "Block-actions sheet button that inserts an empty block below the target block",
            id: "actionsSheet.insertBelow"
        },
        "actionsSheet.insertTableColumnLeft":
        {
            defaultMessage: "Insert column left",
            description: "Table action-sheet button that inserts a column left of the selected column",
            id: "actionsSheet.insertTableColumnLeft"
        },
        "actionsSheet.insertTableColumnRight":
        {
            defaultMessage: "Insert column right",
            description: "Table action-sheet button that inserts a column right of the selected column",
            id: "actionsSheet.insertTableColumnRight"
        },
        "actionsSheet.insertTableRowAbove":
        {
            defaultMessage: "Insert row above",
            description: "Table action-sheet button that inserts a row above the selected row",
            id: "actionsSheet.insertTableRowAbove"
        },
        "actionsSheet.insertTableRowBelow":
        {
            defaultMessage: "Insert row below",
            description: "Table action-sheet button that inserts a row below the selected row",
            id: "actionsSheet.insertTableRowBelow"
        },
        "actionsSheet.text":
        {
            defaultMessage: "Text",
            description: "Callout color chooser section for foreground colors",
            id: "actionsSheet.text"
        },
        "actionsSheet.title":
        {
            defaultMessage: "Actions",
            description: "Header title of the block-actions bottom sheet",
            id: "actionsSheet.title"
        },
        "audioSheet.cancel":
        {
            defaultMessage: "Cancel",
            description: "Cancels audio picking or recording",
            id: "audioSheet.cancel"
        },
        "audioSheet.chooseFile":
        {
            defaultMessage: "Choose audio file",
            description: "Opens the system audio file picker",
            id: "audioSheet.chooseFile"
        },
        "audioSheet.confirm":
        {
            defaultMessage: "Insert audio",
            description: "Confirms the selected or recorded audio",
            id: "audioSheet.confirm"
        },
        "audioSheet.dismiss":
        {
            defaultMessage: "Dismiss insert audio",
            description: "Accessibility label of the scrim that closes the audio sheet",
            id: "audioSheet.dismiss"
        },
        "audioSheet.error":
        {
            defaultMessage: "Audio could not be prepared. Try again.",
            description: "Recoverable audio workflow error",
            id: "audioSheet.error"
        },
        "audioSheet.noAudio":
        {
            defaultMessage: "Audio",
            description: "Fallback name for an audio block without a filename",
            id: "audioSheet.noAudio"
        },
        "audioSheet.pause":
        {
            defaultMessage: "Pause",
            description: "Pauses the audio confirmation preview",
            id: "audioSheet.pause"
        },
        "audioSheet.permissionDenied":
        {
            defaultMessage: "Microphone permission is required to record audio.",
            description: "Explains why recording could not start",
            id: "audioSheet.permissionDenied"
        },
        "audioSheet.play":
        {
            defaultMessage: "Play",
            description: "Plays the audio confirmation preview",
            id: "audioSheet.play"
        },
        "audioSheet.preparing":
        {
            defaultMessage: "Preparing recorder…",
            description: "Recorder preparation state",
            id: "audioSheet.preparing"
        },
        "audioSheet.preview":
        {
            defaultMessage: "Preview",
            description: "Audio confirmation preview label",
            id: "audioSheet.preview"
        },
        "audioSheet.record":
        {
            defaultMessage: "Record audio",
            description: "Starts the microphone recording workflow",
            id: "audioSheet.record"
        },
        "audioSheet.recording":
        {
            defaultMessage: "Recording",
            description: "Recording waveform accessibility label",
            id: "audioSheet.recording"
        },
        "audioSheet.replace":
        {
            defaultMessage: "Replace audio",
            description: "Confirms replacing an existing audio block",
            id: "audioSheet.replace"
        },
        "audioSheet.start":
        {
            defaultMessage: "Start recording",
            description: "Starts an audio recording",
            id: "audioSheet.start"
        },
        "audioSheet.stop":
        {
            defaultMessage: "Stop recording",
            description: "Stops an audio recording",
            id: "audioSheet.stop"
        },
        "audioSheet.title":
        {
            defaultMessage: "Insert audio",
            description: "Header title of the audio bottom sheet",
            id: "audioSheet.title"
        },
        "audioSheet.untitled":
        {
            defaultMessage: "Audio",
            description: "Title shown for a recording that has no file name",
            id: "audioSheet.untitled"
        },
        "blockName.audio":
        {
            defaultMessage: "Audio",
            description: "Block-actions sheet section label naming an audio block",
            id: "blockName.audio"
        },
        "blockName.bulletedListItem":
        {
            defaultMessage: "Bulleted list",
            description: "Block-actions sheet section label naming a bulleted-list-item block",
            id: "blockName.bulletedListItem"
        },
        "blockName.callout":
        {
            defaultMessage: "Callout",
            description: "Block-actions sheet section label naming a callout block",
            id: "blockName.callout"
        },
        "blockName.code":
        {
            defaultMessage: "Code",
            description: "Block-actions sheet section label naming a code block",
            id: "blockName.code"
        },
        "blockName.columnList":
        {
            defaultMessage: "Columns",
            description: "Block-actions sheet section label naming a column-list block",
            id: "blockName.columnList"
        },
        "blockName.divider":
        {
            defaultMessage: "Divider",
            description: "Block-actions sheet section label naming a divider block",
            id: "blockName.divider"
        },
        "blockName.equation":
        {
            defaultMessage: "Block equation",
            description: "Block-actions sheet section label naming an equation block",
            id: "blockName.equation"
        },
        "blockName.file":
        {
            defaultMessage: "File",
            description: "Block-actions sheet section label naming a file block",
            id: "blockName.file"
        },
        "blockName.heading1":
        {
            defaultMessage: "Heading 1",
            description: "Block-actions sheet section label naming a heading 1 block",
            id: "blockName.heading1"
        },
        "blockName.heading2":
        {
            defaultMessage: "Heading 2",
            description: "Block-actions sheet section label naming a heading 2 block",
            id: "blockName.heading2"
        },
        "blockName.heading3":
        {
            defaultMessage: "Heading 3",
            description: "Block-actions sheet section label naming a heading 3 block",
            id: "blockName.heading3"
        },
        "blockName.heading4":
        {
            defaultMessage: "Heading 4",
            description: "Block-actions sheet section label naming a heading 4 block",
            id: "blockName.heading4"
        },
        "blockName.image":
        {
            defaultMessage: "Image",
            description: "Block-actions sheet section label naming an image block",
            id: "blockName.image"
        },
        "blockName.linkToPage":
        {
            defaultMessage: "Page reference",
            description: "Block-actions sheet section label naming a page-reference block",
            id: "blockName.linkToPage"
        },
        "blockName.numberedListItem":
        {
            defaultMessage: "Numbered list",
            description: "Block-actions sheet section label naming a numbered-list-item block",
            id: "blockName.numberedListItem"
        },
        "blockName.quote":
        {
            defaultMessage: "Quote",
            description: "Block-actions sheet section label naming a quote block",
            id: "blockName.quote"
        },
        "blockName.syncedBlock":
        {
            defaultMessage: "Synced block",
            description: "Block-actions sheet section label naming a synced block",
            id: "blockName.syncedBlock"
        },
        "blockName.table":
        {
            defaultMessage: "Table",
            description: "Block-actions sheet section label naming a table block",
            id: "blockName.table"
        },
        "blockName.tableOfContents":
        {
            defaultMessage: "Table of contents",
            description: "Block-actions sheet section label naming a table-of-contents block",
            id: "blockName.tableOfContents"
        },
        "blockName.text":
        {
            defaultMessage: "Text",
            description: "Block-actions sheet section label naming a plain text block",
            id: "blockName.text"
        },
        "blockName.toDo":
        {
            defaultMessage: "To-do",
            description: "Block-actions sheet section label naming a to-do block",
            id: "blockName.toDo"
        },
        "blockName.toggle":
        {
            defaultMessage: "Toggle list",
            description: "Block-actions sheet section label naming a toggle-list block",
            id: "blockName.toggle"
        },
        "blockName.video":
        {
            defaultMessage: "Video",
            description: "Block-actions sheet section label naming a video block",
            id: "blockName.video"
        },
        "color.blue":
        {
            defaultMessage: "Blue",
            description: "Name of the blue text color, used as a color swatch's label",
            id: "color.blue"
        },
        "color.blueBackground":
        {
            defaultMessage: "Blue background",
            description: "Name of the blue background color, used as a color swatch's label",
            id: "color.blueBackground"
        },
        "color.brown":
        {
            defaultMessage: "Brown",
            description: "Name of the brown text color, used as a color swatch's label",
            id: "color.brown"
        },
        "color.brownBackground":
        {
            defaultMessage: "Brown background",
            description: "Name of the brown background color, used as a color swatch's label",
            id: "color.brownBackground"
        },
        "color.gray":
        {
            defaultMessage: "Gray",
            description: "Name of the gray text color, used as a color swatch's label",
            id: "color.gray"
        },
        "color.grayBackground":
        {
            defaultMessage: "Gray background",
            description: "Name of the gray background color, used as a color swatch's label",
            id: "color.grayBackground"
        },
        "color.green":
        {
            defaultMessage: "Green",
            description: "Name of the green text color, used as a color swatch's label",
            id: "color.green"
        },
        "color.greenBackground":
        {
            defaultMessage: "Green background",
            description: "Name of the green background color, used as a color swatch's label",
            id: "color.greenBackground"
        },
        "color.orange":
        {
            defaultMessage: "Orange",
            description: "Name of the orange text color, used as a color swatch's label",
            id: "color.orange"
        },
        "color.orangeBackground":
        {
            defaultMessage: "Orange background",
            description: "Name of the orange background color, used as a color swatch's label",
            id: "color.orangeBackground"
        },
        "color.pink":
        {
            defaultMessage: "Pink",
            description: "Name of the pink text color, used as a color swatch's label",
            id: "color.pink"
        },
        "color.pinkBackground":
        {
            defaultMessage: "Pink background",
            description: "Name of the pink background color, used as a color swatch's label",
            id: "color.pinkBackground"
        },
        "color.purple":
        {
            defaultMessage: "Purple",
            description: "Name of the purple text color, used as a color swatch's label",
            id: "color.purple"
        },
        "color.purpleBackground":
        {
            defaultMessage: "Purple background",
            description: "Name of the purple background color, used as a color swatch's label",
            id: "color.purpleBackground"
        },
        "color.red":
        {
            defaultMessage: "Red",
            description: "Name of the red text color, used as a color swatch's label",
            id: "color.red"
        },
        "color.redBackground":
        {
            defaultMessage: "Red background",
            description: "Name of the red background color, used as a color swatch's label",
            id: "color.redBackground"
        },
        "color.yellow":
        {
            defaultMessage: "Yellow",
            description: "Name of the yellow text color, used as a color swatch's label",
            id: "color.yellow"
        },
        "color.yellowBackground":
        {
            defaultMessage: "Yellow background",
            description: "Name of the yellow background color, used as a color swatch's label",
            id: "color.yellowBackground"
        },
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
        "emojiSheet.common":
        {
            defaultMessage: "Common",
            description: "Section title for the common callout emoji choices",
            id: "emojiSheet.common"
        },
        "emojiSheet.dismiss":
        {
            defaultMessage: "Dismiss emoji picker",
            description: "Accessibility label of the scrim that closes the emoji picker",
            id: "emojiSheet.dismiss"
        },
        "emojiSheet.filter":
        {
            defaultMessage: "Filter...",
            description: "Placeholder for filtering callout emoji choices",
            id: "emojiSheet.filter"
        },
        "emojiSheet.shuffle":
        {
            defaultMessage: "Shuffle emoji",
            description: "Accessibility label of the button that shuffles the emoji picker's choices",
            id: "emojiSheet.shuffle"
        },
        "emojiSheet.title":
        {
            defaultMessage: "Choose callout icon",
            description: "Title of the emoji picker; coupled to callout blocks for now",
            id: "emojiSheet.title"
        },
        "insertPanel.advancedTitle":
        {
            defaultMessage: "Advanced",
            description: "Heading for the insert-panel advanced section",
            id: "insertPanel.advancedTitle"
        },
        "insertPanel.audio":
        {
            defaultMessage: "Audio",
            description: "Insert-panel button that opens the audio picker",
            id: "insertPanel.audio"
        },
        "insertPanel.blockEquation":
        {
            defaultMessage: "Block equation",
            description: "Insert-panel button reserved for the editor's future block equation",
            id: "insertPanel.blockEquation"
        },
        "insertPanel.bulletedList":
        {
            defaultMessage: "Bulleted list",
            description: "Insert-panel button that inserts a bulleted-list block",
            id: "insertPanel.bulletedList"
        },
        "insertPanel.callout":
        {
            defaultMessage: "Callout",
            description: "Insert-panel button that inserts a callout block",
            id: "insertPanel.callout"
        },
        "insertPanel.code":
        {
            defaultMessage: "Code",
            description: "Insert-panel button reserved for the editor's future non-inline code block",
            id: "insertPanel.code"
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
        "insertPanel.file":
        {
            defaultMessage: "File",
            description: "Insert-panel button that opens the native file picker",
            id: "insertPanel.file"
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
        "insertPanel.image":
        {
            defaultMessage: "Image",
            description: "Insert-panel button that opens the shared image and video picker",
            id: "insertPanel.image"
        },
        "insertPanel.link":
        {
            defaultMessage: "Link",
            description: "Insert-panel button reserved for the editor's future link block",
            id: "insertPanel.link"
        },
        "insertPanel.mediaTitle":
        {
            defaultMessage: "Media",
            description: "Heading for the insert-panel media section",
            id: "insertPanel.mediaTitle"
        },
        "insertPanel.mermaidDiagram":
        {
            defaultMessage: "Mermaid diagram",
            description: "Insert-panel button reserved for the editor's future Mermaid diagram block",
            id: "insertPanel.mermaidDiagram"
        },
        "insertPanel.numberedList":
        {
            defaultMessage: "Numbered list",
            description: "Insert-panel button that inserts a numbered-list block",
            id: "insertPanel.numberedList"
        },
        "insertPanel.pageReference":
        {
            defaultMessage: "Link to page",
            description: "Insert-panel button that requests creation of a link to a page",
            id: "insertPanel.pageReference"
        },
        "insertPanel.quote":
        {
            defaultMessage: "Quote",
            description: "Insert-panel button that inserts a quote block",
            id: "insertPanel.quote"
        },
        "insertPanel.returnToKeyboard":
        {
            defaultMessage: "Return to keyboard",
            description: "Full-width insert-panel button that closes the panel and refocuses the keyboard",
            id: "insertPanel.returnToKeyboard"
        },
        "insertPanel.syncedBlock":
        {
            defaultMessage: "Synced block",
            description: "Insert-panel button reserved for the editor's future synced block",
            id: "insertPanel.syncedBlock"
        },
        "insertPanel.table":
        {
            defaultMessage: "Table",
            description: "Insert-panel button reserved for the editor's future table block",
            id: "insertPanel.table"
        },
        "insertPanel.tableOfContents":
        {
            defaultMessage: "Table of contents",
            description: "Insert-panel button that inserts a table of contents block",
            id: "insertPanel.tableOfContents"
        },
        "insertPanel.text":
        {
            defaultMessage: "Text",
            description: "Insert-panel button that inserts a plain text block",
            id: "insertPanel.text"
        },
        "insertPanel.title":
        {
            defaultMessage: "Insert a block",
            description: "Header title of the block-insert panel",
            id: "insertPanel.title"
        },
        "insertPanel.toDo":
        {
            defaultMessage: "To do list",
            description: "Insert-panel button that inserts a to-do block",
            id: "insertPanel.toDo"
        },
        "insertPanel.toggleHeading1":
        {
            defaultMessage: "Toggle Heading 1",
            description: "Insert-panel button that inserts a toggle heading 1 block",
            id: "insertPanel.toggleHeading1"
        },
        "insertPanel.toggleHeading2":
        {
            defaultMessage: "Toggle Heading 2",
            description: "Insert-panel button that inserts a toggle heading 2 block",
            id: "insertPanel.toggleHeading2"
        },
        "insertPanel.toggleHeading3":
        {
            defaultMessage: "Toggle Heading 3",
            description: "Insert-panel button that inserts a toggle heading 3 block",
            id: "insertPanel.toggleHeading3"
        },
        "insertPanel.toggleHeading4":
        {
            defaultMessage: "Toggle Heading 4",
            description: "Insert-panel button that inserts a toggle heading 4 block",
            id: "insertPanel.toggleHeading4"
        },
        "insertPanel.toggleList":
        {
            defaultMessage: "Toggle list",
            description: "Insert-panel button reserved for the editor's future toggle-list block",
            id: "insertPanel.toggleList"
        },
        "insertPanel.video":
        {
            defaultMessage: "Video",
            description: "Insert-panel button that opens the shared image and video picker",
            id: "insertPanel.video"
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
        "linkSheet.urlPlaceholder":
        {
            defaultMessage: "https://example.com",
            description: "Placeholder shown in the link sheet's empty URL field",
            id: "linkSheet.urlPlaceholder"
        },
        "mediaSheet.captureVideo":
        {
            defaultMessage: "Capture Video",
            description: "Button that opens the camera in video-recording mode",
            id: "mediaSheet.captureVideo"
        },
        "mediaSheet.dismiss":
        {
            defaultMessage: "Dismiss insert media",
            description: "Accessibility label of the scrim that closes the insert-media sheet",
            id: "mediaSheet.dismiss"
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
        "native.audio":
        {
            defaultMessage: "Audio",
            description: "Fallback title of an audio block whose file has no name",
            id: "native.audio"
        },
        "native.editableTableCells":
        {
            defaultMessage: "Editable table cells",
            description: "Accessibility description of a table's editable cell grid",
            id: "native.editableTableCells"
        },
        "native.emptyToDoPlaceholder":
        {
            defaultMessage: "To do",
            description: "Hint shown inside an empty to-do block",
            id: "native.emptyToDoPlaceholder"
        },
        "native.emptyTogglePlaceholder":
        {
            defaultMessage: "Empty toggle.  Tap to add text or create a new block.",
            description: "Hint shown inside the empty child of a toggle heading in the editor",
            id: "native.emptyTogglePlaceholder"
        },
        "native.file":
        {
            defaultMessage: "File",
            description: "Fallback title of a file block whose file has no name",
            id: "native.file"
        },
        "native.fitTableWidth":
        {
            defaultMessage: "Fit table to page width",
            description: "Accessibility description of the switch that fits a table to the page width",
            id: "native.fitTableWidth"
        },
        "native.selectTableColumn":
        {
            defaultMessage: "Select table column",
            description: "Accessibility description of the handle that selects a table column",
            id: "native.selectTableColumn"
        },
        "native.selectTableRow":
        {
            defaultMessage: "Select table row",
            description: "Accessibility description of the handle that selects a table row",
            id: "native.selectTableRow"
        },
        "native.tableActions":
        {
            defaultMessage: "Table actions",
            description: "Accessibility description of the button that opens a table's actions",
            id: "native.tableActions"
        },
        "native.tableCell":
        {
            defaultMessage: "Table cell row {row}, column {column}",
            description: "Accessibility label of a table cell; {row} and {column} are its 1-based position",
            id: "native.tableCell"
        },
        "native.tableOfContents":
        {
            defaultMessage: "Table of contents",
            description: "Label drawn inside a table-of-contents block in the editor",
            id: "native.tableOfContents"
        },
        "native.tableSelectionEnd":
        {
            defaultMessage: "Table selection end",
            description: "Accessibility description of the handle at the end of a table-cell selection",
            id: "native.tableSelectionEnd"
        },
        "native.tableSelectionStart":
        {
            defaultMessage: "Table selection start",
            description: "Accessibility description of the handle at the start of a table-cell selection",
            id: "native.tableSelectionStart"
        },
        "native.unknownFileSize":
        {
            defaultMessage: "Unknown size",
            description: "Shown in place of a file block's size when the size is unknown",
            id: "native.unknownFileSize"
        },
        "renderer.audioStatusPaused":
        {
            defaultMessage: "Play audio · {current}s / {duration}s",
            description: "Audio block status while paused; {current} and {duration} are whole seconds",
            id: "renderer.audioStatusPaused"
        },
        "renderer.audioStatusPlaying":
        {
            defaultMessage: "Pause audio · {current}s / {duration}s",
            description: "Audio block status while playing; {current} and {duration} are whole seconds",
            id: "renderer.audioStatusPlaying"
        },
        "renderer.audioUnavailable":
        {
            defaultMessage: "Audio unavailable",
            description: "Shown when an audio block's file cannot be loaded",
            id: "renderer.audioUnavailable"
        },
        "renderer.circularSyncedReference":
        {
            defaultMessage: "Circular synced reference",
            description: "Shown when a synced block references itself",
            id: "renderer.circularSyncedReference"
        },
        "renderer.closeMediaPreview":
        {
            defaultMessage: "Close {kind} preview",
            description: "Accessibility label of the button closing a media preview; {kind} is a media kind",
            id: "renderer.closeMediaPreview"
        },
        "renderer.closeMermaidPreview":
        {
            defaultMessage: "Close Mermaid preview",
            description: "Accessibility label of the button that closes a Mermaid diagram preview",
            id: "renderer.closeMermaidPreview"
        },
        "renderer.closePreview":
        {
            defaultMessage: "Close preview",
            description: "Closes a full-screen media or diagram preview",
            id: "renderer.closePreview"
        },
        "renderer.collapseToggle":
        {
            defaultMessage: "Collapse toggle",
            description: "Accessibility label of an expanded toggle's disclosure button",
            id: "renderer.collapseToggle"
        },
        "renderer.divider":
        {
            defaultMessage: "Divider",
            description: "Accessibility label of a divider block",
            id: "renderer.divider"
        },
        "renderer.emptyBlock":
        {
            defaultMessage: "Empty block",
            description: "Accessibility label of a block with no content",
            id: "renderer.emptyBlock"
        },
        "renderer.emptyTogglePlaceholder":
        {
            defaultMessage: "Empty toggle.  Tap to edit.",
            description: "Hint shown when an expanded toggle has no content",
            id: "renderer.emptyTogglePlaceholder"
        },
        "renderer.equation":
        {
            defaultMessage: "Equation: {expression}",
            description: "Accessibility label of a rendered equation; {expression} is its source",
            id: "renderer.equation"
        },
        "renderer.expandToggle":
        {
            defaultMessage: "Expand toggle",
            description: "Accessibility label of a collapsed toggle's disclosure button",
            id: "renderer.expandToggle"
        },
        "renderer.image":
        {
            defaultMessage: "Image",
            description: "Accessibility label of an image with no caption",
            id: "renderer.image"
        },
        "renderer.imageUnavailable":
        {
            defaultMessage: "Image unavailable",
            description: "Shown when an image block cannot be loaded",
            id: "renderer.imageUnavailable"
        },
        "renderer.imageWithCaption":
        {
            defaultMessage: "Image with caption",
            description: "Accessibility label of an image that has a caption",
            id: "renderer.imageWithCaption"
        },
        "renderer.invalidEquation":
        {
            defaultMessage: "Invalid equation: {expression}",
            description: "Label of an equation that failed to render; {expression} is its source",
            id: "renderer.invalidEquation"
        },
        "renderer.invalidMermaidSource":
        {
            defaultMessage: "Invalid Mermaid source",
            description: "Shown when a Mermaid diagram's source cannot be parsed",
            id: "renderer.invalidMermaidSource"
        },
        "renderer.invalidMermaidSourceWithError":
        {
            defaultMessage: "Invalid Mermaid source: {error}",
            description: "Shown when a Mermaid diagram fails to render; {error} is the renderer's message",
            id: "renderer.invalidMermaidSourceWithError"
        },
        "renderer.lineBreak":
        {
            defaultMessage: "Line break",
            description: "Accessibility label of a line break within rich text",
            id: "renderer.lineBreak"
        },
        "renderer.loadMediaPreview":
        {
            defaultMessage: "Load {kind} preview",
            description: "Button that loads a media preview; {kind} is a media kind name",
            id: "renderer.loadMediaPreview"
        },
        "renderer.loadMermaidPreview":
        {
            defaultMessage: "Load Mermaid preview",
            description: "Button that loads a Mermaid diagram preview",
            id: "renderer.loadMermaidPreview"
        },
        "renderer.loading":
        {
            defaultMessage: "Loading…",
            description: "Shown while a preview is loading",
            id: "renderer.loading"
        },
        "renderer.loadingEquation":
        {
            defaultMessage: "Loading equation",
            description: "Accessibility label shown while an equation renders",
            id: "renderer.loadingEquation"
        },
        "renderer.loadingMedia":
        {
            defaultMessage: "Loading {kind}…",
            description: "Shown while a media preview loads; {kind} is a media kind name",
            id: "renderer.loadingMedia"
        },
        "renderer.loadingSyncedContent":
        {
            defaultMessage: "Loading synced content…",
            description: "Shown while a synced block's content loads",
            id: "renderer.loadingSyncedContent"
        },
        "renderer.mediaKindAudio":
        {
            defaultMessage: "Audio",
            description: "Media kind name used in preview labels",
            id: "renderer.mediaKindAudio"
        },
        "renderer.mediaKindFile":
        {
            defaultMessage: "File",
            description: "Media kind name used in preview labels",
            id: "renderer.mediaKindFile"
        },
        "renderer.mediaKindImage":
        {
            defaultMessage: "Image",
            description: "Media kind name used in preview labels",
            id: "renderer.mediaKindImage"
        },
        "renderer.mediaKindPdf":
        {
            defaultMessage: "PDF",
            description: "Media kind name used in preview labels",
            id: "renderer.mediaKindPdf"
        },
        "renderer.mediaKindVideo":
        {
            defaultMessage: "Video",
            description: "Media kind name used in preview labels",
            id: "renderer.mediaKindVideo"
        },
        "renderer.mermaidPreviewError":
        {
            defaultMessage: "Mermaid preview error",
            description: "Accessibility label of a Mermaid preview's error message",
            id: "renderer.mermaidPreviewError"
        },
        "renderer.mermaidPreviewFailed":
        {
            defaultMessage: "Mermaid preview failed",
            description: "Shown when a Mermaid diagram fails to render",
            id: "renderer.mermaidPreviewFailed"
        },
        "renderer.openFile":
        {
            defaultMessage: "Open file",
            description: "Button that opens a file block's file",
            id: "renderer.openFile"
        },
        "renderer.pauseAudio":
        {
            defaultMessage: "Pause audio",
            description: "Accessibility label of the pause button of an audio block",
            id: "renderer.pauseAudio"
        },
        "renderer.pdfUnavailable":
        {
            defaultMessage: "PDF unavailable",
            description: "Shown when a PDF block cannot be loaded",
            id: "renderer.pdfUnavailable"
        },
        "renderer.playAudio":
        {
            defaultMessage: "Play audio",
            description: "Accessibility label of the play button of an audio block",
            id: "renderer.playAudio"
        },
        "renderer.referenceUnavailable":
        {
            defaultMessage: "Reference unavailable",
            description: "Shown when a page or block reference cannot be resolved",
            id: "renderer.referenceUnavailable"
        },
        "renderer.resourceUnavailable":
        {
            defaultMessage: "Resource unavailable",
            description: "Shown when a media resource cannot be loaded",
            id: "renderer.resourceUnavailable"
        },
        "renderer.resourceUnavailableOrInvalid":
        {
            defaultMessage: "Resource unavailable or URL invalid",
            description: "Shown when a media resource cannot be loaded or its URL is invalid",
            id: "renderer.resourceUnavailableOrInvalid"
        },
        "renderer.retry":
        {
            defaultMessage: "Retry",
            description: "Button that retries loading content that failed to load",
            id: "renderer.retry"
        },
        "renderer.retryMermaidPreview":
        {
            defaultMessage: "Retry Mermaid preview",
            description: "Accessibility label of the button that retries a Mermaid preview",
            id: "renderer.retryMermaidPreview"
        },
        "renderer.retryPreview":
        {
            defaultMessage: "Retry preview",
            description: "Accessibility label of the button that retries a media preview",
            id: "renderer.retryPreview"
        },
        "renderer.retrySyncedContent":
        {
            defaultMessage: "Retry synced content",
            description: "Accessibility label of the button that retries loading synced content",
            id: "renderer.retrySyncedContent"
        },
        "renderer.syncedContentUnavailable":
        {
            defaultMessage: "Synced content unavailable",
            description: "Shown when a synced block's content cannot be loaded",
            id: "renderer.syncedContentUnavailable"
        },
        "renderer.tableOfContents":
        {
            defaultMessage: "Table of contents",
            description: "Heading of a table-of-contents block",
            id: "renderer.tableOfContents"
        },
        "renderer.unsupportedBlock":
        {
            defaultMessage: "Unsupported block: {type}",
            description: "Shown in place of a block the renderer cannot display; {type} is its type",
            id: "renderer.unsupportedBlock"
        },
        "renderer.videoUnavailable":
        {
            defaultMessage: "Video unavailable",
            description: "Shown when a video block cannot be loaded",
            id: "renderer.videoUnavailable"
        },
        "renderer.webPageFavicon":
        {
            defaultMessage: "Web page favicon",
            description: "Accessibility label of a link's favicon",
            id: "renderer.webPageFavicon"
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
            description: "Opens the insert-media picker",
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
            defaultMessage: "Insert audio",
            description: "Opens the audio insertion workflow",
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
            defaultMessage: "Convert",
            description: "Header title of the block-conversion panel",
            id: "turnIntoPanel.title"
        }
    };

/**
 * Replace each `{name}` placeholder in a message with the matching entry of `Values`. Placeholders
 * with no matching value are left as-is.
 *
 * @since 1.0.0
 */
export function formatMarkdownMessage(
    Message: string,
    Values?: Readonly<Record<string, string | number>>
): string
{
    if (Values === undefined)
    {
        return Message;
    }

    return Message.replace(/\{(\w+)\}/gu, (placeholder: string, name: string) =>
        Object.prototype.hasOwnProperty.call(Values, name) ? String(Values[ name ]) : placeholder);
}

export/**
       * The built-in English translator: each message's default text, with its values interpolated.
       *
       * @since 1.0.0
       */
const defaultMarkdownTranslate: MarkdownTranslate = (
    Message: MarkdownMessageDescriptor,
    Values?: Readonly<Record<string, string | number>>
) => formatMarkdownMessage(Message.defaultMessage, Values);
