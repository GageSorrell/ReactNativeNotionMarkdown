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

import type { useMarkdownDevTools as UseMarkdownDevToolsHook } from "./useMarkdownDevTools";

export type {
  UseMarkdownDevToolsOptions,
  UseMarkdownDevToolsResult
} from "./useMarkdownDevTools";
export * from "./protocol";

type UseMarkdownDevToolsHookType = typeof UseMarkdownDevToolsHook;

declare const require: (moduleId: string) => { useMarkdownDevTools: UseMarkdownDevToolsHookType };

export let useMarkdownDevTools: UseMarkdownDevToolsHookType;

// @ts-expect-error process.env.NODE_ENV is defined by metro transform plugins
if (process.env.NODE_ENV !== "production") {
  useMarkdownDevTools = require("./useMarkdownDevTools").useMarkdownDevTools;
} else {
  useMarkdownDevTools = () => ({
    reportCommand: () => {},
    reportError: () => {},
    reportEvent: () => {}
  });
}
