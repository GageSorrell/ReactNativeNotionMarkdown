/**
 *
 *
 * @module react-native-notion-markdown/renderer/ui/MathView
 *
 * @file      MathView.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Text, View } from "react-native";
import { renderToSvg, uniffiInitAsync } from "react-native-ratex";
import { useEffect, useMemo, useState } from "react";
import type { NotionRendererTheme } from "./types.ts";
import { SvgXml } from "react-native-svg";

/**
 * Props for rendering a given mathematical expression as SVG.
 *
 * @category Interfaces
 * @since 1.0.0
 */
export interface NotionMathViewProps
{
    readonly expression: string;
    readonly display?: boolean;
    readonly theme: NotionRendererTheme;
}

/**
 * Render a given mathematical expression with the corresponding display mode and theme.
 *
 * @category Functions
 * @since 1.0.0
 */
export function NotionMathView({ expression, display = false, theme }: NotionMathViewProps)
{
    const key = `${ expression }\u0000${ display }\u0000${ theme.fontSize }\u0000${ theme.foreground }`;
    const [ result, setResult ] = useState<{ key: string; svg?: string; error?: boolean }>();

    useEffect(() =>
    {
        let live = true;
        void uniffiInitAsync()
            .then(() =>
            {
                const svg = renderToSvg(
                    expression,
                    display,
                    Math.round(theme.fontSize * 2.5),
                    theme.foreground
                );

                if (live)
                {
                    setResult({ key, svg });
                }
            })
            .catch(() =>
            {
                if (live)
                {
                    setResult({
                        error: true,
                        key
                    });
                }
            });

        return () =>
        {
            live = false;
        };
    }, [ display, expression, key, theme.fontSize, theme.foreground ]);

    const ErrorStyle = useMemo(
        () => ({ color: theme.error, fontSize: theme.fontSize }),
        [ theme.error, theme.fontSize ]
    );

    const LoadingStyle = useMemo(
        () => ({ color: theme.muted, fontSize: theme.fontSize }),
        [ theme.muted, theme.fontSize ]
    );

    const RootStyle = useMemo(
        () => ({
            minHeight: display
                ? theme.fontSize * 3
                : theme.fontSize * 1.5,
            minWidth: 24
        }),
        [ display, theme.fontSize ]
    );

    if ((result?.key === key && result.error) || !expression.trim())
    {
        return (
            <Text
                accessibilityLabel={ `Invalid equation: ${ expression }` }
                style={ ErrorStyle }>
                ${ expression }$
            </Text>
        );
    }

    if (result?.key !== key || !result.svg)
    {
        return (
            <Text
                accessibilityLabel="Loading equation"
                style={ LoadingStyle }>
                { expression }
            </Text>
        );
    }
    return (
        <View
            accessibilityLabel={ `Equation: ${ expression }` }
            style={ RootStyle }>
            <SvgXml
                height={ display ? theme.fontSize * 3 : theme.fontSize * 1.7 }
                width="100%"
                xml={ result.svg }
            />
        </View>
    );
}
