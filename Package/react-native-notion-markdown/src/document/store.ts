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
    NotionDocument,
    NotionDocumentInput,
    NotionEditorListener,
    NotionEditorState,
    NotionSelection,
    NotionTransaction,
    NotionTransactionOrigin
} from "./types.ts";
import { mapNotionSelectionPoint } from "./selection.ts";
import { parseNotionMarkdown } from "./parser.ts";
import { serializeNotionMarkdown } from "./serializer.ts";

/**
 * Options for creating a document editor store.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface CreateNotionEditorOptions
{
    readonly historyLimit?: number;
}

/**
 * State and transaction operations exposed by the document editor store.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface NotionEditorStore
{
    getState(): NotionEditorState;
    getDocument(): NotionDocument;
    getMarkdown(): string;
    getSelection(): NotionSelection | undefined;
    subscribe(listener: NotionEditorListener): () => void;
    replaceDocument(input: NotionDocumentInput, origin?: NotionTransactionOrigin): void;
    transact(update: (document: NotionDocument) => NotionDocument, origin?: NotionTransactionOrigin): void;
    setSelection(selection: NotionSelection | undefined): void;
    undo(): boolean;
    redo(): boolean;
}

/**
 * Clone the given document while preserving its block structure.
 *
 * @category Functions
 * @since 1.0.0
 */
function cloneDocument(document: NotionDocument): NotionDocument
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
function inputDocument(input: NotionDocumentInput): NotionDocument
{
    return typeof input === "string" ? parseNotionMarkdown(input).document : input;
}

/**
 * Create the pure TypeScript editor engine.
 *
 * @since 1.0.0
 */
export function createNotionEditor(
    input: NotionDocumentInput = "",
    options: CreateNotionEditorOptions = { }
): NotionEditorStore
{
    let document = cloneDocument(inputDocument(input));
    let selection: NotionSelection | undefined;
    let revision = 0;
    const undoStack: Array<NotionDocument> = [ ];
    const redoStack: Array<NotionDocument> = [ ];
    const listeners = new Set<NotionEditorListener>();
    const limit = Math.max(1, options.historyLimit ?? 100);
    let lastHistoryOrigin: NotionTransactionOrigin | undefined;
    const state = (): NotionEditorState => ({
        document,
        revision,
        ...(selection === undefined ? { } : { selection }),
        canRedo: redoStack.length > 0,
        canUndo: undoStack.length > 0
    });
    const notify = (transaction?: NotionTransaction): void =>
    {
        const current = state();
        listeners.forEach((listener: NotionEditorListener) => listener(current, transaction));
    };
    const commit = (next: NotionDocument, origin: NotionTransactionOrigin, saveHistory: boolean): void =>
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
                    anchor: mapNotionSelectionPoint(document, selection.anchor),
                    focus: mapNotionSelectionPoint(document, selection.focus)
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
        getMarkdown: () => serializeNotionMarkdown(document),
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
                        anchor: mapNotionSelectionPoint(document, selection.anchor),
                        focus: mapNotionSelectionPoint(document, selection.focus)
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
            inputValue: NotionDocumentInput,
            origin: string | undefined = "system"
        ) => commit(inputDocument(inputValue), origin, true),
        setSelection: (next: NotionSelection | undefined) =>
        {
            if (next === undefined)
            {
                selection = undefined;
                notify();
                return;
            }

            selection =
                {
                    anchor: mapNotionSelectionPoint(document, next.anchor),
                    focus: mapNotionSelectionPoint(document, next.focus)
                };

            notify();
        },
        subscribe: (listener: NotionEditorListener) =>
        {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        transact: (
            update: (Document: NotionDocument) => NotionDocument,
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
                    anchor: mapNotionSelectionPoint(document, selection.anchor),
                    focus: mapNotionSelectionPoint(document, selection.focus)
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
