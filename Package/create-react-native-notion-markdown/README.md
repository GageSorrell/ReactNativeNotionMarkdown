# create-react-native-notion-markdown

Install `react-native-notion-markdown` and choose which optional peer dependencies belong in your React Native app.

Run the installer from your app directory:

```sh
npx create-react-native-notion-markdown
```

In an interactive terminal, choose all optional peers, the Expo integrations without Lucide icons, or Lucide icons only. Pass a choice for scripts and other noninteractive environments:

```sh
npx create-react-native-notion-markdown all
npx create-react-native-notion-markdown no-icons
npx create-react-native-notion-markdown icons
```

The installer reads the current app's `package.json`, then uses its declared package manager or the one identified by its only lockfile. When Expo is needed, the app must have a local Expo CLI available; the installer runs `expo install` so Expo can select compatible package versions. The `icons` choice uses Expo only if the app declares `expo` in `dependencies`.

`all` installs the main package and all optional peers. `no-icons` installs all optional Expo integration peers. `icons` installs only `lucide-react-native` alongside the main package.
