import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNotionMarkdown,
  findNotionBlockPath,
  getNotionBlock,
  updateNotionBlock,
  removeNotionBlock,
  insertNotionBlockRelative,
  appendNotionChild,
  moveNotionBlock,
  indentNotionBlock,
  outdentNotionBlock,
  getNotionBlockRichText,
  setNotionBlockRichText,
  isNotionTextBearingBlockType,
  isNotionListBlockType
} from 'react-native-notion-markdown/document';

function paragraph(id, text) {
  return { id, type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: text } }] }, __notion_markdown: { editorId: id } };
}

function docOf(...blocks) {
  return { version: 1, blocks };
}

test('findNotionBlockPath / getNotionBlock resolve top-level and nested blocks by editor id', () => {
  const doc = docOf(
    paragraph('a', 'A'),
    { ...paragraph('b', 'B'), children: [paragraph('b1', 'B1')] }
  );
  assert.deepEqual(findNotionBlockPath(doc, 'a'), [0]);
  assert.deepEqual(findNotionBlockPath(doc, 'b1'), [1, 0]);
  assert.equal(findNotionBlockPath(doc, 'missing'), undefined);
  assert.equal(getNotionBlock(doc, 'b1').paragraph.rich_text[0].text.content, 'B1');
});

test('updateNotionBlock replaces one block while leaving unrelated siblings referentially unchanged', () => {
  const doc = docOf(paragraph('a', 'A'), paragraph('b', 'B'), paragraph('c', 'C'));
  const untouchedSibling = doc.blocks[2];
  const next = updateNotionBlock(doc, 'b', (block) => setNotionBlockRichText(block, [{ type: 'text', text: { content: 'Changed' } }]));
  assert.equal(next.blocks[1].paragraph.rich_text[0].text.content, 'Changed');
  assert.equal(next.blocks[0], doc.blocks[0]);
  assert.equal(next.blocks[2], untouchedSibling);
});

test('updateNotionBlock returns the same document unchanged when the block id is missing', () => {
  const doc = docOf(paragraph('a', 'A'));
  assert.equal(updateNotionBlock(doc, 'missing', (b) => b), doc);
});

test('removeNotionBlock removes a nested block without disturbing its siblings', () => {
  const doc = docOf({ ...paragraph('parent', 'P'), children: [paragraph('c1', 'C1'), paragraph('c2', 'C2')] });
  const next = removeNotionBlock(doc, 'c1');
  assert.equal(next.blocks[0].children.length, 1);
  assert.equal(next.blocks[0].children[0].id, 'c2');
});

test('insertNotionBlockRelative inserts before and after an anchor at the top level', () => {
  const doc = docOf(paragraph('a', 'A'), paragraph('c', 'C'));
  const withB = insertNotionBlockRelative(doc, 'a', paragraph('b', 'B'), 'after');
  assert.deepEqual(withB.blocks.map((b) => b.id), ['a', 'b', 'c']);
  const withZ = insertNotionBlockRelative(doc, 'a', paragraph('z', 'Z'), 'before');
  assert.deepEqual(withZ.blocks.map((b) => b.id), ['z', 'a', 'c']);
});

test('appendNotionChild appends as the last child, creating the children array if absent', () => {
  const doc = docOf(paragraph('a', 'A'));
  const next = appendNotionChild(doc, 'a', paragraph('a1', 'A1'));
  assert.deepEqual(next.blocks[0].children.map((b) => b.id), ['a1']);
  const withSecond = appendNotionChild(next, 'a', paragraph('a2', 'A2'));
  assert.deepEqual(withSecond.blocks[0].children.map((b) => b.id), ['a1', 'a2']);
});

test('moveNotionBlock swaps with the adjacent sibling and is a no-op at the boundary', () => {
  const doc = docOf(paragraph('a', 'A'), paragraph('b', 'B'), paragraph('c', 'C'));
  const movedUp = moveNotionBlock(doc, 'b', 'up');
  assert.deepEqual(movedUp.blocks.map((b) => b.id), ['b', 'a', 'c']);
  const noop = moveNotionBlock(doc, 'a', 'up');
  assert.deepEqual(noop.blocks.map((b) => b.id), ['a', 'b', 'c']);
});

test('indentNotionBlock nests under the previous sibling and is a no-op when first', () => {
  const doc = docOf(paragraph('a', 'A'), paragraph('b', 'B'));
  const indented = indentNotionBlock(doc, 'b');
  assert.deepEqual(indented.blocks.map((b) => b.id), ['a']);
  assert.deepEqual(indented.blocks[0].children.map((b) => b.id), ['b']);
  const noop = indentNotionBlock(doc, 'a');
  assert.deepEqual(noop.blocks.map((b) => b.id), ['a', 'b']);
});

test('outdentNotionBlock un-nests to become the next sibling of its parent, and is a no-op at the top level', () => {
  const doc = docOf({ ...paragraph('a', 'A'), children: [paragraph('a1', 'A1'), paragraph('a2', 'A2')] }, paragraph('b', 'B'));
  const outdented = outdentNotionBlock(doc, 'a1');
  assert.deepEqual(outdented.blocks.map((b) => b.id), ['a', 'a1', 'b']);
  assert.deepEqual(outdented.blocks[0].children.map((b) => b.id), ['a2']);
  const noop = outdentNotionBlock(doc, 'a');
  assert.equal(noop, doc);
});

test('indent then outdent round trips back to the original sibling order', () => {
  const doc = docOf(paragraph('a', 'A'), paragraph('b', 'B'), paragraph('c', 'C'));
  const indented = indentNotionBlock(doc, 'b');
  const restored = outdentNotionBlock(indented, 'b');
  assert.deepEqual(restored.blocks.map((b) => b.id), ['a', 'b', 'c']);
});

test('getNotionBlockRichText / setNotionBlockRichText read and write the type-keyed payload', () => {
  const block = paragraph('a', 'A');
  assert.equal(getNotionBlockRichText(block)[0].text.content, 'A');
  const updated = setNotionBlockRichText(block, [{ type: 'text', text: { content: 'Z' } }]);
  assert.equal(updated.paragraph.rich_text[0].text.content, 'Z');
  assert.equal(updated.paragraph.color, undefined);
});

test('getNotionBlockRichText returns undefined for a block type with no rich_text field', () => {
  const divider = { id: 'd', type: 'divider', divider: {} };
  assert.equal(getNotionBlockRichText(divider), undefined);
});

test('isNotionTextBearingBlockType / isNotionListBlockType classify the block catalog', () => {
  assert.equal(isNotionTextBearingBlockType('paragraph'), true);
  assert.equal(isNotionTextBearingBlockType('heading_2'), true);
  assert.equal(isNotionTextBearingBlockType('divider'), false);
  assert.equal(isNotionTextBearingBlockType('table'), false);
  assert.equal(isNotionListBlockType('bulleted_list_item'), true);
  assert.equal(isNotionListBlockType('to_do'), true);
  assert.equal(isNotionListBlockType('paragraph'), false);
});

test('tree operations work against a real parsed document, matching editor ids from the parser', () => {
  const parsed = parseNotionMarkdown('First\nSecond\n- Item one\n- Item two').document;
  const firstId = parsed.blocks[0].__notion_markdown.editorId;
  const listId = parsed.blocks[2].__notion_markdown.editorId;
  assert.notEqual(findNotionBlockPath(parsed, firstId), undefined);
  const indented = indentNotionBlock(parsed, listId);
  assert.equal(indented.blocks.length, 3);
});
