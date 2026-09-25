/**
 * @file      eslint.config.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import BaseConfig from "../../Configuration/eslint.config.js";

export default [
    { ignores: [ "src/renderer/ui/mermaidRuntime.ts" ] },
    ...BaseConfig,
    {
        files: [ "src/**/*.ts", "src/**/*.tsx" ]
    },
    {
        /* Every color and the color scheme come from MarkdownProvider's theme (src/provider), never
           from literals or the device setting in UI code. */
        files: [ "src/editor/ui/**/*.{ts,tsx}", "src/renderer/ui/**/*.{ts,tsx}" ],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    paths: [
                        {
                            importNames: [ "useColorScheme" ],
                            message: "Resolve the color scheme through MarkdownProvider (useMarkdownColorScheme).",
                            name: "react-native"
                        }
                    ]
                }
            ],
            "no-restricted-syntax": [
                "error",
                {
                    message: "Colors come from the MarkdownTheme (src/provider/theme.ts).",
                    selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]"
                },
                {
                    message: "Colors come from the MarkdownTheme (src/provider/theme.ts).",
                    selector: "Literal[value=/^rgba?\\(/]"
                }
            ]
        }
    },
    {
        files: [ "src/renderer/ui/**/*.{ts,tsx}" ],
        rules: {
            "@stylistic/max-len": "off",
            "@typescript-eslint/typedef": "off",
            "jsdoc/no-blank-blocks": "off",
            "jsdoc/require-description": "off",
            "sort-imports": "off",
            "sort-keys": "off"
        }
    }
];
