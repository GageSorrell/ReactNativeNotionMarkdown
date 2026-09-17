/**
 *
 *
 * @module notion-markdown-storybook/Stories/NativeProof.stories
 *
 * @file      NativeProof.stories.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { Meta, StoryObj } from "@storybook/react-native";
import { NativeProof } from "../NativeProof";

const meta =
    {
        component: NativeProof,
        parameters: { layout: "fullscreen" },
        title: "Milestone 1/Native editing proof"
    } satisfies Meta<typeof NativeProof>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ThreeBlocks: Story = { };
