/**
 * Inline vector icons used by the built-in insert-media sheet.
 *
 * @module react-native-notion-markdown/editor/ui/mediaIcons
 *
 * @file      mediaIcons.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Circle, Path, Polygon, Rect, Svg } from "react-native-svg";
import type { NotionEditorIconProps } from "./NotionEditor.tsx";

/**
 * Render the gallery icon.
 *
 * @since 1.0.0
 */
export function GalleryIcon({ color, size, strokeWidth }: NotionEditorIconProps)
{
    return <Svg height={ size }
        viewBox="0 0 24 24"
        width={ size }>
        <Rect fill="none"
            height="18"
            rx="2"
            stroke={ color }
            strokeWidth={ strokeWidth }
            width="18"
            x="3"
            y="3" />
        <Circle cx="8.5"
            cy="8.5"
            fill={ color }
            r="1.5" />
        <Path d="m21 15-5-5L5 21"
            fill="none"
            stroke={ color }
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={ strokeWidth } />
    </Svg>;
}

/** Render the camera icon. */
export function CameraIcon({ color, size, strokeWidth }: NotionEditorIconProps)
{
    return <Svg height={ size }
        viewBox="0 0 24 24"
        width={ size }>
        <Path d="M4 7h3l1.5-2h7L17 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
            fill="none"
            stroke={ color }
            strokeLinejoin="round"
            strokeWidth={ strokeWidth } />
        <Circle cx="12"
            cy="13"
            fill="none"
            r="3.5"
            stroke={ color }
            strokeWidth={ strokeWidth } />
    </Svg>;
}

/** Render the video-camera icon. */
export function VideoIcon({ color, size, strokeWidth }: NotionEditorIconProps)
{
    return <Svg height={ size }
        viewBox="0 0 24 24"
        width={ size }>
        <Rect fill="none"
            height="16"
            rx="2"
            stroke={ color }
            strokeWidth={ strokeWidth }
            width="14"
            x="2"
            y="4" />
        <Polygon fill="none"
            points="16,10 22,7 22,17 16,14"
            stroke={ color }
            strokeLinejoin="round"
            strokeWidth={ strokeWidth } />
        <Path d="m10 9 4 3-4 3Z"
            fill={ color } />
    </Svg>;
}
