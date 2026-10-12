# `create-react-native-notion-markdown`

Install [`react-native-notion-markdown`](https://www.npmjs.com/package/react-native-notion-markdown) and choose how much of its *batteries-included* editor to add to a React Native app.

Run the installer from the app directory,

```sh
npm init react-native-notion-markdown
```

The interactive wizard offers:

- `none`: install only `react-native-notion-markdown`.
- `full`: install every third-party peer used by the editor and renderer.
- `some`: install the editor core, then choose individual features.

The selective feature choices are media picker, audio recording/playback, file and PDF support, equations, links and page references, Lucide icons, Inter fonts, and rich media previews.

Non-interactive invocations are also supported:

```sh
npm init react-native-notion-markdown -- none
npm init react-native-notion-markdown -- full
npm init react-native-notion-markdown -- some media,audio
```

The installer reads the app's `package.json`, prefers its declared `packageManager`, and otherwise detects a single lockfile before falling back to npm. For an app that already declares Expo, it uses the local Expo CLI's `expo install` command so Expo can select compatible versions. Otherwise it uses the detected package manager's install/add command.

The selective setup prints a starter `MarkdownEditor` component after installation. The snippet identifies callbacks and integrations that the app must supply for features that were not installed. Native dependencies require rebuilding the development client or native application.
