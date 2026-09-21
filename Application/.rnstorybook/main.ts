/**
 *
 *
 * @module notion-markdown-storybook/Application/.rnstorybook/main
 *
 * @file      main.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { StorybookConfig } from "@storybook/react-native";

const config: StorybookConfig = {
    deviceAddons: [
        "@storybook/addon-ondevice-controls",
        "storybook-dark-mode"
    ],
    stories: [ "../**/*.stories.?(ts|tsx)" ]
};

export default config;
