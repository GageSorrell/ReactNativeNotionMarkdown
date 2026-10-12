# react-native-notion-markdown

`react-native-notion-markdown` provides a renderer and an editor for Notion-enhanced Markdown in React Native applications.

## Installation

Install the package in an Expo or React Native application that already has compatible React and React Native versions.

For the fully configured editor, install the package and its native and optional UI peers with Expo:

```sh
npx expo install react-native-notion-markdown @expo-google-fonts/inter expo-audio expo-document-picker expo-font expo-image-picker expo-linking expo-video lucide-react-native react-native-blob-util react-native-keyboard-controller react-native-pdf react-native-ratex react-native-reanimated react-native-svg react-native-webview
```

After installing native dependencies, rebuild the development client or native application before using the editor.

## Renderer

Use `react-native-notion-markdown/renderer` for document parsing and transformation, or `react-native-notion-markdown/renderer/ui` for the ready-to-use `MarkdownRenderer` component.

```tsx
import { MarkdownRenderer } from "react-native-notion-markdown/renderer/ui";

export function NotePreview()
{
    return <MarkdownRenderer markdown={ "# Hello\n\nThis is a note." } />;
}
```

## Editor

Use `react-native-notion-markdown/editor/ui` for the batteries included `MarkdownEditor` with the default toolbar, formatting panels, media actions, theming, localization, and native editor integration.

```tsx
import { useCallback } from "react";
import { StyleSheet } from "react-native";
import type { MarkdownDocument } from "react-native-notion-markdown";
import { MarkdownEditor } from "react-native-notion-markdown/editor/ui";

export function NoteEditor()
{
    const handleChange = useCallback((document: MarkdownDocument) =>
    {
        // Persist the document or serialize it when the user saves.
        void document;
    }, [ ]);

    return <MarkdownEditor initial={ "# Hello\n\nStart writing." } onChange={ handleChange } style={ styles.editor } />;
}

const styles = StyleSheet.create({
    editor: {
        flex: 1
    }
});
```

The editor reports a `MarkdownDocument` through `onChange`, which can be serialized with `serializeMarkdown` from the package root.

For lower-level integrations, `react-native-notion-markdown/editor` exposes the native editor primitives and `react-native-notion-markdown/document` exposes the platform-independent document model.
