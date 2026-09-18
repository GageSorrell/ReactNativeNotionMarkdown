/**
 * React bindings for the pure Notion editor store.
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
    createNotionEditor,
    type CreateNotionEditorOptions,
    type NotionEditorStore
} from "../document/store.ts";
import type { NotionDocumentInput, NotionEditorState } from "../document/types.ts";

/**
 * Props accepted by the editor state provider.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface NotionEditorProviderProps
{
    readonly children: ReactNode;
    readonly initial?: NotionDocumentInput;
    readonly options?: CreateNotionEditorOptions;
    readonly store?: NotionEditorStore;
}

const NotionEditorContext = createContext<NotionEditorStore | undefined>(undefined);

/** Provide a shared document store to composable editor primitives. */
export function NotionEditorProvider({ children, initial = "", options, store }: NotionEditorProviderProps)
{
    const ownedStore = useMemo(() => store ?? createNotionEditor(initial, options), [ initial, options, store ]);
    return createElement(NotionEditorContext.Provider, { value: ownedStore }, children);
}

/** Return the nearest Notion editor store. */
export function useNotionEditor(): NotionEditorStore
{
    const store = useContext(NotionEditorContext);
    if (store === undefined) throw new Error("useNotionEditor must be used inside NotionEditorProvider.");
    return store;
}

/** Subscribe a component to immutable editor state snapshots. */
export function useNotionEditorState(): NotionEditorState
{
    const store = useNotionEditor();
    return useSyncExternalStore(
        (onStoreChange) => store.subscribe(() => onStoreChange()),
        () => store.getState(),
        () => store.getState()
    );
}
