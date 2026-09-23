/**
 * Immutable document store, transactions, selection, and grouped history.
 *
 * @module react-native-notion-markdown/document/store
 *
 * @file      store.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type {
    MarkdownDocument,
    MarkdownDocumentInput,
    MarkdownEditorListener,
    MarkdownEditorState,
    MarkdownSelection,
    MarkdownTransaction,
    MarkdownTransactionOrigin,
    SerializeMarkdownOptions
} from "./types.ts";
import { mapMarkdownSelectionPoint } from "./selection.ts";
import { parseMarkdown } from "./parser.ts";
import { serializeMarkdown } from "./serializer.ts";

/**
 * Options for creating a document editor store.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface CreateMarkdownEditorOptions
{
    readonly historyLimit?: number;
}

/**
 * State and transaction operations exposed by the document editor store.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface MarkdownEditorStore
{
    getState(): MarkdownEditorState;
    getDocument(): MarkdownDocument;
    getMarkdown(options?: SerializeMarkdownOptions): string;
    getSelection(): MarkdownSelection | undefined;
    subscribe(listener: MarkdownEditorListener): () => void;
    replaceDocument(input: MarkdownDocumentInput, origin?: MarkdownTransactionOrigin): void;
    transact(
        update: (document: MarkdownDocument) => MarkdownDocument,
        origin?: MarkdownTransactionOrigin
    ): void;
    setSelection(selection: MarkdownSelection | undefined): void;
    undo(): boolean;
    redo(): boolean;
}

/**
 * Clone the given document while preserving its block structure.
 *
 * @category Functions
 * @since 1.0.0
 */
function cloneDocument(document: MarkdownDocument): MarkdownDocument
{
    return {
        blocks: document.blocks,
        version: 1
    } as const;
}

/**
 * Convert the given editor input into a document.
 *
 * @category Functions
 * @since 1.0.0
 */
function inputDocument(input: MarkdownDocumentInput): MarkdownDocument
{
    return typeof input === "string" ? parseMarkdown(input).document : input;
}

/**
 * Create the pure TypeScript editor engine.
 *
 * @since 1.0.0
 */
export function createMarkdownEditor(
    input: MarkdownDocumentInput = "",
    options: CreateMarkdownEditorOptions = { }
): MarkdownEditorStore
{
    let document = cloneDocument(inputDocument(input));
    let selection: MarkdownSelection | undefined;
    let revision = 0;
    const undoStack: Array<MarkdownDocument> = [ ];
    const redoStack: Array<MarkdownDocument> = [ ];
    const listeners = new Set<MarkdownEditorListener>();
    const limit = Math.max(1, options.historyLimit ?? 100);
    let lastHistoryOrigin: MarkdownTransactionOrigin | undefined;
    const state = (): MarkdownEditorState => ({
        document,
        revision,
        ...(selection === undefined ? { } : { selection }),
        canRedo: redoStack.length > 0,
        canUndo: undoStack.length > 0
    });
    const notify = (transaction?: MarkdownTransaction): void =>
    {
        const current = state();
        listeners.forEach((listener: MarkdownEditorListener) => listener(current, transaction));
    };
    const commit = (next: MarkdownDocument, origin: MarkdownTransactionOrigin, saveHistory: boolean): void =>
    {
        if (next === document) {return;}
        const before = document;
        document = cloneDocument(next);
        revision += 1;
        if (saveHistory)
        {
            if (lastHistoryOrigin !== origin || undoStack.length === 0)
            {
                undoStack.push(before);
            }

            if (undoStack.length > limit)
            {
                undoStack.shift();
            }

            redoStack.length = 0;
            lastHistoryOrigin = origin;
        }

        if (selection !== undefined)
        {
            selection =
                {
                    anchor: mapMarkdownSelectionPoint(document, selection.anchor),
                    focus: mapMarkdownSelectionPoint(document, selection.focus)
                };
        }

        notify({
            after: document,
            before,
            origin,
            revision
        });
    };
    return {
        getDocument: () => document,
        getMarkdown: (serializationOptions?: SerializeMarkdownOptions) =>
            serializeMarkdown(document, serializationOptions),
        getSelection: () => selection,
        getState: state,
        redo: () =>
        {
            const next = redoStack.pop();
            if (next === undefined) {return false;}
            undoStack.push(document);
            lastHistoryOrigin = undefined;
            const before = document;
            document = next;
            revision += 1;
            if (selection !== undefined)
            {
                selection =
                    {
                        anchor: mapMarkdownSelectionPoint(document, selection.anchor),
                        focus: mapMarkdownSelectionPoint(document, selection.focus)
                    };
            }

            notify({
                after: document,
                before,
                origin: "history",
                revision
            });

            return true;
        },
        replaceDocument: (
            inputValue: MarkdownDocumentInput,
            origin: string | undefined = "system"
        ) => commit(inputDocument(inputValue), origin, true),
        setSelection: (next: MarkdownSelection | undefined) =>
        {
            if (next === undefined)
            {
                selection = undefined;
                notify();
                return;
            }

            selection =
                {
                    anchor: mapMarkdownSelectionPoint(document, next.anchor),
                    focus: mapMarkdownSelectionPoint(document, next.focus)
                };

            notify();
        },
        subscribe: (listener: MarkdownEditorListener) =>
        {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        transact: (
            update: (Document: MarkdownDocument) => MarkdownDocument,
            origin: string | undefined = "user"
        ) => commit(update(document), origin, true),
        undo: () =>
        {
            const previous = undoStack.pop();
            if (previous === undefined) {return false;}
            redoStack.push(document);
            lastHistoryOrigin = undefined;
            const before = document;
            document = previous;
            revision += 1;
            if (selection !== undefined)
            {
                selection = {
                    anchor: mapMarkdownSelectionPoint(document, selection.anchor),
                    focus: mapMarkdownSelectionPoint(document, selection.focus)
                };
            }

            notify({
                after: document,
                before,
                origin: "history",
                revision
            });

            return true;
        }
    };
}
