/**
 * @file      eslint.config.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import BaseConfig from "../Configuration/eslint.config.js";

export default [
    ...BaseConfig,
    {
        /* `.astro` files are not parsed by this flat config (no
           eslint-plugin-astro registered) — `astro check` covers those
           instead. This override only reaches this workspace's `.ts`/`.tsx`
           sources. */
        ignores: [ "**/*.astro" ],
    },
    {
        files: [ "src/**/*.{ts,tsx}" ],
        rules: {
            "@stylistic/array-bracket-spacing": "off",
            "@stylistic/brace-style": "off",
            "@stylistic/indent": "off",
            "@stylistic/jsx-curly-spacing": "off",
            "@stylistic/jsx-max-props-per-line": "off",
            "@stylistic/max-len": "off",
            "@stylistic/semi": "off",
            "@typescript-eslint/array-type": "off",
            "@typescript-eslint/naming-convention": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "@typescript-eslint/typedef": "off",
            curly: "off",
            "import/no-unresolved": "off",
            "jsdoc/escape-inline-tags": "off",
            "jsdoc/no-bad-blocks": "off",
            "jsdoc/require-file-overview": "off",
            "jsdoc/require-jsdoc": "off",
            "react-hooks/set-state-in-effect": "off",
            "react-perf/jsx-no-new-function-as-prop": "off",
            "react-perf/jsx-no-new-object-as-prop": "off",
            "react/jsx-sort-props": "off",
            "sort-imports": "off",
            "sort-keys": "off"
        }
    }
];
