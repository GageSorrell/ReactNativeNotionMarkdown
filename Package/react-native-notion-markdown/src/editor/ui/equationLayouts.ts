/**
 * Lays out the editor's inline equations with RaTeX, for the native view to draw.
 *
 * @module react-native-notion-markdown/editor/ui/equationLayouts
 *
 * @file      equationLayouts.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { type EditorBlock, editorEquationExpressions } from "../../prototype.ts";
import { renderToView, uniffiInitAsync } from "react-native-ratex";
import { useEffect, useMemo, useState } from "react";

/**
 * Equation layouts by expression: RaTeX DisplayList JSON, or `null` for an expression RaTeX
 * rejected. This is the shape of `NativeEditor`'s `equations` prop.
 *
 * @since 1.0.0
 */
export type EditorEquationLayouts = Readonly<Record<string, string | null>>;

/* A layout depends only on its expression (never on the theme or font size), so it is computed
   once per expression for the lifetime of the app. */
const layoutCache = new Map<string, string | null>();

const noLayouts: EditorEquationLayouts = {};

/** Lay out one expression, remembering the result. */
function layoutOf(expression: string): string | null
{
    const cached = layoutCache.get(expression);
    if (cached !== undefined) {return cached;}

    let layout: string | null;
    try
    {
        layout = renderToView(expression, false);
    }
    catch
    {
        layout = null;
    }

    layoutCache.set(expression, layout);
    return layout;
}

/**
 * Compute the `equations` prop of `NativeEditor` for a document's blocks. The work is keyed on the
 * document's list of expressions, so ordinary typing does not repeat it.
 *
 * @since 1.0.0
 */
export function useEditorEquationLayouts(blocks: ReadonlyArray<EditorBlock>): EditorEquationLayouts
{
    const expressionsKey = useMemo(() => JSON.stringify(editorEquationExpressions(blocks)), [ blocks ]);
    const [ layouts, setLayouts ] = useState<EditorEquationLayouts>(noLayouts);

    useEffect(() =>
    {
        const expressions = JSON.parse(expressionsKey) as Array<string>;
        let live = true;
        void uniffiInitAsync()
            .then(() => expressions.map(
                (expression: string) => [ expression, layoutOf(expression) ] as const
            ))
            /* Without RaTeX nothing can be laid out; that is not remembered as the expression's fault. */
            .catch(() => expressions.map((expression: string) => [ expression, null ] as const))
            .then((entries: Array<readonly [ string, string | null ]>) =>
            {
                if (live)
                {
                    setLayouts(entries.length === 0 ? noLayouts : Object.fromEntries(entries));
                }
            });

        return () =>
        {
            live = false;
        };
    }, [ expressionsKey ]);

    return layouts;
}
