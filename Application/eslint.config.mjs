/**
 * @file      eslint.config.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import BaseConfig from "../Configuration/eslint.config.js";

export default [
    ...BaseConfig,
    {
        files: [ "**/*.js", "**/*.mjs", "**/*.stories.tsx" ],
        rules:
        {
            "@typescript-eslint/typedef": "off",
            "jsdoc/require-description": "off",
            "jsdoc/require-jsdoc": "off",
            "jsdoc/require-param-description": "off",
            "jsdoc/ts-method-signature-style": "off"
        }
    }
];
