/**
 *
 *
 * @module notion-markdown-storybook/Application/.rnstorybook/preview
 *
 * @file      preview.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { Preview } from "@storybook/react-native";

const preview: Preview = {
    parameters: {
        actions: { argTypesRegex: "^on[A-Z].*" },
        controls: { expanded: true }
    }
};

export default preview;
