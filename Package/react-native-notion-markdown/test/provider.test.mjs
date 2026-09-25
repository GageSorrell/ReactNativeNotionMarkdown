import { test } from 'node:test';
import assert from 'node:assert/strict';
/* The provider's React entry point imports react-native, so these tests load its pure modules. */
import {
  darkMarkdownTheme,
  lightMarkdownTheme,
  markdownColor,
  mergeMarkdownThemeOverrides,
  resolveMarkdownTheme,
  withAlpha
} from '../Distribution/provider/theme.js';
import { defaultMarkdownMessages, defaultMarkdownTranslate, formatMarkdownMessage } from '../Distribution/provider/messages.js';
import { mergeMarkdownConfig } from '../Distribution/provider/config.js';
import {
  defaultMarkdownEditorToolbar,
  defaultMarkdownEditorTurnIntoItems,
  editorColorChoices,
  resolveToolbarItems
} from '../Distribution/editor/ui/customization.js';

const builtins = [ 'insert', 'format', 'undo', 'redo', 'edit' ];
const button = (id) => ({ id, label: id, onPress: () => {} });
const ids = (items) => items.map((item) => item.kind === 'custom' ? `custom:${ item.button.id }` : item.id);

test('resolveMarkdownTheme returns the built-in theme for each scheme without overrides', () => {
  assert.equal(resolveMarkdownTheme('light'), lightMarkdownTheme);
  assert.equal(resolveMarkdownTheme('dark'), darkMarkdownTheme);
  assert.ok(Object.isFrozen(lightMarkdownTheme.document));
});

test('resolveMarkdownTheme deep-merges overrides for the requested scheme only, later winning', () => {
  const outer = { light: { document: { accent: '#111111', fontSize: 18 } }, dark: { document: { accent: '#222222' } } };
  const inner = { light: { document: { accent: '#333333' }, editor: { toolbar: { icon: '#444444' } } } };
  const light = resolveMarkdownTheme('light', outer, undefined, inner);
  assert.equal(light.document.accent, '#333333');
  assert.equal(light.document.fontSize, 18);
  assert.equal(light.document.foreground, lightMarkdownTheme.document.foreground);
  assert.equal(light.editor.toolbar.icon, '#444444');
  assert.equal(light.editor.toolbar.background, lightMarkdownTheme.editor.toolbar.background);
  assert.equal(resolveMarkdownTheme('dark', outer, inner).document.accent, '#222222');
  assert.equal(lightMarkdownTheme.document.accent, '#2f6eab', 'defaults are never mutated');
});

test('an explicit null replaces a default, while undefined leaves it alone', () => {
  const theme = resolveMarkdownTheme('light', { light: { editor: { fontFamily: 'serif' } } }, { light: { editor: { fontFamily: null, iconSize: undefined } } });
  assert.equal(theme.editor.fontFamily, null);
  assert.equal(theme.editor.iconSize, lightMarkdownTheme.editor.iconSize);
});

test('mergeMarkdownThemeOverrides folds a provider chain into one override', () => {
  assert.equal(mergeMarkdownThemeOverrides(undefined, undefined), undefined);
  const merged = mergeMarkdownThemeOverrides({ light: { document: { accent: '#1' } } }, { light: { document: { muted: '#2' } } });
  assert.deepEqual(merged.light.document, { accent: '#1', muted: '#2' });
});

test('markdownColor resolves both suffix conventions through the palette', () => {
  const palette = lightMarkdownTheme.palette;
  assert.equal(markdownColor('blue', palette), palette.text.blue);
  assert.equal(markdownColor('blue_bg', palette), palette.background.blue);
  assert.equal(markdownColor('blue_background', palette), palette.background.blue);
  assert.equal(markdownColor('default', palette), undefined);
  assert.equal(markdownColor('constructor', palette), undefined);
  assert.equal(markdownColor(undefined, palette), undefined);
});

test('withAlpha scales opacity for hex and rgba colors and passes unknown formats through', () => {
  assert.equal(withAlpha('#ff0000', 0.5), 'rgba(255, 0, 0, 0.5)');
  assert.equal(withAlpha('#f00', 0.2), 'rgba(255, 0, 0, 0.2)');
  assert.equal(withAlpha('rgba(10, 20, 30, 0.5)', 0.5), 'rgba(10, 20, 30, 0.25)');
  assert.equal(withAlpha('#00000080', 1), 'rgba(0, 0, 0, 0.502)');
  assert.equal(withAlpha('papayawhip', 0.5), 'papayawhip');
});

test('the default translator interpolates {name} placeholders', () => {
  assert.equal(formatMarkdownMessage('Load {kind} preview', { kind: 'PDF' }), 'Load PDF preview');
  assert.equal(formatMarkdownMessage('Keep {missing}', { other: 1 }), 'Keep {missing}');
  assert.equal(defaultMarkdownTranslate(defaultMarkdownMessages['renderer.unsupportedBlock'], { type: 'widget' }), 'Unsupported block: widget');
});

test('every catalog entry is keyed by its own id', () => {
  for (const [ key, descriptor ] of Object.entries(defaultMarkdownMessages)) {
    assert.equal(descriptor.id, key);
    assert.ok(descriptor.defaultMessage.length > 0, key);
  }
});

test('mergeMarkdownConfig merges plain objects key by key and replaces everything else', () => {
  const Icon = () => null;
  const memoIcon = { $$typeof: Symbol.for('react.memo') };
  const merged = mergeMarkdownConfig(
    { icons: { bold: Icon }, customButtons: [ button('a') ], layout: { pageMaxWidth: 700 }, pageReferenceFallbackGlyph: '*' },
    { icons: { italic: memoIcon }, customButtons: [ button('b') ], layout: { pageMaxWidth: undefined, imageMaxWidth: 400 } },
    undefined
  );
  assert.deepEqual(Object.keys(merged.icons).sort(), [ 'bold', 'italic' ]);
  assert.deepEqual(merged.customButtons.map((b) => b.id), [ 'b' ]);
  assert.deepEqual(merged.layout, { imageMaxWidth: 400, pageMaxWidth: 700 });
  assert.equal(merged.pageReferenceFallbackGlyph, '*');
  assert.equal(mergeMarkdownConfig({ checkboxComponent: memoIcon }, { checkboxComponent: Icon }).checkboxComponent, Icon);
});

test('resolveToolbarItems keeps listed order and hides unlisted built-ins', () => {
  assert.deepEqual(ids(resolveToolbarItems([ 'undo', 'insert' ], builtins, [])), [ 'undo', 'insert' ]);
});

test('resolveToolbarItems drops unknown ids and repeats', () => {
  assert.deepEqual(ids(resolveToolbarItems([ 'insert', 'nope', 'insert', 'undo' ], builtins, [])), [ 'insert', 'undo' ]);
});

test('resolveToolbarItems places listed custom buttons and appends unlisted ones', () => {
  const customs = [ button('star'), button('ai'), button('elsewhere') ];
  const items = resolveToolbarItems([ 'insert', 'star', 'undo' ], builtins, customs, { appendUnlisted: true, otherRows: [ [ 'elsewhere' ] ] });
  assert.deepEqual(ids(items), [ 'insert', 'custom:star', 'undo', 'custom:ai' ]);
});

test('a custom button whose id collides with a built-in replaces it', () => {
  const items = resolveToolbarItems([ 'insert', 'undo' ], builtins, [ button('undo') ]);
  assert.deepEqual(ids(items), [ 'insert', 'custom:undo' ]);
});

test('the default toolbar lists only built-in ids', () => {
  assert.deepEqual(ids(resolveToolbarItems(defaultMarkdownEditorToolbar.main, defaultMarkdownEditorToolbar.main, [])), defaultMarkdownEditorToolbar.main);
});

test('the default turn-into panel follows the Notion-supported block order', () => {
  assert.deepEqual(defaultMarkdownEditorTurnIntoItems, [
    'text', 'heading_1', 'heading_2', 'heading_3', 'heading_4', 'bulleted_list_item',
    'numbered_list_item', 'to_do', 'toggle', 'code', 'quote', 'callout', 'equation', 'synced_block',
    'toggle_heading_1', 'toggle_heading_2', 'toggle_heading_3', 'toggle_heading_4',
    'columns2', 'columns3', 'columns4', 'columns5'
  ]);
});

test('editorColorChoices builds translated sections from the configured hues', () => {
  const t = (id) => `t:${ id }`;
  const all = editorColorChoices(undefined, t, 'Default');
  assert.equal(all.text.length, 10);
  assert.equal(all.text[ 0 ].label, 'Default');
  assert.equal(all.background[ 1 ].color, 'gray_bg');
  assert.equal(all.background[ 1 ].label, 't:color.grayBackground');
  const some = editorColorChoices({ text: [ 'red' ], background: [], showDefault: false }, t, 'Default');
  assert.deepEqual(some.text.map((choice) => choice.color), [ 'red' ]);
  assert.deepEqual(some.background, []);
});
