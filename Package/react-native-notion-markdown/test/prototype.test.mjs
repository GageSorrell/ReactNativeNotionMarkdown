import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createProofDocument,
  acceptProofEvent,
  proofPointAt,
  parseNotionMarkdown,
  serializeNotionMarkdown,
  fromNotionBlocks,
  toNotionBlocks,
  notionSelectionPointAt,
  getNotionEditableFields,
  createNotionEditor
} from 'react-native-notion-markdown/renderer';

test('renderer entry loads without React Native; seed has three stable blocks', () => {
  assert.equal(createProofDocument().blocks.length, 3);
});
test('package root exposes the pure engine without loading Expo', async () => {
  const root = await import('react-native-notion-markdown');
  assert.equal(typeof root.parseNotionMarkdown, 'function');
});
test('epoch and revision reject stale events, preserving unaffected blocks', () => {
  const initial = createProofDocument();
  const event = { ...initial, revision: 1, blocks: initial.blocks.map((b, i) => i ? b : { ...b, text: 'changed' }) };
  const updated = acceptProofEvent(initial, event);
  assert.equal(updated.blocks[1], initial.blocks[1]);
  assert.equal(updated.blocks[0].text, 'changed');
  assert.equal(acceptProofEvent(updated, event), updated);
  assert.equal(acceptProofEvent(createProofDocument(2), event).epoch, 2);
});
test('UTF-16 mapping includes separators and clamps endpoints', () => {
  const blocks = [{ id: 'a', type: 'paragraph', text: '👋' }, { id: 'b', type: 'paragraph', text: 'אבג' }];
  assert.equal(proofPointAt(blocks, 2).offset, 2);
  assert.deepEqual(proofPointAt(blocks, 3), { blockId: 'b', field: 'rich_text', offset: 0 });
  assert.equal(proofPointAt(blocks, 99).offset, 3);
});
test('invalid or duplicate payloads cannot enter the store', () => {
  const initial = createProofDocument();
  assert.equal(acceptProofEvent(initial, { ...initial, revision: 1, blocks: [] }), initial);
  assert.equal(acceptProofEvent(initial, { ...initial, revision: 1, blocks: [initial.blocks[0], initial.blocks[0]] }), initial);
  assert.equal(acceptProofEvent(initial, { ...initial, revision: 1, blocks: [{ ...initial.blocks[0], text: 'bad\nseparator' }] }), initial);
});
test('soft breaks stay in a block; empty blocks have selectable endpoints', () => {
  const blocks = [{ id: 'empty', type: 'paragraph', text: '' }, { id: 'soft', type: 'paragraph', text: 'a\u2028b' }];
  assert.deepEqual(proofPointAt(blocks, 0), { blockId: 'empty', field: 'rich_text', offset: 0 });
  assert.deepEqual(proofPointAt(blocks, 3), { blockId: 'soft', field: 'rich_text', offset: 2 });
  assert.throws(() => proofPointAt([], 0), /at least one block/);
});

test('Milestone 2 parses rich text and block attributes', () => {
  const result = parseNotionMarkdown('# Title **bold** *italic* ~~strike~~ <span underline="true" color="red">ink</span> [link](https://example.com)');
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
  const result = parseNotionMarkdown(markdown);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.document.blocks[0].type, 'toggle');
  assert.equal(result.document.blocks[0].children[0].type, 'bulleted_list_item');
  assert.equal(result.document.blocks[1].type, 'column_list');
  assert.equal(result.document.blocks[2].table.table_width, 1);
  assert.equal(result.document.blocks[3].code.rich_text[0].text.content, '**literal** \\ $x$');
  assert.equal(result.document.blocks[4].paragraph.rich_text[0].mention.user.id, 'abc123');
  assert.match(serializeNotionMarkdown(result.document), /<table/);
});

test('Milestone 2 adapters preserve IDs and report unresolved SDK conversions', () => {
  const imported = fromNotionBlocks([
    { object: 'block', id: '11111111-1111-1111-1111-111111111111', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 'Remote' }, annotations: {} }] } }
  ]);
  const block = imported.document.blocks[0];
  assert.equal(block.id, '11111111-1111-1111-1111-111111111111');
  assert.equal(block.__notion_markdown.notionId, block.id);
  assert.notEqual(block.__notion_markdown.editorId, block.id);
  assert.equal(toNotionBlocks(imported.document).blocks[0].paragraph.rich_text[0].text.content, 'Remote');

  const unresolved = parseNotionMarkdown('<page url="https://www.notion.so/page">Title</page>').document;
  const converted = toNotionBlocks(unresolved);
  assert.equal(converted.blocks.length, 0);
  assert.equal(converted.diagnostics[0].code, 'unresolved-page-reference');
  assert.throws(() => toNotionBlocks(unresolved, { strict: true }), /unresolved-page-reference/);
});

test('Milestone 2 preserves dates and translates background colors at the SDK boundary', () => {
  const parsed = parseNotionMarkdown('# Color {color="blue_bg"}\nDate <mention-date start="2026-09-16" startTime="09:30" timeZone="America/Indiana/Indianapolis"/>');
  const sdk = toNotionBlocks(parsed.document);
  assert.equal(sdk.blocks[0].heading_1.color, 'blue_background');
  assert.equal(sdk.blocks[1].paragraph.rich_text[1].mention.date.start, '2026-09-16T09:30');
  assert.match(serializeNotionMarkdown(parsed.document), /mention-date start="2026-09-16"/);
});

test('Milestone 2 selection mapping and grouped history use immutable snapshots', () => {
  const store = createNotionEditor('One\nTwo');
  const initial = store.getDocument();
  const fields = getNotionEditableFields(initial);
  assert.equal(fields.length, 2);
  assert.equal(notionSelectionPointAt(initial, 4).blockId, fields[1].blockId);
  store.transact((document) => ({ ...document, blocks: document.blocks.map((block) => block.type === 'paragraph' ? { ...block, paragraph: { ...block.paragraph, rich_text: [{ type: 'text', text: { content: 'Changed' } }] } } : block) }), 'user');
  store.transact((document) => ({ ...document, blocks: document.blocks.map((block) => block.type === 'paragraph' ? { ...block, paragraph: { ...block.paragraph, rich_text: [{ type: 'text', text: { content: 'Changed twice' } }] } } : block) }), 'user');
  assert.equal(store.undo(), true);
  assert.equal(store.getMarkdown(), 'One\nTwo');
  assert.equal(store.redo(), true);
  assert.match(store.getMarkdown(), /Changed twice/);
});
