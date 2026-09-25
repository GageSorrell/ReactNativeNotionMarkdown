/**
 *
 *
 * @module react-native-notion-markdown/editor/ui/audioIcons
 *
 * @file      audioIcons.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Inline vector icons used by the built-in insert-audio sheet.
 *
 * @module react-native-notion-markdown/editor/ui/audioIcons
 */

import { Circle, Path, Rect, Svg } from "react-native-svg";
import type { MarkdownEditorIconProps } from "./customization.ts";

/** Render a document-with-audio icon. */
export function AudioFileIcon({ color, size, strokeWidth }: MarkdownEditorIconProps)
{
    return <Svg height={ size }
        viewBox="0 0 24 24"
        width={ size }>
        <Path d="M6 3h8l4 4v14H6Z"
            fill="none"
            stroke={ color }
            strokeLinejoin="round"
            strokeWidth={ strokeWidth } />
        <Path d="M14 3v5h5"
            fill="none"
            stroke={ color }
            strokeLinejoin="round"
            strokeWidth={ strokeWidth } />
        <Path d="M9 14v3m3-5v7m3-5v4"
            fill="none"
            stroke={ color }
            strokeLinecap="round"
            strokeWidth={ strokeWidth } />
    </Svg>;
}

/** Render a microphone icon. */
export function MicrophoneIcon({ color, size, strokeWidth }: MarkdownEditorIconProps)
{
    return <Svg height={ size }
        viewBox="0 0 24 24"
        width={ size }>
        <Rect fill="none"
            height="12"
            rx="3"
            stroke={ color }
            strokeWidth={ strokeWidth }
            width="6"
            x="9"
            y="3" />
        <Path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8"
            fill="none"
            stroke={ color }
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={ strokeWidth } />
    </Svg>;
}

/** Render a stop icon. */
export function StopIcon({ color, size, strokeWidth }: MarkdownEditorIconProps)
{
    return <Svg height={ size }
        viewBox="0 0 24 24"
        width={ size }>
        <Rect fill="none"
            height="10"
            rx="2"
            stroke={ color }
            strokeLinejoin="round"
            strokeWidth={ strokeWidth }
            width="10"
            x="7"
            y="7" />
    </Svg>;
}

/** Render a cancel icon. */
export function CancelIcon({ color, size, strokeWidth }: MarkdownEditorIconProps)
{
    return <Svg height={ size }
        viewBox="0 0 24 24"
        width={ size }>
        <Circle cx="12"
            cy="12"
            fill="none"
            r="9"
            stroke={ color }
            strokeWidth={ strokeWidth } />
        <Path d="m9 9 6 6m0-6-6 6"
            fill="none"
            stroke={ color }
            strokeLinecap="round"
            strokeWidth={ strokeWidth } />
    </Svg>;
}

/** Render a checkmark icon. */
export function CheckIcon({ color, size, strokeWidth }: MarkdownEditorIconProps)
{
    return <Svg height={ size }
        viewBox="0 0 24 24"
        width={ size }>
        <Path d="m5 12 4 4L19 6"
            fill="none"
            stroke={ color }
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={ strokeWidth } />
    </Svg>;
}

/** Render a play icon. */
export function PlayIcon({ color, size, strokeWidth }: MarkdownEditorIconProps)
{
    return <Svg height={ size }
        viewBox="0 0 24 24"
        width={ size }>
        <Path d="m8 5 11 7-11 7Z"
            fill="none"
            stroke={ color }
            strokeLinejoin="round"
            strokeWidth={ strokeWidth } />
    </Svg>;
}

/** Render a pause icon. */
export function PauseIcon({ color, size, strokeWidth }: MarkdownEditorIconProps)
{
    return <Svg height={ size }
        viewBox="0 0 24 24"
        width={ size }>
        <Path d="M8 5v14m8-14v14"
            fill="none"
            stroke={ color }
            strokeLinecap="round"
            strokeWidth={ strokeWidth } />
    </Svg>;
}
