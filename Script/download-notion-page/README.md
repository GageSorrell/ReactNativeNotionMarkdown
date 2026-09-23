# Download Notion page

Set `NOTION_TOKEN` in the environment, then run the command from the monorepo root:

```text
npm run start --workspace @react-native-notion-markdown/download-notion-page
```

The command first checks the clipboard for a Notion page link or page ID. If the clipboard does not contain one, it prompts for the link or ID, then prompts for the output file name. Use `--id` and `--out` to provide either or both values without prompting:

```text
npm run start --workspace @react-native-notion-markdown/download-notion-page -- --id <notion-link-or-page-id> --out notes.md
```

The resulting Notion-enhanced Markdown is written to `Local/`. Existing files are preserved; conflicts produce names such as `notes (1).md`.
