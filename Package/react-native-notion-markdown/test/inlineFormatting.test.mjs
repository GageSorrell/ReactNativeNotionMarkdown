import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fromEditorBlocks,
  parseMarkdown,
  serializeMarkdown,
  toEditorBlocks
} from 'react-native-notion-markdown/renderer';

/** Each rich-text item as `content|annotations|link`, for compact comparison. */
function items(markdown) {
  return parseMarkdown(markdown).document.blocks[0].paragraph.rich_text.map((item) => [
    item.text?.content ?? item.type,
    Object.entries(item.annotations ?? { })
      .filter(([ , value ]) => value !== false)
      .map(([ key, value ]) => value === true ? key : value)
      .join('+'),
    item.text?.link?.url ?? ''
  ].join('|'));
}

/** Serialize one editor text block. */
function fromEditor(text, marks) {
  return serializeMarkdown(fromEditorBlocks([ { id: 'a', marks, text, type: 'text' } ]));
}

const nested = [
  '**a [link](https://example.com) b**',
  '**a <span color="red">red</span> b**',
  '**a <span underline="true">under</span> b**',
  '**a *b* c**',
  '*a **b** c*',
  '~~a **b** c~~',
  '**a `code` b**',
  '**a $x$ b**',
  '<span color="red">a **b** c</span>',
  '[a **b** c](https://example.com)',
  '[a $x$ b](https://example.com)',
  '[`code`](https://example.com)',
  '**Note:**<br>details',
  '***both***'
];

test('nested inline formatting survives parsing, the editor, and serialization', () => {
  for (const source of nested) {
    const { document } = parseMarkdown(source);
    assert.equal(serializeMarkdown(document), source);
    assert.equal(serializeMarkdown(fromEditorBlocks(toEditorBlocks(document).blocks)), source);
  }

  // The editor does not show mentions, so one is checked without it.
  const mention = '**a <mention-user url="{{user://abc}}">Ada</mention-user> b**';
  assert.equal(serializeMarkdown(parseMarkdown(mention).document), mention);
});

test('formatting opens and closes across spans, equations, and line breaks', () => {
  assert.deepEqual(items('**a <span color="red">b</span> c**'), [ 'a |bold|', 'b|bold+red|', ' c|bold|' ]);
  assert.deepEqual(items('**a $x$ b**'), [ 'a |bold|', 'equation||', ' b|bold|' ]);
  assert.deepEqual(items('*a<br>b*'), [ 'a|italic|', '\n|italic|', 'b|italic|' ]);
  assert.deepEqual(
    items('[a <span color="red">b</span>](https://example.com)'),
    [ 'a ||https://example.com', 'b|red|https://example.com' ]
  );
});

test('code and link destinations keep constructs they contain as literal text', () => {
  assert.deepEqual(items('`a<br>b $x$`'), [ 'a<br>b $x$|code|' ]);
  assert.deepEqual(items('[a](https://example.com/a:b:c)'), [ 'a||https://example.com/a:b:c' ]);
});

test('a format shared by adjacent editor ranges is written once', () => {
  const link = { end: 3, kind: 'link', start: 2, url: 'https://example.com' };
  assert.equal(fromEditor('a b c', [ { end: 5, kind: 'bold', start: 0 }, link ]), '**a [b](https://example.com) c**');
  assert.equal(
    fromEditor('a b c', [ { end: 5, kind: 'bold', start: 0 }, { color: 'red', end: 3, kind: 'color', start: 2 } ]),
    '**a <span color="red">b</span> c**'
  );
  assert.equal(
    fromEditor('a b c', [ { end: 5, kind: 'bold', start: 0 }, { end: 3, kind: 'italic', start: 2 } ]),
    '**a *b* c**'
  );
});

test('delimiters stay against text when a formatted range has whitespace at its edge', () => {
  assert.equal(fromEditor('word next', [ { end: 5, kind: 'bold', start: 0 } ]), '**word** next');
  assert.equal(fromEditor('a word', [ { end: 6, kind: 'italic', start: 1 } ]), 'a *word*');

  // Overlapping ranges close and reopen around the whitespace between them.
  const overlapped = fromEditor('a b c', [ { end: 3, kind: 'bold', start: 0 }, { end: 5, kind: 'italic', start: 2 } ]);
  assert.equal(overlapped, '**a *b*** *c*');
  assert.deepEqual(items(overlapped), [ 'a |bold|', 'b|bold+italic|', ' ||', 'c|italic|' ]);
});
