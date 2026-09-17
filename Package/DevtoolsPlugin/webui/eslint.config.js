/**
 * @file      eslint.config.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import BaseConfig from "../../../Configuration/eslint.config.js";

export default [
    ...BaseConfig,
    {
        files: [ "**/*.ts", "**/*.tsx" ],
        rules:
        {
            "@sorrell/jsdoc-module-name-package": "off",
            "@stylistic/brace-style": "off",
            "@stylistic/indent": "off",
            "import/no-named-as-default": "off",
            "jsdoc/require-jsdoc": "off",
            quotes: "off"
        }
    }
];
