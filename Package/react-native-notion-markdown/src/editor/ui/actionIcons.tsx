/**
 * Inline vector icons used by the built-in block-actions sheet.
 *
 * @module react-native-notion-markdown/editor/ui/actionIcons
 *
 * @file      actionIcons.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Path, Rect, Svg } from "react-native-svg";
import type { MarkdownEditorIconProps } from "./MarkdownEditor.tsx";

/** Render the duplicate ("copy") icon. */
export function CopyActionIcon({ color, size, strokeWidth }: MarkdownEditorIconProps)
{
    return <Svg height={ size }
        viewBox="0 0 24 24"
        width={ size }>
        <Rect fill="none"
            height="13"
            rx="2"
            stroke={ color }
            strokeWidth={ strokeWidth }
            width="13"
            x="9"
            y="9" />
        <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
            fill="none"
            stroke={ color }
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={ strokeWidth } />
    </Svg>;
}

/** Render the delete ("trash can") icon. */
export function TrashActionIcon({ color, size, strokeWidth }: MarkdownEditorIconProps)
{
    return <Svg height={ size }
        viewBox="0 0 24 24"
        width={ size }>
        <Path d="M3 6h18"
            fill="none"
            stroke={ color }
            strokeLinecap="round"
            strokeWidth={ strokeWidth } />
        <Path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
            fill="none"
            stroke={ color }
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={ strokeWidth } />
        <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"
            fill="none"
            stroke={ color }
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={ strokeWidth } />
        <Path d="M10 11v6M14 11v6"
            fill="none"
            stroke={ color }
            strokeLinecap="round"
            strokeWidth={ strokeWidth } />
    </Svg>;
}

/** Render the right-facing chevron used to indicate a navigable action row. */
export function ChevronRightActionIcon({ color, size, strokeWidth }: MarkdownEditorIconProps)
{
    return <Svg height={ size }
        viewBox="0 0 24 24"
        width={ size }>
        <Path d="m9 18 6-6-6-6"
            fill="none"
            stroke={ color }
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={ strokeWidth } />
    </Svg>;
}
