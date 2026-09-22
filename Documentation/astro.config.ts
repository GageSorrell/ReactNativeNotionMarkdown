/**
 *
 *
 * @module @react-native-notion-markdown/documentation/astro.config
 *
 * @file      astro.config.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import mdx from "@astrojs/mdx";
import { rehypeHeadingIds, unified } from "@astrojs/markdown-remark";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import expressiveCode, { type AstroExpressiveCodeOptions } from "astro-expressive-code";
import { defineConfig, fontProviders } from "astro/config";
import { fileURLToPath } from "node:url";
import { rehypeHeadingLinks } from "./src/features/docs/rehype-heading-links";

const FontsourceProvider = fontProviders.fontsource();

const expressiveCodeOptions: AstroExpressiveCodeOptions = {
    themes: [ "github-light", "github-dark" ],
    useDarkModeMediaQuery: false,
    themeCssSelector: (theme) => theme.type === "dark" ? "[data-theme='dark']" : false
};

// https://astro.build/config
export default defineConfig({
    site: process.env.PUBLIC_SITE_URL,
    trailingSlash: "never",

    compressHTML: true,

    markdown: {
        processor: unified({
            rehypePlugins: [ rehypeHeadingIds, rehypeHeadingLinks ]
        })
    },

    vite: {
        plugins: [ tailwindcss() ],
        resolve: {
            dedupe: [ "react", "react-dom" ],
            alias: {
                "@/": fileURLToPath(new URL("./src/", import.meta.url)),
                "@astrojs/starlight/components": fileURLToPath(
                    new URL("./src/components/docs/starlight-shim.ts", import.meta.url)
                )
            }
        }
    },

    integrations: [ expressiveCode(expressiveCodeOptions), react(), mdx() ],

    fonts: [
        {
            provider: FontsourceProvider,
            name: "Inter",
            weights: [ "100 900" ],
            styles: [ "normal", "italic" ],
            cssVariable: "--font-inter",
            fallbacks: [ "ui-sans-serif", "system-ui", "sans-serif" ]
        },
        {
            provider: FontsourceProvider,
            name: "JetBrains Mono",
            weights: [ "300 700" ],
            styles: [ "normal", "italic" ],
            display: "swap",
            cssVariable: "--font-jetbrains-mono",
            fallbacks: [ "ui-monospace", "SFMono-Regular", "monospace" ]
        }
    ],

    redirects: {
        "/docs": "/docs/v1/onboarding/introduction"
    }
});
