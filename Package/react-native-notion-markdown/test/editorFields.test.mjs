import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  richTextToFieldMarks,
  fieldMarksToRichText,
  encodeNotionFieldClipboard,
  decodeNotionFieldClipboard,
  encodeNotionBlockClipboard,
  decodeNotionBlockClipboard,
  splitFieldMarks,
  mergeFieldMarks,
  toggleFieldRangeMark,
  setFieldValueMark
} from 'react-native-notion-markdown/document';

test('richTextToFieldMarks flattens plain runs with no marks', () => {
  const { text, marks } = richTextToFieldMarks([{ type: 'text', text: { content: 'Hello world' } }]);
  assert.equal(text, 'Hello world');
  assert.deepEqual(marks, []);
});

test('richTextToFieldMarks captures annotations, color, and link ranges', () => {
  const { text, marks } = richTextToFieldMarks([
    { type: 'text', text: { content: 'Bold' }, annotations: { bold: true, italic: false, strikethrough: false, underline: false, code: false } },
    { type: 'text', text: { content: ' plain ' } },
    { type: 'text', text: { content: 'link' }, annotations: { color: 'blue' } },
    { type: 'text', text: { content: 'url', link: { url: 'https://example.com' } } }
  ]);
  assert.equal(text, 'Bold plain linkurl');
  assert.deepEqual(marks.find((m) => m.kind === 'bold'), { kind: 'bold', start: 0, end: 4 });
  assert.deepEqual(marks.find((m) => m.kind === 'color'), { kind: 'color', start: 11, end: 15, color: 'blue' });
  assert.deepEqual(marks.find((m) => m.kind === 'link'), { kind: 'link', start: 15, end: 18, url: 'https://example.com' });
});

test('richTextToFieldMarks represents mentions, equations, citations, and custom emoji as one-unit atoms', () => {
  const mention = { type: 'mention', mention: { type: 'user', user: { id: 'abc' } }, __notion_markdown: { mention: { kind: 'user', label: 'Ada' } } };
  const equation = { type: 'equation', equation: { expression: 'x^2' } };
  const citation = { type: 'text', text: { content: 'https://example.com/paper' }, __notion_markdown: { citationUrl: 'https://example.com/paper' } };
  const emoji = { type: 'text', text: { content: 'partyparrot' }, __notion_markdown: { emojiName: 'partyparrot' } };
  const { text, marks } = richTextToFieldMarks([mention, equation, citation, emoji]);
  assert.equal(text, '￼￼￼￼');
  assert.equal(marks.length, 4);
  assert.deepEqual(marks.map((m) => m.atomKind), ['mention', 'equation', 'citation', 'emoji']);
  assert.equal(marks[0].label, 'Ada');
  assert.equal(marks[1].label, 'x^2');
  assert.equal(marks[0].item, mention);
  marks.forEach((mark, index) => {
    assert.equal(mark.start, index);
    assert.equal(mark.end, index + 1);
  });
});

test('fieldMarksToRichText round trips plain and formatted runs', () => {
  const { text, marks } = richTextToFieldMarks([
    { type: 'text', text: { content: 'Bold italic', link: undefined }, annotations: { bold: true, italic: true, strikethrough: false, underline: false, code: false } }
  ]);
  const richText = fieldMarksToRichText(text, marks);
  assert.equal(richText.length, 1);
  assert.equal(richText[0].text.content, 'Bold italic');
  assert.equal(richText[0].annotations.bold, true);
  assert.equal(richText[0].annotations.italic, true);
});

test('fieldMarksToRichText splits overlapping ranges into consistent runs', () => {
  const text = 'ABCDE';
  const marks = [
    { kind: 'bold', start: 0, end: 3 },
    { kind: 'italic', start: 2, end: 5 }
  ];
  const richText = fieldMarksToRichText(text, marks);
  const contents = richText.map((item) => item.text.content);
  assert.deepEqual(contents, ['AB', 'C', 'DE']);
  assert.equal(richText[0].annotations.bold, true);
  assert.equal(richText[0].annotations.italic, false);
  assert.equal(richText[1].annotations.bold, true);
  assert.equal(richText[1].annotations.italic, true);
  assert.equal(richText[2].annotations.italic, true);
});

test('fieldMarksToRichText splices an untouched atom back in unchanged', () => {
  const item = { type: 'equation', equation: { expression: 'e=mc^2' } };
  const richText = fieldMarksToRichText('￼', [{ kind: 'atom', start: 0, end: 1, atomKind: 'equation', label: 'e=mc^2', item }]);
  assert.equal(richText.length, 1);
  assert.equal(richText[0], item);
});

test('richText -> field marks -> richText is stable for a mixed document', () => {
  const original = [
    { type: 'text', text: { content: 'Say ' } },
    { type: 'mention', mention: { type: 'user', user: { id: 'abc' } }, __notion_markdown: { mention: { kind: 'user', label: 'Ada' } } },
    { type: 'text', text: { content: ' hi to ' } },
    { type: 'equation', equation: { expression: 'x+1' } }
  ];
  const { text, marks } = richTextToFieldMarks(original);
  const roundTripped = fieldMarksToRichText(text, marks);
  assert.equal(roundTripped.map((i) => i.text?.content ?? '￼').join(''), 'Say ￼ hi to ￼');
  assert.equal(roundTripped[1], original[1]);
  assert.equal(roundTripped[3], original[3]);
});

test('splitFieldMarks divides plain text and shifts the tail marks to start at zero', () => {
  const [before, after] = splitFieldMarks('Hello world', [{ kind: 'bold', start: 0, end: 5 }, { kind: 'italic', start: 6, end: 11 }], 6);
  assert.equal(before.text, 'Hello ');
  assert.equal(after.text, 'world');
  assert.deepEqual(before.marks, [{ kind: 'bold', start: 0, end: 5 }]);
  assert.deepEqual(after.marks, [{ kind: 'italic', start: 0, end: 5 }]);
});

test('splitFieldMarks clips a mark straddling the split point into two pieces', () => {
  const [before, after] = splitFieldMarks('Hello world', [{ kind: 'bold', start: 2, end: 9 }], 6);
  assert.deepEqual(before.marks, [{ kind: 'bold', start: 2, end: 6 }]);
  assert.deepEqual(after.marks, [{ kind: 'bold', start: 0, end: 3 }]);
});

test('splitFieldMarks never splits through an atom, since atoms are one unit wide', () => {
  const item = { type: 'equation', equation: { expression: 'x' } };
  const [before, after] = splitFieldMarks('a￼b', [{ kind: 'atom', start: 1, end: 2, atomKind: 'equation', label: 'x', item }], 1);
  assert.equal(before.text, 'a');
  assert.equal(after.text, '￼b');
  assert.deepEqual(before.marks, []);
  assert.deepEqual(after.marks, [{ kind: 'atom', start: 0, end: 1, atomKind: 'equation', label: 'x', item }]);
});

test('mergeFieldMarks is the inverse of splitFieldMarks at the split point', () => {
  const text = 'Hello world';
  const marks = [{ kind: 'bold', start: 0, end: 5 }, { kind: 'italic', start: 2, end: 9 }];
  const [before, after] = splitFieldMarks(text, marks, 6);
  const merged = mergeFieldMarks(before, after);
  assert.equal(merged.text, text);
  assert.deepEqual(new Set(merged.marks.map((m) => JSON.stringify(m))), new Set([
    JSON.stringify({ kind: 'bold', start: 0, end: 5 }),
    JSON.stringify({ kind: 'italic', start: 2, end: 6 }),
    JSON.stringify({ kind: 'italic', start: 6, end: 9 })
  ]));
});

test('toggleFieldRangeMark adds a mark over an uncovered range', () => {
  const result = toggleFieldRangeMark([], 'bold', 2, 6);
  assert.deepEqual(result, [{ kind: 'bold', start: 2, end: 6 }]);
});

test('toggleFieldRangeMark merges with an adjacent run of the same kind', () => {
  const result = toggleFieldRangeMark([{ kind: 'bold', start: 0, end: 2 }], 'bold', 2, 6);
  assert.deepEqual(result, [{ kind: 'bold', start: 0, end: 6 }]);
});

test('toggleFieldRangeMark removes the mark when the range is already fully covered', () => {
  const result = toggleFieldRangeMark([{ kind: 'bold', start: 0, end: 10 }], 'bold', 2, 6);
  assert.deepEqual(result.sort((a, b) => a.start - b.start), [
    { kind: 'bold', start: 0, end: 2 },
    { kind: 'bold', start: 6, end: 10 }
  ]);
});

test('toggleFieldRangeMark leaves marks of other kinds untouched', () => {
  const result = toggleFieldRangeMark([{ kind: 'italic', start: 0, end: 10 }], 'bold', 2, 6);
  assert.deepEqual(result, [{ kind: 'italic', start: 0, end: 10 }, { kind: 'bold', start: 2, end: 6 }]);
});

test('setFieldValueMark assigns a color over a range, clipping any prior color there', () => {
  const withRed = setFieldValueMark([], 'color', 0, 10, 'red');
  assert.deepEqual(withRed, [{ kind: 'color', start: 0, end: 10, color: 'red' }]);
  const reassigned = setFieldValueMark(withRed, 'color', 3, 7, 'blue');
  assert.deepEqual(reassigned.sort((a, b) => a.start - b.start), [
    { kind: 'color', start: 0, end: 3, color: 'red' },
    { kind: 'color', start: 7, end: 10, color: 'red' },
    { kind: 'color', start: 3, end: 7, color: 'blue' }
  ].sort((a, b) => a.start - b.start));
});

test('setFieldValueMark clears a link over a range when given undefined', () => {
  const withLink = setFieldValueMark([], 'link', 0, 10, 'https://example.com');
  const cleared = setFieldValueMark(withLink, 'link', 3, 7, undefined);
  assert.deepEqual(cleared.sort((a, b) => a.start - b.start), [
    { kind: 'link', start: 0, end: 3, url: 'https://example.com' },
    { kind: 'link', start: 7, end: 10, url: 'https://example.com' }
  ]);
});

test('field clipboard fragments encode and decode, rejecting malformed payloads', () => {
  const richText = [{ type: 'text', text: { content: 'Clip me' }, annotations: { bold: true, italic: false, strikethrough: false, underline: false, code: false } }];
  const json = encodeNotionFieldClipboard(richText);
  const decoded = decodeNotionFieldClipboard(json);
  assert.equal(decoded[0].text.content, 'Clip me');
  assert.equal(decoded[0].annotations.bold, true);
  assert.equal(decodeNotionFieldClipboard('not json'), undefined);
  assert.equal(decodeNotionFieldClipboard(JSON.stringify({ version: 2, kind: 'field', text: '', marks: [] })), undefined);
});

test('block clipboard fragments encode and decode, rejecting malformed payloads', () => {
  const blocks = [{ id: 'a', type: 'paragraph', paragraph: { rich_text: [] } }];
  const json = encodeNotionBlockClipboard(blocks);
  const decoded = decodeNotionBlockClipboard(json);
  assert.deepEqual(decoded, blocks);
  assert.equal(decodeNotionBlockClipboard('not json'), undefined);
  assert.equal(decodeNotionBlockClipboard(JSON.stringify({ version: 1, kind: 'field', blocks: [] })), undefined);
});
