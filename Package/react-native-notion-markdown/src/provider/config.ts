/**
 * The configuration sections {@link MarkdownProvider} holds for each component, and the single
 * merge rule every section follows.
 *
 * @module react-native-notion-markdown/provider/config
 *
 * @file      config.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

export type { MarkdownEditorConfig } from "../editor/ui/customization.ts";
export type { MarkdownRendererConfig } from "../renderer/ui/types.ts";

/**
 * Return whether a value is a plain data object -- not an array, and not a React component
 * (`memo`/`forwardRef` components are objects tagged with `$$typeof`).
 */
function isPlainObject(value: unknown): value is Record<string, unknown>
{
    return value !== null
        && typeof value === "object"
        && Object.getPrototypeOf(value) === Object.prototype
        && !("$$typeof" in value);
}

/** Copy an object without its `undefined` entries. */
function withoutUndefined(value: Record<string, unknown>): Record<string, unknown>
{
    return Object.fromEntries(
        Object.entries(value).filter((entry: [ string, unknown ]) => entry[ 1 ] !== undefined)
    );
}

/**
 * Merge configuration sections, later sections winning. A field whose values are both plain
 * objects (e.g. `icons`, `toolbar`, `layout`, renderer `components`) merges key by key; any other
 * value (arrays, functions, components, scalars) replaces the earlier one. `undefined` fields and
 * sections are ignored, so an unset prop never clears a provider value.
 *
 * @category Functions
 * @since 1.0.0
 */
export function mergeMarkdownConfig<Section extends object>(
    ...sections: ReadonlyArray<Section | undefined>
): Section
{
    const merged: Record<string, unknown> = { };
    for (const section of sections)
    {
        if (section === undefined)
        {
            continue;
        }

        for (const [ key, value ] of Object.entries(section))
        {
            if (value === undefined)
            {
                continue;
            }

            const previous = merged[ key ];
            merged[ key ] = isPlainObject(previous) && isPlainObject(value)
                ? { ...previous, ...withoutUndefined(value) }
                : value;
        }
    }

    return merged as Section;
}
