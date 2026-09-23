import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMarkdown,
  findMarkdownBlockPath,
  getMarkdownBlock,
  updateMarkdownBlock,
  removeMarkdownBlock,
  insertMarkdownBlockRelative,
  appendMarkdownChild,
  moveMarkdownBlock,
  indentMarkdownBlock,
  outdentMarkdownBlock,
  getMarkdownBlockRichText,
  setMarkdownBlockRichText,
  isMarkdownTextBearingBlockType,
  isMarkdownListBlockType
} from 'react-native-notion-markdown/document';

function textBlock(id, text) {
  return { id, type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: text } }] }, __markdown_markdown: { editorId: id } };
}

function docOf(...blocks) {
  return { version: 1, blocks };
}

test('findMarkdownBlockPath / getMarkdownBlock resolve top-level and nested blocks by editor id', () => {
  const doc = docOf(
    textBlock('a', 'A'),
    { ...textBlock('b', 'B'), children: [textBlock('b1', 'B1')] }
  );
  assert.deepEqual(findMarkdownBlockPath(doc, 'a'), [0]);
  assert.deepEqual(findMarkdownBlockPath(doc, 'b1'), [1, 0]);
  assert.equal(findMarkdownBlockPath(doc, 'missing'), undefined);
  assert.equal(getMarkdownBlock(doc, 'b1').paragraph.rich_text[0].text.content, 'B1');
});

test('updateMarkdownBlock replaces one block while leaving unrelated siblings referentially unchanged', () => {
  const doc = docOf(textBlock('a', 'A'), textBlock('b', 'B'), textBlock('c', 'C'));
  const untouchedSibling = doc.blocks[2];
  const next = updateMarkdownBlock(doc, 'b', (block) => setMarkdownBlockRichText(block, [{ type: 'text', text: { content: 'Changed' } }]));
  assert.equal(next.blocks[1].paragraph.rich_text[0].text.content, 'Changed');
  assert.equal(next.blocks[0], doc.blocks[0]);
  assert.equal(next.blocks[2], untouchedSibling);
});

test('updateMarkdownBlock returns the same document unchanged when the block id is missing', () => {
  const doc = docOf(textBlock('a', 'A'));
  assert.equal(updateMarkdownBlock(doc, 'missing', (b) => b), doc);
});

test('removeMarkdownBlock removes a nested block without disturbing its siblings', () => {
  const doc = docOf({ ...textBlock('parent', 'P'), children: [textBlock('c1', 'C1'), textBlock('c2', 'C2')] });
  const next = removeMarkdownBlock(doc, 'c1');
  assert.equal(next.blocks[0].children.length, 1);
  assert.equal(next.blocks[0].children[0].id, 'c2');
});

test('insertMarkdownBlockRelative inserts before and after an anchor at the top level', () => {
  const doc = docOf(textBlock('a', 'A'), textBlock('c', 'C'));
  const withB = insertMarkdownBlockRelative(doc, 'a', textBlock('b', 'B'), 'after');
  assert.deepEqual(withB.blocks.map((b) => b.id), ['a', 'b', 'c']);
  const withZ = insertMarkdownBlockRelative(doc, 'a', textBlock('z', 'Z'), 'before');
  assert.deepEqual(withZ.blocks.map((b) => b.id), ['z', 'a', 'c']);
});

test('appendMarkdownChild appends as the last child, creating the children array if absent', () => {
  const doc = docOf(textBlock('a', 'A'));
  const next = appendMarkdownChild(doc, 'a', textBlock('a1', 'A1'));
  assert.deepEqual(next.blocks[0].children.map((b) => b.id), ['a1']);
  const withSecond = appendMarkdownChild(next, 'a', textBlock('a2', 'A2'));
  assert.deepEqual(withSecond.blocks[0].children.map((b) => b.id), ['a1', 'a2']);
});

test('moveMarkdownBlock swaps with the adjacent sibling and is a no-op at the boundary', () => {
  const doc = docOf(textBlock('a', 'A'), textBlock('b', 'B'), textBlock('c', 'C'));
  const movedUp = moveMarkdownBlock(doc, 'b', 'up');
  assert.deepEqual(movedUp.blocks.map((b) => b.id), ['b', 'a', 'c']);
  const noop = moveMarkdownBlock(doc, 'a', 'up');
  assert.deepEqual(noop.blocks.map((b) => b.id), ['a', 'b', 'c']);
});

test('indentMarkdownBlock nests under the previous sibling and is a no-op when first', () => {
  const doc = docOf(textBlock('a', 'A'), textBlock('b', 'B'));
  const indented = indentMarkdownBlock(doc, 'b');
  assert.deepEqual(indented.blocks.map((b) => b.id), ['a']);
  assert.deepEqual(indented.blocks[0].children.map((b) => b.id), ['b']);
  const noop = indentMarkdownBlock(doc, 'a');
  assert.deepEqual(noop.blocks.map((b) => b.id), ['a', 'b']);
});

test('outdentMarkdownBlock un-nests to become the next sibling of its parent, and is a no-op at the top level', () => {
  const doc = docOf({ ...textBlock('a', 'A'), children: [textBlock('a1', 'A1'), textBlock('a2', 'A2')] }, textBlock('b', 'B'));
  const outdented = outdentMarkdownBlock(doc, 'a1');
  assert.deepEqual(outdented.blocks.map((b) => b.id), ['a', 'a1', 'b']);
  assert.deepEqual(outdented.blocks[0].children.map((b) => b.id), ['a2']);
  const noop = outdentMarkdownBlock(doc, 'a');
  assert.equal(noop, doc);
});

test('indent then outdent round trips back to the original sibling order', () => {
  const doc = docOf(textBlock('a', 'A'), textBlock('b', 'B'), textBlock('c', 'C'));
  const indented = indentMarkdownBlock(doc, 'b');
  const restored = outdentMarkdownBlock(indented, 'b');
  assert.deepEqual(restored.blocks.map((b) => b.id), ['a', 'b', 'c']);
});

test('getMarkdownBlockRichText / setMarkdownBlockRichText read and write the type-keyed payload', () => {
  const block = textBlock('a', 'A');
  assert.equal(getMarkdownBlockRichText(block)[0].text.content, 'A');
  const updated = setMarkdownBlockRichText(block, [{ type: 'text', text: { content: 'Z' } }]);
  assert.equal(updated.paragraph.rich_text[0].text.content, 'Z');
  assert.equal(updated.paragraph.color, undefined);
});

test('getMarkdownBlockRichText returns undefined for a block type with no rich_text field', () => {
  const divider = { id: 'd', type: 'divider', divider: {} };
  assert.equal(getMarkdownBlockRichText(divider), undefined);
});

test('isMarkdownTextBearingBlockType / isMarkdownListBlockType classify the block catalog', () => {
  assert.equal(isMarkdownTextBearingBlockType('paragraph'), true);
  assert.equal(isMarkdownTextBearingBlockType('heading_2'), true);
  assert.equal(isMarkdownTextBearingBlockType('divider'), false);
  assert.equal(isMarkdownTextBearingBlockType('table'), false);
  assert.equal(isMarkdownListBlockType('bulleted_list_item'), true);
  assert.equal(isMarkdownListBlockType('to_do'), true);
  assert.equal(isMarkdownListBlockType('paragraph'), false);
});

test('tree operations work against a real parsed document, matching editor ids from the parser', () => {
  const parsed = parseMarkdown('First\nSecond\n- Item one\n- Item two').document;
  const firstId = parsed.blocks[0].__markdown_markdown.editorId;
  const listId = parsed.blocks[2].__markdown_markdown.editorId;
  assert.notEqual(findMarkdownBlockPath(parsed, firstId), undefined);
  const indented = indentMarkdownBlock(parsed, listId);
  assert.equal(indented.blocks.length, 3);
});
