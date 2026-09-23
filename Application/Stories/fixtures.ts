/**
 * Local media fixtures shared by renderer story previews. Fixture URLs resolve to a downloaded
 * asset; any other URL is passed through unchanged so stories can also demo remote sources.
 *
 * @module markdown-storybook/Stories/fixtures
 *
 * @file      fixtures.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Asset } from "expo-asset";
import type { MarkdownMediaRequest } from "react-native-notion-markdown/renderer/ui";

const fixtures: Record<string, number> =
    {
        "fixture://audio": require("../fixtures/preview.wav"),
        "fixture://image": require("../fixtures/preview.png"),
        "fixture://pdf": require("../fixtures/preview.pdf"),
        "fixture://video": require("../fixtures/preview.mp4")
    } as const;

/** Resolve a local `fixture://` URL to a downloaded asset URI; pass any other URL through as-is. */
export async function resolveFixture(request: MarkdownMediaRequest): Promise<string | null>
{
    const module = request.url ? fixtures[request.url] : undefined;

    if (!module)
    {
        return request.url ?? null;
    }

    const asset = await Asset.fromModule(module).downloadAsync();
    return asset.localUri ?? asset.uri;
}
