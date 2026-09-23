/**
 * @module react-native-notion-markdown/MarkdownModule
 *
 * @file      MarkdownModule.ts
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
export interface MarkdownModule
{
    hello(): string;
}

/**
 * The loaded native Markdown module.
 *
 * @since 1.0.0
 */
export default requireNativeModule<MarkdownModule>("Markdown");
