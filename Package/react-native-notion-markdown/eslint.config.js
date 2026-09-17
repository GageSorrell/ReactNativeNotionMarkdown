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
