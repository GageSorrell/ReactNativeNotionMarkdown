/**
 * React bindings for the pure Markdown editor store.
 *
 * @module react-native-notion-markdown/editor/state
 *
 * @file      state.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { createContext, createElement, useContext, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import {
    createMarkdownEditor,
    type CreateMarkdownEditorOptions,
    type MarkdownEditorStore
} from "../document/store.ts";
import type { MarkdownDocumentInput, MarkdownEditorState } from "../document/types.ts";

/**
 * Props accepted by the editor state provider.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface MarkdownEditorProviderProps
{
    readonly children: ReactNode;
    readonly initial?: MarkdownDocumentInput;
    readonly options?: CreateMarkdownEditorOptions;
    readonly store?: MarkdownEditorStore;
}

const MarkdownEditorContext = createContext<MarkdownEditorStore | undefined>(undefined);

/** Provide a shared document store to composable editor primitives. */
export function MarkdownEditorProvider({ children, initial = "", options, store }: MarkdownEditorProviderProps)
{
    const ownedStore = useMemo(() => store ?? createMarkdownEditor(initial, options), [ initial, options, store ]);
    return createElement(MarkdownEditorContext.Provider, { value: ownedStore }, children);
}

/** Return the nearest Markdown editor store. */
export function useMarkdownEditor(): MarkdownEditorStore
{
    const store = useContext(MarkdownEditorContext);
    if (store === undefined) throw new Error("useMarkdownEditor must be used inside MarkdownEditorProvider.");
    return store;
}

/** Subscribe a component to immutable editor state snapshots. */
export function useMarkdownEditorState(): MarkdownEditorState
{
    const store = useMarkdownEditor();
    return useSyncExternalStore(
        (onStoreChange) => store.subscribe(() => onStoreChange()),
        () => store.getState(),
        () => store.getState()
    );
}
