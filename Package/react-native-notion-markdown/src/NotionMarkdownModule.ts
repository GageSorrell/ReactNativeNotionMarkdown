/**
 * @module react-native-notion-markdown/NotionMarkdownModule
 *
 * @file      NotionMarkdownModule.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { requireNativeModule } from "expo-modules-core";

/**
 * The native module surface exposed by the package.
 *
 * @since 1.0.0
 */
export interface NotionMarkdownModule
{
    hello(): string;
}

/**
 * The loaded native Notion Markdown module.
 *
 * @since 1.0.0
 */
export default requireNativeModule<NotionMarkdownModule>("NotionMarkdown");
