import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEditorDocument,
  acceptEditorEvent,
  editorPointAt,
  parseMarkdown,
  serializeMarkdown,
  fromMarkdownBlocks,
  toMarkdownBlocks,
  markdownSelectionPointAt,
  getMarkdownEditableFields,
  createMarkdownEditor,
  createMarkdownCommands,
  insertTableAfter,
  clearTableContents,
  makeMarkdownTableBlock
} from 'react-native-notion-markdown/renderer';

test('renderer entry loads without React Native; seed has three stable blocks', () => {
  assert.equal(createEditorDocument().blocks.length, 3);
});
test('package root exposes the pure engine without loading Expo', async () => {
  const root = await import('react-native-notion-markdown');
  assert.equal(typeof root.parseMarkdown, 'function');
});
test('code fences tolerate Notion theme=null metadata for all language forms', () => {
  const source = [
    '```html theme={null}',
    '<div>HTML</div>',
    '```',
    '',
    '``` theme={null}',
    'plain text',
    '```'
  ].join('\n');
  const parsed = parseMarkdown(source);
  assert.equal(parsed.diagnostics.length, 0);
  assert.deepEqual(parsed.document.blocks.map((block) => block.code.language), [ 'html', 'plain text' ]);
  assert.equal(serializeMarkdown(parsed.document), [
    '```html',
    '<div>HTML</div>',
    '```',
    '```plain text',
    'plain text',
    '```'
  ].join('\n'));
  assert.equal(serializeMarkdown(parsed.document, { includeCodeBlockThemeNull: true }), [
    '```html theme={null}',
    '<div>HTML</div>',
    '```',
    '```plain text theme={null}',
    'plain text',
    '```'
  ].join('\n'));
});
test('the editor store can opt into theme=null code fences when returning Markdown', () => {
  const store = createMarkdownEditor('```javascript\nconst value = 1;\n```');
  assert.equal(store.getMarkdown(), '```javascript\nconst value = 1;\n```');
  assert.equal(
    store.getMarkdown({ includeCodeBlockThemeNull: true }),
    '```javascript theme={null}\nconst value = 1;\n```'
  );
});
test('epoch and revision reject stale events, preserving unaffected blocks', () => {
  const initial = createEditorDocument();
  const event = { ...initial, revision: 1, blocks: initial.blocks.map((b, i) => i ? b : { ...b, text: 'changed' }) };
  const updated = acceptEditorEvent(initial, event);
  assert.equal(updated.blocks[1], initial.blocks[1]);
  assert.equal(updated.blocks[0].text, 'changed');
  assert.equal(acceptEditorEvent(updated, event), updated);
  assert.equal(acceptEditorEvent(createEditorDocument(2), event).epoch, 2);
});
test('UTF-16 mapping includes separators and clamps endpoints', () => {
  const blocks = [{ id: 'a', type: 'text', text: '👋' }, { id: 'b', type: 'text', text: 'אבג' }];
  assert.equal(editorPointAt(blocks, 2).offset, 2);
  assert.deepEqual(editorPointAt(blocks, 3), { blockId: 'b', field: 'rich_text', offset: 0 });
  assert.equal(editorPointAt(blocks, 99).offset, 3);
});
test('invalid or duplicate payloads cannot enter the store', () => {
  const initial = createEditorDocument();
  assert.equal(acceptEditorEvent(initial, { ...initial, revision: 1, blocks: [] }), initial);
  assert.equal(acceptEditorEvent(initial, { ...initial, revision: 1, blocks: [initial.blocks[0], initial.blocks[0]] }), initial);
  assert.equal(acceptEditorEvent(initial, { ...initial, revision: 1, blocks: [{ ...initial.blocks[0], text: 'bad\nseparator' }] }), initial);
});
test('table snapshots validate rectangular cells, marks, colors, and stale revisions', () => {
  const initial = createEditorDocument();
  const table = {
    ...initial.blocks[0],
    text: '',
    type: 'table',
    table: {
      fitPageWidth: false,
      headerRow: true,
      headerColumn: false,
      columnColors: [ undefined, 'blue_bg' ],
      rows: [
        { color: 'gray_bg', cells: [
          { text: 'Name', marks: [ { kind: 'bold', start: 0, end: 4 } ] },
          { text: 'Value', color: 'green_bg' }
          ] }
      ]
    }
  };
  const event = {
    ...initial,
    blocks: [ table, ...initial.blocks.slice(1) ],
    revision: 1,
    anchor: { blockId: table.id, field: 'cell', row: 0, column: 0, offset: 4 },
    focus: { blockId: table.id, field: 'cell', row: 0, column: 0, offset: 4 }
  };
  const accepted = acceptEditorEvent(initial, event);
  assert.equal(accepted.blocks[0].table.rows[0].cells[1].color, 'green_bg');
  assert.equal(acceptEditorEvent(accepted, event), accepted);
  assert.equal(acceptEditorEvent(initial, {
    ...event,
    revision: 1,
    blocks: [ { ...table, table: { ...table.table, rows: [ { ...table.table.rows[0], cells: [ table.table.rows[0].cells[0] ] } ] } }, ...initial.blocks.slice(1) ]
  }), initial);
});
test('to-do editor blocks preserve checked state and reject it on other block types', () => {
  const initial = createEditorDocument();
  const todo = { ...initial.blocks[0], checked: true, type: 'to_do' };
  const accepted = acceptEditorEvent(initial, { ...initial, blocks: [todo, ...initial.blocks.slice(1)], revision: 1 });
  assert.equal(accepted.blocks[0].checked, true);
  const invalid = acceptEditorEvent(initial, {
    ...initial,
    blocks: [{ ...initial.blocks[0], checked: true }, ...initial.blocks.slice(1)],
    revision: 1
  });
  assert.equal(invalid, initial);
});
test('column editor blocks preserve supported column counts', () => {
  const initial = createEditorDocument();
  for (const columnCount of [ 2, 3, 4, 5 ]) {
    const columns = { ...initial.blocks[0], columnCount, text: '\u200B', type: 'column_list' };
    const accepted = acceptEditorEvent(initial, {
      ...initial,
      blocks: [columns, ...initial.blocks.slice(1)],
      revision: columnCount
    });
    assert.equal(accepted.blocks[0].columnCount, columnCount);
  }
  const invalid = acceptEditorEvent(initial, {
    ...initial,
    blocks: [{ ...initial.blocks[0], columnCount: 6, text: '\u200B', type: 'column_list' }, ...initial.blocks.slice(1)],
    revision: 1
  });
  assert.equal(invalid, initial);
});
test('editor snapshots accept list block types for continued Enter items', () => {
  const initial = createEditorDocument();
  for (const type of [ 'bulleted_list_item', 'numbered_list_item' ]) {
    const list = { ...initial.blocks[0], text: 'Item', type };
    const accepted = acceptEditorEvent(initial, { ...initial, blocks: [list, ...initial.blocks.slice(1)], revision: 1 });
    assert.equal(accepted.blocks[0].type, type);
  }
});
test('page-reference editor blocks preserve URL and icon metadata', () => {
  const initial = createEditorDocument();
  const page = { ...initial.blocks[0], icon: '📄', text: 'A page', type: 'link_to_page', url: 'https://example.com/page' };
  const accepted = acceptEditorEvent(initial, { ...initial, blocks: [page, ...initial.blocks.slice(1)], revision: 1 });
  assert.equal(accepted.blocks[0].url, page.url);
  assert.equal(accepted.blocks[0].icon, page.icon);
  const invalid = acceptEditorEvent(initial, {
    ...initial,
    blocks: [{ ...page, url: undefined }, ...initial.blocks.slice(1)],
    revision: 1
  });
  assert.equal(invalid, initial);
});
test('media editor blocks preserve image and video URLs', () => {
  const initial = createEditorDocument();
  for (const type of [ 'image', 'video' ]) {
    const media = { ...initial.blocks[0], text: '', type, url: `file:///tmp/${type}.asset` };
    const accepted = acceptEditorEvent(initial, {
      ...initial,
      blocks: [media, ...initial.blocks.slice(1)],
      revision: 1
    });
    assert.equal(accepted.blocks[0].type, type);
    assert.equal(accepted.blocks[0].url, media.url);
    const invalid = acceptEditorEvent(initial, {
      ...initial,
      blocks: [{ ...media, url: undefined }, ...initial.blocks.slice(1)],
      revision: 1
    });
    assert.equal(invalid, initial);
  }
});
test('audio editor blocks preserve metadata and reject empty URLs', () => {
  const initial = createEditorDocument();
  const audio = {
    ...initial.blocks[0],
    duration: 12.5,
    fileName: 'memo.m4a',
    fileSize: 4096,
    mimeType: 'audio/mp4',
    text: '',
    type: 'audio',
    url: 'file:///tmp/memo.m4a'
  };
  const accepted = acceptEditorEvent(initial, { ...initial, blocks: [audio, ...initial.blocks.slice(1)], revision: 1 });
  assert.equal(accepted.blocks[0].type, 'audio');
  assert.equal(accepted.blocks[0].fileName, audio.fileName);
  assert.equal(accepted.blocks[0].duration, audio.duration);
  assert.equal(acceptEditorEvent(initial, { ...initial, blocks: [{ ...audio, url: '' }, ...initial.blocks.slice(1)], revision: 1 }), initial);
});
test('file editor blocks preserve metadata and reject empty URLs', () => {
  const initial = createEditorDocument();
  const file = {
    ...initial.blocks[0],
    fileName: 'brief.pdf',
    fileSize: 8192,
    mimeType: 'application/pdf',
    text: '',
    type: 'file',
    url: 'file:///tmp/brief.pdf'
  };
  const accepted = acceptEditorEvent(initial, { ...initial, blocks: [file, ...initial.blocks.slice(1)], revision: 1 });
  assert.equal(accepted.blocks[0].type, 'file');
  assert.equal(accepted.blocks[0].fileName, file.fileName);
  assert.equal(accepted.blocks[0].fileSize, file.fileSize);
  assert.equal(acceptEditorEvent(initial, { ...initial, blocks: [{ ...file, url: '' }, ...initial.blocks.slice(1)], revision: 1 }), initial);
});
test('audio Markdown preserves its URL and caption through a round trip', () => {
  const source = '<audio src="file:///tmp/memo.m4a">Voice **memo**</audio>';
  const parsed = parseMarkdown(source);
  assert.equal(parsed.document.blocks[0].type, 'audio');
  assert.equal(parsed.document.blocks[0].audio.external.url, 'file:///tmp/memo.m4a');
  assert.match(serializeMarkdown(parsed.document), /<audio src="file:\/\/\/tmp\/memo\.m4a">Voice \*\*memo\*\*<\/audio>/);
});
test('editor link marks preserve URLs and reject malformed links', () => {
  const initial = createEditorDocument();
  const linked = {
    ...initial.blocks[0],
    marks: [ { end: 5, kind: 'link', start: 0, url: 'https://example.com' } ]
  };
  const accepted = acceptEditorEvent(initial, {
    ...initial,
    blocks: [linked, ...initial.blocks.slice(1)],
    revision: 1
  });
  assert.equal(accepted.blocks[0].marks[0].url, 'https://example.com');
  const invalid = acceptEditorEvent(initial, {
    ...initial,
    blocks: [{ ...linked, marks: [ { ...linked.marks[0], url: '' } ] }, ...initial.blocks.slice(1)],
    revision: 1
  });
  assert.equal(invalid, initial);
});
test('soft breaks stay in a block; empty blocks have selectable endpoints', () => {
  const blocks = [{ id: 'empty', type: 'text', text: '' }, { id: 'soft', type: 'text', text: 'a\u2028b' }];
  assert.deepEqual(editorPointAt(blocks, 0), { blockId: 'empty', field: 'rich_text', offset: 0 });
  assert.deepEqual(editorPointAt(blocks, 3), { blockId: 'soft', field: 'rich_text', offset: 2 });
  assert.throws(() => editorPointAt([], 0), /at least one block/);
});

test('Milestone 2 parses rich text and block attributes', () => {
  const result = parseMarkdown('# Title **bold** *italic* ~~strike~~ <span underline="true" color="red">ink</span> [link](https://example.com)');
  const richText = result.document.blocks[0].heading_1.rich_text;
  assert.equal(result.diagnostics.length, 0);
  assert.equal(richText[1].annotations.bold, true);
  assert.equal(richText[3].annotations.italic, true);
  assert.equal(richText[5].annotations.strikethrough, true);
  assert.equal(richText[7].annotations.underline, true);
  assert.equal(richText[9].text.link.url, 'https://example.com');
});

test('Milestone 2 parses recursive containers, tables, mentions, and literal code', () => {
  const markdown = [
    '<details color="blue">',
    '<summary>More</summary>',
    '\t- Child',
    '</details>',
    '<columns>',
    '\t<column>',
    '\t\tColumn text',
    '\t</column>',
    '</columns>',
    '<table fit-page-width="true" header-row="true">',
    '\t<colgroup>',
    '\t\t<col color="blue">',
    '\t</colgroup>',
    '\t<tr color="gray"><td color="red">Cell **text**</td></tr>',
    '</table>',
    '```javascript',
    '**literal** \\ $x$',
    '```',
    '<mention-user url="{{user://abc123}}">Ada</mention-user>'
  ].join('\n');
  const result = parseMarkdown(markdown);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.document.blocks[0].type, 'toggle');
  assert.equal(result.document.blocks[0].children[0].type, 'bulleted_list_item');
  assert.equal(result.document.blocks[1].type, 'column_list');
  assert.equal(result.document.blocks[2].table.table_width, 1);
  assert.equal(result.document.blocks[3].code.rich_text[0].text.content, '**literal** \\ $x$');
  assert.equal(result.document.blocks[4].paragraph.rich_text[0].mention.user.id, 'abc123');
  assert.match(serializeMarkdown(result.document), /<table/);
});

test('table optional attributes and rich-text colors round trip canonically', () => {
  const markdown = [
    '<table fit-page-width="true" header-row="true" header-column="true">',
    '\t<colgroup>',
    '\t\t<col color="blue">',
    '\t\t<col>',
    '\t</colgroup>',
    '\t<tr color="gray"><td color="red">**Bold**</td><td><span color="green">Text</span></td></tr>',
    '\t<tr><td>Second</td><td>Row</td></tr>',
    '</table>'
  ].join('\n');
  const first = parseMarkdown(markdown);
  const serialized = serializeMarkdown(first.document);
  const second = parseMarkdown(serialized);
  const table = second.document.blocks[0];
  assert.deepEqual(second.diagnostics, []);
  assert.equal(table.__markdown_markdown.table.fitPageWidth, true);
  assert.equal(table.__markdown_markdown.table.headerRow, true);
  assert.equal(table.__markdown_markdown.table.headerColumn, true);
  assert.deepEqual(table.__markdown_markdown.table.columnColors, ['blue', undefined]);
  assert.equal(table.children[0].__markdown_markdown.table.rowColor, 'gray');
  assert.deepEqual(table.children[0].__markdown_markdown.table.cellColors, ['red', undefined]);
  assert.equal(table.children[0].table_row.cells[0][0].annotations.bold, true);
  assert.equal(table.children[0].table_row.cells[1][0].annotations.color, 'green');
});

test('Milestone 2 adapters preserve IDs and report unresolved SDK conversions', () => {
  const imported = fromMarkdownBlocks([
    { object: 'block', id: '11111111-1111-1111-1111-111111111111', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 'Remote' }, annotations: {} }] } }
  ]);
  const block = imported.document.blocks[0];
  assert.equal(block.id, '11111111-1111-1111-1111-111111111111');
  assert.equal(block.__markdown_markdown.markdownId, block.id);
  assert.notEqual(block.__markdown_markdown.editorId, block.id);
  assert.equal(toMarkdownBlocks(imported.document).blocks[0].paragraph.rich_text[0].text.content, 'Remote');

  const unresolved = parseMarkdown('<page url="https://www.markdown.so/page">Title</page>').document;
  const converted = toMarkdownBlocks(unresolved);
  assert.equal(converted.blocks.length, 0);
  assert.equal(converted.diagnostics[0].code, 'unresolved-page-reference');
  assert.throws(() => toMarkdownBlocks(unresolved, { strict: true }), /unresolved-page-reference/);
});

test('Milestone 2 preserves dates and translates background colors at the SDK boundary', () => {
  const parsed = parseMarkdown('# Color {color="blue_bg"}\nDate <mention-date start="2026-09-16" startTime="09:30" timeZone="America/Indiana/Indianapolis"/>');
  const sdk = toMarkdownBlocks(parsed.document);
  assert.equal(sdk.blocks[0].heading_1.color, 'blue_background');
  assert.equal(sdk.blocks[1].paragraph.rich_text[1].mention.date.start, '2026-09-16T09:30');
  assert.match(serializeMarkdown(parsed.document), /mention-date start="2026-09-16"/);
});

test('Milestone 2 selection mapping and grouped history use immutable snapshots', () => {
  const store = createMarkdownEditor('One\nTwo');
  const initial = store.getDocument();
  const fields = getMarkdownEditableFields(initial);
  assert.equal(fields.length, 2);
  assert.equal(markdownSelectionPointAt(initial, 4).blockId, fields[1].blockId);
  store.transact((document) => ({ ...document, blocks: document.blocks.map((block) => block.type === 'paragraph' ? { ...block, paragraph: { ...block.paragraph, rich_text: [{ type: 'text', text: { content: 'Changed' } }] } } : block) }), 'user');
  store.transact((document) => ({ ...document, blocks: document.blocks.map((block) => block.type === 'paragraph' ? { ...block, paragraph: { ...block.paragraph, rich_text: [{ type: 'text', text: { content: 'Changed twice' } }] } } : block) }), 'user');
  assert.equal(store.undo(), true);
  assert.equal(store.getMarkdown(), 'One\nTwo');
  assert.equal(store.redo(), true);
  assert.match(store.getMarkdown(), /Changed twice/);
});

test('table commands create a 3x3 grid and clear only the selected rectangle', () => {
  const store = createMarkdownEditor('Before');
  const firstBlockId = store.getDocument().blocks[0].id;
  const tableId = insertTableAfter(store, firstBlockId);
  const commands = createMarkdownCommands(store);
  const table = store.getDocument().blocks.find((block) => block.id === tableId);
  assert.equal(table.children.length, 3);
  assert.equal(table.children[0].table_row.cells.length, 3);
  const populated = {
    ...table.children[0],
    table_row: {
      ...table.children[0].table_row,
      cells: [ [ { type: 'text', text: { content: 'keep' } } ], [ { type: 'text', text: { content: 'clear' } } ], [] ]
    }
  };
  store.transact((document) => ({
    ...document,
    blocks: document.blocks.map((block) => block.id === tableId ? { ...block, children: [ populated, ...block.children.slice(1) ] } : block)
  }), 'user');
  commands.clearTableContents({ blockId: tableId, anchor: { row: 0, column: 1 }, focus: { row: 0, column: 1 } });
  const updated = store.getDocument().blocks.find((block) => block.id === tableId);
  assert.equal(updated.children[0].table_row.cells[0][0].text.content, 'keep');
  assert.deepEqual(updated.children[0].table_row.cells[1], []);
  assert.equal(makeMarkdownTableBlock().children.length, 3);
});
