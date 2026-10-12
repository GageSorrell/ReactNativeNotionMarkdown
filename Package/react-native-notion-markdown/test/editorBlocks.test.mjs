import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptEditorEvent,
  fromEditorBlocks,
  fromMarkdownBlocks,
  parseMarkdown,
  serializeMarkdown,
  stripSyncedEditorBlocks,
  toEditorBlocks
} from 'react-native-notion-markdown/renderer';

const BREAK = String.fromCharCode(0x2028);
const ATOM = String.fromCharCode(0xFFFC);

/** Feed blocks to the event reducer the way the native view echoes a loaded document. */
function accept(blocks) {
  const current = { blocks: [ { id: 'seed', text: '', type: 'text' } ], epoch: 1, revision: 0 };
  const point = { blockId: blocks[0].id, field: 'rich_text', offset: 0 };
  return acceptEditorEvent(current, {
    anchor: point,
    blocks,
    composingEnd: -1,
    composingStart: -1,
    epoch: 1,
    focus: point,
    revision: 1,
    source: 'replacement'
  });
}

/** Markdown -> document -> editor blocks -> document -> Markdown. */
function throughEditor(markdown) {
  const parsed = parseMarkdown(markdown);
  const projected = toEditorBlocks(parsed.document);
  return {
    canonical: serializeMarkdown(parsed.document),
    diagnostics: [ ...parsed.diagnostics, ...projected.diagnostics ],
    blocks: projected.blocks,
    markdown: serializeMarkdown(fromEditorBlocks(projected.blocks))
  };
}

const supported = {
  marks: 'Plain **bold** *italic* ~~strike~~ `code` <span underline="true">under</span> [link](https://example.com) end',
  colors: [
    'Block background with <span color="red">foreground text</span> {color="blue_bg"}',
    '# Heading {color="red"}',
    '- Item {color="green_bg"}'
  ].join('\n'),
  softBreaks: '**a**<br>**b** and plain<br>line',
  equations: [ 'Mass $E = mc^2$ and $\\frac{a}{b}$ inline', '$$', 'x^2 + y^2', '$$' ].join('\n'),
  code: [ '```javascript', 'const a = 1;', '', '  indented **literal** $x$', '```' ].join('\n'),
  toggles: [
    '<details color="blue">',
    '<summary>More</summary>',
    '\t- Child',
    '\t<details>',
    '\t<summary>Inner</summary>',
    '\t\tNested',
    '\t</details>',
    '</details>',
    '## Toggle heading {toggle="true"}',
    '\tInside the heading',
    '# Plain heading'
  ].join('\n'),
  callouts: [
    '<callout icon="🎯" color="blue_bg">',
    '\tShip the MVP by **Friday**.',
    '\t- A child item',
    '</callout>'
  ].join('\n'),
  toDos: [ '- [x] Done', '- [ ] Open', '\t- [ ] Nested' ].join('\n'),
  lists: [ '- One', '\t- Two', '\t\t1. Three', '\t- Four', '1. Five', '> Quote', '\tQuoted child' ].join('\n'),
  paragraphChildren: [ 'Parent', '\tChild', '\t\tGrandchild', '\tSecond child', '<empty-block/>', '\tUnder empty', 'After' ].join('\n'),
  table: [
    '<table fit-page-width="true" header-row="true" header-column="true">',
    '\t<colgroup>',
    '\t\t<col color="blue">',
    '\t\t<col>',
    '\t</colgroup>',
    '\t<tr color="gray"><td color="red">**Bold**</td><td><span color="green">Text</span></td></tr>',
    '\t<tr><td>Second $x$</td><td>Row</td></tr>',
    '</table>'
  ].join('\n'),
  media: [
    '![](https://example.com/a.png)',
    '<video src="https://example.com/a.mp4"></video>',
    '<audio src="file:///tmp/memo.m4a">Voice memo</audio>',
    '<file src="file:///tmp/brief.pdf">brief.pdf</file>',
    '<pdf src="file:///tmp/report.pdf">report.pdf</pdf>'
  ].join('\n'),
  pageReference: '<page url="https://www.notion.so/page" icon="📄">Title</page>',
  structure: [ 'Before', '---', '<table_of_contents/>', 'After' ].join('\n')
};

for (const [ name, markdown ] of Object.entries(supported)) {
  test(`editor round trip keeps ${name}`, () => {
    const result = throughEditor(markdown);
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.markdown, result.canonical);
    assert.equal(result.canonical, markdown);
    assert.equal(accept(result.blocks).revision, 1, 'the projection is rejected by acceptEditorEvent');
  });
}

test('every projection is accepted, including discarded and odd content', () => {
  const sources = [
    ...Object.values(supported),
    '',
    'Hi <mention-user url="{{user://abc123}}">Ada</mention-user> on <mention-date start="2026-09-16"/> [^https://example.com/c] :rocket:',
    '![**cap**](https://example.com/a.png)\n<pdf src="https://example.com/a.pdf"></pdf>\n<embed src="https://example.com"></embed>',
    '<columns>\n\t<column>\n\t\tLeft\n\t</column>\n\t<column>\n\t\tRight\n\t</column>\n</columns>',
    '<synced_block url="https://www.notion.so/sync">\n\tShared\n</synced_block>\n<synced_block_reference url="https://www.notion.so/sync">\n</synced_block_reference>',
    '<database url="https://www.notion.so/db">Tasks</database>\n<page>No URL</page>',
    '<table>\n</table>\n| a | b |\n| --- | --- |\n| c |',
    '<audio src="">Nothing</audio>'
  ];
  for (const source of sources) {
    const { blocks } = toEditorBlocks(parseMarkdown(source).document);
    assert.ok(blocks.length > 0, source);
    assert.equal(accept(blocks).revision, 1, source);
  }
});

test('marks are merged per range and sorted the way the native view reports them', () => {
  const { blocks } = toEditorBlocks(parseMarkdown('a **b *c* d** <span color="red">e `f`</span> $x$').document);
  assert.equal(blocks[0].text, `a b c d e f ${ATOM}`);
  assert.deepEqual(blocks[0].marks, [
    { end: 7, kind: 'bold', start: 2 },
    { end: 5, kind: 'italic', start: 4 },
    { color: 'red', end: 11, kind: 'color', start: 8 },
    { end: 11, kind: 'code', start: 10 },
    { end: 13, expression: 'x', kind: 'equation', start: 12 }
  ]);
});

test('soft breaks use U+2028 in the editor and stay outside formatting on the way back', () => {
  const { blocks } = toEditorBlocks(parseMarkdown('a<br>b').document);
  assert.equal(blocks[0].text, `a${BREAK}b`);
  const document = fromEditorBlocks([ {
    id: 'a',
    marks: [ { end: 3, kind: 'bold', start: 0 }, { end: 3, kind: 'link', start: 0, url: 'https://example.com' } ],
    text: `a${BREAK}b`,
    type: 'text'
  } ]);
  assert.equal(serializeMarkdown(document), '**[a](https://example.com)**<br>**[b](https://example.com)**');
  assert.equal(parseMarkdown(serializeMarkdown(document)).document.blocks[0].paragraph.rich_text.length, 3);
});

const editorFixtures = {
  table: [
    {
      id: 'table:demo',
      table: {
        columnColors: [ undefined, 'blue_bg', undefined ],
        fitPageWidth: true,
        headerColumn: true,
        headerRow: true,
        rows: [
          { cells: [
            { text: 'Feature', marks: [ { end: 7, kind: 'bold', start: 0 } ] },
            { text: 'Status', marks: [ { end: 6, kind: 'bold', start: 0 } ] },
            { text: 'Owner', marks: [ { end: 5, kind: 'bold', start: 0 } ] }
          ] },
          { cells: [ { text: 'Editable cells' }, { color: 'green_bg', text: 'Ready' }, { text: 'Ada' } ], color: 'gray_bg' },
          { cells: [ { text: 'Rich text' }, { color: 'yellow_bg', text: 'In progress' }, { text: 'Lin' } ] }
        ]
      },
      text: '',
      type: 'table'
    },
    { id: 'table:after', text: 'Tap a cell to edit it.', type: 'text' }
  ],
  inlineMath: [
    {
      id: 'math:heading',
      marks: [ { end: 14, expression: '\\frac{a}{b}', kind: 'equation', start: 13 } ],
      text: `Heading with ${ATOM}`,
      type: 'heading_1'
    },
    {
      id: 'math:intro',
      marks: [
        { end: 5, expression: 'E = mc^2', kind: 'equation', start: 4 },
        { end: 11, expression: '\\frac{a}{b}', kind: 'equation', start: 10 }
      ],
      text: `The ${ATOM} and ${ATOM} inline.`,
      type: 'text'
    },
    {
      id: 'math:list',
      marks: [ { end: 3, expression: '\\sum_{i=1}^{n} i^2', kind: 'equation', start: 2 } ],
      text: `A ${ATOM}`,
      type: 'bulleted_list_item'
    },
    {
      id: 'math:table',
      table: {
        fitPageWidth: true,
        headerColumn: false,
        headerRow: true,
        rows: [
          { cells: [ { text: 'Shape' }, { text: 'Formula' } ] },
          { cells: [
            { text: 'Circle' },
            { marks: [ { end: 6, expression: '\\pi r^2', kind: 'equation', start: 5 } ], text: `Area ${ATOM}` }
          ] },
          { cells: [ { text: 'Square' }, { text: '' } ] }
        ]
      },
      text: '',
      type: 'table'
    },
    { id: 'math:after', text: 'Plain paragraph after the equations.', type: 'text' }
  ],
  callout: [
    { id: 'callout:intro', text: 'Paragraph block for layout measurements.', type: 'text' },
    { color: 'green_bg', icon: '☝️', id: 'callout:tinted', text: 'Foo. Bar', type: 'callout' },
    { id: 'callout:foreground', text: 'Foreground color', type: 'callout', color: 'blue' },
    { id: 'callout:after', text: 'Heading 1 block', type: 'heading_1' }
  ],
  quote: [
    { id: 'quote:intro', text: 'Paragraph block for layout measurements.', type: 'text' },
    { id: 'quote:default', text: 'Wisdom often comes in a plain quote.', type: 'quote' },
    { color: 'purple', id: 'quote:foreground', text: 'A quote in purple.', type: 'quote' },
    { id: 'quote:after', text: 'Heading 1 block', type: 'heading_1' }
  ],
  nested: [
    { id: 'n:toggle', text: 'Toggle', toggle: true, type: 'toggle' },
    { depth: 1, id: 'n:todo', checked: true, text: 'Done', type: 'to_do' },
    { depth: 2, id: 'n:code', language: 'kotlin', text: `val a = 1${BREAK}val b = 2`, type: 'code' },
    { depth: 1, id: 'n:heading', text: 'Toggle heading', toggle: true, type: 'heading_3' },
    { depth: 2, id: 'n:equation', expression: 'x^2', text: 'x^2', type: 'equation' },
    { id: 'n:columns', columnCount: 3, text: 'Converted content', type: 'column_list' },
    { depth: 1, id: 'n:in-column', text: 'In the first column', type: 'text' },
    { id: 'n:shared', text: 'Shared', type: 'numbered_list_item' },
    { id: 'n:divider', text: '', type: 'divider' },
    { id: 'n:toc', text: '', type: 'table_of_contents' },
    { icon: '📄', id: 'n:page', text: 'A page', type: 'link_to_page', url: 'https://example.com/page' },
    { id: 'n:image', text: '', type: 'image', url: 'file:///tmp/a.jpg' },
    {
      duration: 12.5,
      fileName: 'memo.m4a',
      fileSize: 4096,
      id: 'n:audio',
      mimeType: 'audio/mp4',
      text: '',
      type: 'audio',
      url: 'file:///tmp/memo.m4a',
      waveform: [ 0.25, 0.5 ]
    },
    { fileName: 'brief.pdf', fileSize: 8192, id: 'n:file', mimeType: 'application/pdf', text: '', type: 'file', url: 'file:///tmp/brief.pdf' },
    { fileName: 'report.pdf', fileSize: 2048, id: 'n:pdf', mimeType: 'application/pdf', text: '', type: 'pdf', url: 'file:///tmp/report.pdf' },
    { id: 'n:empty', text: '', type: 'text' }
  ]
};

for (const [ name, blocks ] of Object.entries(editorFixtures)) {
  test(`editor blocks survive a document round trip: ${name}`, () => {
    assert.equal(accept(blocks).revision, 1);
    const document = fromEditorBlocks(blocks);
    const back = toEditorBlocks(document);
    assert.deepEqual(back.diagnostics, []);
    assert.deepEqual(back.blocks, blocks);
    // The document is also valid input for the serializer and parser.
    const reparsed = parseMarkdown(serializeMarkdown(document));
    assert.deepEqual(reparsed.diagnostics, []);
  });
}

test('unchanged editor blocks convert to the same document block objects', () => {
  const blocks = editorFixtures.quote;
  const first = fromEditorBlocks(blocks);
  const edited = [ { ...blocks[0], text: 'Edited' }, ...blocks.slice(1) ];
  const second = fromEditorBlocks(edited);
  assert.notEqual(second.blocks[0], first.blocks[0]);
  assert.equal(second.blocks[1], first.blocks[1]);
  assert.equal(second.blocks[3], first.blocks[3]);
});

test('inline content the editor cannot draw is removed and reported', () => {
  const source = 'Hi <mention-user url="{{user://abc123}}">Ada</mention-user>, due <mention-date start="2026-09-16"/> [^https://example.com/c] :rocket: $x$ **end**';
  const parsed = parseMarkdown(source);
  const { blocks, diagnostics } = toEditorBlocks(parsed.document);
  assert.equal(blocks[0].text, `Hi , due    ${ATOM} end`);
  assert.deepEqual(blocks[0].marks, [
    { end: 13, expression: 'x', kind: 'equation', start: 12 },
    { end: 17, kind: 'bold', start: 14 }
  ]);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].code, 'editor-discarded-inline');
  assert.equal(diagnostics[0].severity, 'warning');
  assert.equal(diagnostics[0].details.count, 4);
  assert.deepEqual(diagnostics[0].source, { column: 1, line: 1 });
});

test('captions and unsupported blocks are discarded with diagnostics', () => {
  const source = [
    '![A **caption**](https://example.com/a.png)',
    '<audio src="file:///tmp/memo.m4a">Voice **memo**</audio>',
    '<pdf src=""></pdf>',
    '<embed src="https://example.com"></embed>',
    '<bookmark url="https://example.com"></bookmark>',
    '<database url="https://www.notion.so/db">Tasks</database>',
    '<audio src="">Nothing</audio>',
    '<table>',
    '</table>',
    '<synced_block_reference url="https://www.notion.so/sync">',
    '</synced_block_reference>',
    '<synced_block url="https://www.notion.so/sync">',
    '\tShared',
    '</synced_block>'
  ].join('\n');
  const { blocks, diagnostics } = toEditorBlocks(parseMarkdown(source).document);
  assert.deepEqual(blocks.map((block) => block.type), [ 'image', 'audio' ]);
  assert.equal(blocks[1].fileName, 'Voice memo');
  assert.deepEqual(diagnostics.map((diagnostic) => diagnostic.code), [
    'editor-discarded-caption',
    'editor-discarded-caption',
    'editor-discarded-block',
    'editor-discarded-block',
    'editor-discarded-block',
    'editor-discarded-block',
    'editor-discarded-block',
    'editor-discarded-block',
    'editor-discarded-block',
    'editor-discarded-block'
  ]);
  assert.ok(diagnostics.every((diagnostic) => diagnostic.severity === 'warning' && diagnostic.source !== undefined));
  assert.equal(diagnostics[2].source.line, 3);
});

test('synced blocks and database references are stripped, along with what they hold', () => {
  const source = [
    'Before',
    '<synced_block url="https://www.notion.so/sync">',
    '\tShared',
    '\t- Shared item',
    '</synced_block>',
    '<synced_block>',
    '\tNew',
    '</synced_block>',
    '<synced_block_reference url="https://www.notion.so/sync">',
    '\tCopy',
    '</synced_block_reference>',
    '<database url="https://www.notion.so/db" inline="true">Tasks</database>',
    '<details>',
    '<summary>Toggle</summary>',
    '\t<synced_block>',
    '\t\tNested',
    '\t</synced_block>',
    '\tKept',
    '</details>',
    'After'
  ].join('\n');
  const parsed = parseMarkdown(source);
  assert.deepEqual(parsed.diagnostics, []);
  // The same result for Markdown text and for an already-parsed document.
  const { blocks, diagnostics } = toEditorBlocks(parsed.document);
  assert.deepEqual(blocks.map((block) => [ block.type, block.depth ?? 0, block.text ]), [
    [ 'text', 0, 'Before' ],
    [ 'toggle', 0, 'Toggle' ],
    [ 'text', 1, 'Kept' ],
    [ 'text', 0, 'After' ]
  ]);
  assert.deepEqual(diagnostics.map((diagnostic) => [ diagnostic.code, diagnostic.details.type, diagnostic.source.line ]), [
    [ 'editor-discarded-block', 'synced_block', 2 ],
    [ 'editor-discarded-block', 'synced_block', 6 ],
    [ 'editor-discarded-block', 'synced_block_reference', 9 ],
    [ 'editor-discarded-block', 'link_to_page', 12 ],
    [ 'editor-discarded-block', 'synced_block', 15 ]
  ]);
  assert.equal(accept(blocks).revision, 1);
  assert.equal(serializeMarkdown(fromEditorBlocks(blocks)), [
    'Before', '<details>', '<summary>Toggle</summary>', '\tKept', '</details>', 'After'
  ].join('\n'));

  // A synced block in a native block list still converts, and is stripped when loaded.
  const inserted = fromEditorBlocks([
    { id: 's', synced_from: null, text: '', type: 'synced_block' },
    { depth: 1, id: 'c', text: 'Shared', type: 'text' }
  ]);
  assert.equal(inserted.blocks[0].type, 'synced_block');
  assert.deepEqual(toEditorBlocks(inserted).blocks, [ { id: 'editor:empty', text: '', type: 'text' } ]);
});

test('synced blocks are filtered out of a native block list, with the blocks nested under them', () => {
  const blocks = [
    { id: 'a', text: 'Before', type: 'text' },
    { id: 's', synced_from: null, text: '', type: 'synced_block' },
    { depth: 1, id: 's1', text: 'Shared', type: 'text' },
    { depth: 2, id: 's2', text: 'Deeper', type: 'bulleted_list_item' },
    { id: 't', text: 'Toggle', toggle: true, type: 'toggle' },
    { depth: 1, id: 'n', synced_from: null, text: '', type: 'synced_block' },
    { depth: 2, id: 'n1', text: 'Nested', type: 'text' },
    { depth: 1, id: 'k', text: 'Kept', type: 'text' },
    { id: 'z', synced_from: null, text: '', type: 'synced_block' },
    { id: 'b', text: 'After', type: 'text' }
  ];
  const stripped = stripSyncedEditorBlocks(blocks);
  assert.deepEqual(stripped.map((block) => block.id), [ 'a', 't', 'k', 'b' ]);
  assert.equal(stripped[0], blocks[0]);
  assert.equal(accept(stripped).revision, 1);
  // Nothing to remove returns the same array, so a memoized snapshot keeps its identity.
  assert.equal(stripSyncedEditorBlocks(stripped), stripped);
  const empty = stripSyncedEditorBlocks([ blocks[1], blocks[2] ]);
  assert.deepEqual(empty, [ { id: 'editor:empty', text: '', type: 'text' } ]);
  assert.equal(accept(empty).revision, 1);
});

test('columns keep their content, which is returned in the first column', () => {
  const source = [
    '<columns>',
    '\t<column>',
    '\t\tLeft',
    '\t</column>',
    '\t<column>',
    '\t\tRight',
    '\t\t- Item',
    '\t</column>',
    '\t<column>',
    '\t</column>',
    '</columns>'
  ].join('\n');
  const { blocks, diagnostics } = toEditorBlocks(parseMarkdown(source).document);
  assert.deepEqual(blocks.map((block) => [ block.type, block.depth ?? 0, block.text ]), [
    [ 'column_list', 0, '' ],
    [ 'text', 1, 'Left' ],
    [ 'text', 1, 'Right' ],
    [ 'bulleted_list_item', 1, 'Item' ]
  ]);
  assert.equal(blocks[0].columnCount, 3);
  assert.deepEqual(diagnostics.map((diagnostic) => diagnostic.code), [ 'editor-flattened-columns' ]);
  assert.equal(serializeMarkdown(fromEditorBlocks(blocks)), [
    '<columns>',
    '\t<column>',
    '\t\tLeft',
    '\t\tRight',
    '\t\t- Item',
    '\t</column>',
    '\t<column>',
    '\t</column>',
    '\t<column>',
    '\t</column>',
    '</columns>'
  ].join('\n'));
  const single = toEditorBlocks(parseMarkdown('<columns>\n\t<column>\n\t\tOnly\n\t</column>\n\t<column>\n\t</column>\n</columns>').document);
  assert.deepEqual(single.diagnostics, []);
});

test('depth jumps nest under the nearest container, and non-containers hoist their children', () => {
  const document = fromEditorBlocks([
    { id: 'a', text: 'Bullet', type: 'bulleted_list_item' },
    { depth: 3, id: 'b', text: 'Jumped', type: 'text' },
    { depth: 1, id: 'c', text: 'Plain heading', type: 'heading_2' },
    { depth: 2, id: 'd', text: 'Under the heading', type: 'text' },
    { depth: 2, id: 'e', text: 'Also under', type: 'text' },
    { id: 'f', text: 'Top heading', type: 'heading_1' },
    { depth: 1, id: 'g', text: 'Hoisted to the root', type: 'text' },
    { depth: 1, id: 'h', text: '', type: 'divider' },
    { depth: 2, id: 'i', text: 'After the divider', type: 'text' }
  ]);
  assert.deepEqual(document.blocks.map((block) => block.id), [ 'a', 'f', 'g', 'h', 'i' ]);
  assert.deepEqual(document.blocks[0].children.map((block) => block.id), [ 'b', 'c', 'd', 'e' ]);
  assert.equal(document.blocks[1].children, undefined);
  // Converting back yields depths that match the tree, and is then stable.
  const { blocks } = toEditorBlocks(document);
  assert.deepEqual(blocks.map((block) => block.depth ?? 0), [ 0, 1, 1, 1, 1, 0, 0, 0, 0 ]);
  assert.deepEqual(toEditorBlocks(fromEditorBlocks(blocks)).blocks, blocks);
});

test('children of a plain heading in an imported document become its siblings', () => {
  const imported = fromMarkdownBlocks([ {
    object: 'block',
    id: '11111111-1111-1111-1111-111111111111',
    type: 'heading_1',
    heading_1: { rich_text: [ { type: 'text', text: { content: 'Title' } } ] },
    children: [ { object: 'block', id: '22222222-2222-2222-2222-222222222222', type: 'paragraph', paragraph: { rich_text: [ { type: 'text', text: { content: 'Body' } } ] } } ]
  } ]);
  const { blocks } = toEditorBlocks(imported.document);
  assert.deepEqual(blocks.map((block) => [ block.type, block.depth ?? 0 ]), [ [ 'heading_1', 0 ], [ 'text', 0 ] ]);
});

test('duplicate ids are made unique and an empty document yields one empty text block', () => {
  const paragraph = (id, content) => ({ id, type: 'paragraph', paragraph: { rich_text: [ { type: 'text', text: { content } } ] } });
  const { blocks } = toEditorBlocks({ version: 1, blocks: [ paragraph('same', 'a'), paragraph('same', 'b'), paragraph('same', 'c') ] });
  assert.deepEqual(blocks.map((block) => block.id), [ 'same', 'same:2', 'same:3' ]);
  assert.equal(accept(blocks).revision, 1);

  for (const document of [ { version: 1, blocks: [] }, parseMarkdown('<embed src="https://example.com"></embed>').document ]) {
    const empty = toEditorBlocks(document);
    assert.deepEqual(empty.blocks, [ { id: 'editor:empty', text: '', type: 'text' } ]);
    assert.equal(accept(empty.blocks).revision, 1);
  }
  assert.equal(serializeMarkdown(fromEditorBlocks(toEditorBlocks({ version: 1, blocks: [] }).blocks)), '<empty-block/>');
});

test('table colors written by table commands are read, and a table color fills uncolored columns', () => {
  const cell = (content) => [ { type: 'text', text: { content } } ];
  const row = (id, cells) => ({ id, type: 'table_row', table_row: { cells: cells.map(cell) } });
  const { blocks } = toEditorBlocks({
    version: 1,
    blocks: [ {
      id: 't',
      type: 'table',
      table: { has_column_header: true, has_row_header: false, table_width: 2 },
      children: [ row('r0', [ 'a', 'b' ]), row('r1', [ 'c' ]) ],
      __markdown_markdown: {
        table: {
          cellColors: [ [ undefined, 'red' ], [ 'green_bg' ] ],
          columnColors: [ 'blue' ],
          rowColors: [ undefined, 'gray_bg' ],
          tableColor: 'yellow_bg'
        }
      }
    } ]
  });
  const table = blocks[0].table;
  assert.deepEqual(table.columnColors, [ 'blue', 'yellow_bg' ]);
  assert.equal(table.headerRow, true);
  assert.deepEqual(table.rows, [
    { cells: [ { text: 'a' }, { color: 'red', text: 'b' } ] },
    { cells: [ { color: 'green_bg', text: 'c' }, { text: '' } ], color: 'gray_bg' }
  ]);
  assert.equal(accept(blocks).revision, 1);

  const folded = fromEditorBlocks([ { id: 't', text: '', type: 'table', table: { ...table, columnColors: [ null, 'blue' ], tableColor: 'pink' } } ]);
  assert.deepEqual(folded.blocks[0].__markdown_markdown.table.columnColors, [ 'pink', 'blue' ]);
});

test('table events carrying null colors from the native view are accepted', () => {
  const table = {
    id: 'table',
    text: '',
    type: 'table',
    table: {
      columnColors: [ null, 'blue_bg' ],
      fitPageWidth: false,
      headerColumn: false,
      headerRow: true,
      rows: [ { cells: [ { marks: [], text: 'Name' }, { marks: [], text: 'Value' } ] } ],
      tableColor: null
    }
  };
  const accepted = accept([ table ]);
  assert.equal(accepted.revision, 1);
  assert.equal(accepted.blocks[0].table.tableColor, null);
  assert.equal(accept([ { ...table, table: { ...table.table, tableColor: 'chartreuse' } } ]).revision, 0);
  assert.equal(accept([ { ...table, table: { ...table.table, columnColors: [ 'chartreuse' ] } } ]).revision, 0);
  assert.equal(serializeMarkdown(fromEditorBlocks(accepted.blocks)), [
    '<table header-row="true">',
    '\t<colgroup>',
    '\t\t<col>',
    '\t\t<col color="blue_bg">',
    '\t</colgroup>',
    '\t<tr><td>Name</td><td>Value</td></tr>',
    '</table>'
  ].join('\n'));
});

test('a paragraph with indented children round-trips through the parser', () => {
  const source = [ 'Parent {color="blue"}', '\t- Child', '\t\tGrandchild', 'Sibling' ].join('\n');
  const parsed = parseMarkdown(source);
  assert.deepEqual(parsed.diagnostics, []);
  const [ parent, sibling ] = parsed.document.blocks;
  assert.deepEqual(parent.children.map((child) => child.type), [ 'bulleted_list_item' ]);
  assert.equal(parent.children[0].children[0].paragraph.rich_text[0].text.content, 'Grandchild');
  assert.equal('children' in sibling, false);
  assert.equal(serializeMarkdown(parsed.document), source);
});

test('empty list items and headings round-trip through the parser', () => {
  const source = [ '- ', '\t- ', '\t\tUnder an empty item', '1. ', '# ', '## {color="blue"}', '- [ ] ', '> ', 'After' ].join('\n');
  const parsed = parseMarkdown(source);
  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(parsed.document.blocks.map((block) => block.type), [
    'bulleted_list_item', 'numbered_list_item', 'heading_1', 'heading_2', 'to_do', 'quote', 'paragraph'
  ]);
  assert.deepEqual(parsed.document.blocks[0].bulleted_list_item.rich_text, []);
  assert.equal(parsed.document.blocks[0].children[0].children[0].paragraph.rich_text[0].text.content, 'Under an empty item');
  assert.equal(parsed.document.blocks[3].__markdown_markdown.color, 'blue');
  const once = serializeMarkdown(parsed.document);
  assert.equal(serializeMarkdown(parseMarkdown(once).document), once);
  // The same blocks, as the editor produces them.
  const blocks = [
    { id: 'a', text: '', type: 'bulleted_list_item' },
    { depth: 1, id: 'b', text: 'Child', type: 'text' },
    { id: 'c', text: '', type: 'numbered_list_item' },
    { id: 'd', text: '', type: 'heading_2' },
    { checked: false, id: 'e', text: '', type: 'to_do' }
  ];
  const reloaded = toEditorBlocks(parseMarkdown(serializeMarkdown(fromEditorBlocks(blocks))).document).blocks;
  assert.deepEqual(reloaded.map(({ id, ...rest }) => rest), blocks.map(({ id, ...rest }) => rest));
  // Dividers and text that merely starts with a marker are unaffected.
  assert.deepEqual(parseMarkdown('---\n-x\n#tag\n1.5').document.blocks.map((block) => block.type), [
    'divider', 'paragraph', 'paragraph', 'paragraph'
  ]);
});
