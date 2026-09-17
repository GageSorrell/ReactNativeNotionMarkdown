import BaseConfig from "../../Configuration/eslint.config.js";

export default [
    ...BaseConfig,
    {
        files: [ "src/**/*.ts", "src/**/*.tsx" ],
        rules:
        {
            "@sorrell/jsdoc-module-name-package": "off",
            "@stylistic/brace-style": "off",
            "@stylistic/indent": "off",
            "jsdoc/require-jsdoc": "off",
            "quotes": "off",
            "import/no-named-as-default": "off"
        }
    }
];
