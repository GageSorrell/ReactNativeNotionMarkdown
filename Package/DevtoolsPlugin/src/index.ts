/**
 *
 *
 * @module @react-native-notion-markdown/devtools-plugin
 *
 * @file      index.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { useNotionMarkdownDevTools as UseNotionMarkdownDevToolsHook } from "./useNotionMarkdownDevTools";

export type {
  UseNotionMarkdownDevToolsOptions,
  UseNotionMarkdownDevToolsResult
} from "./useNotionMarkdownDevTools";
export * from "./protocol";

type UseNotionMarkdownDevToolsHookType = typeof UseNotionMarkdownDevToolsHook;

declare const require: (moduleId: string) => { useNotionMarkdownDevTools: UseNotionMarkdownDevToolsHookType };

export let useNotionMarkdownDevTools: UseNotionMarkdownDevToolsHookType;

// @ts-expect-error process.env.NODE_ENV is defined by metro transform plugins
if (process.env.NODE_ENV !== "production") {
  useNotionMarkdownDevTools = require("./useNotionMarkdownDevTools").useNotionMarkdownDevTools;
} else {
  useNotionMarkdownDevTools = () => ({
    reportCommand: () => {},
    reportError: () => {},
    reportEvent: () => {}
  });
}
