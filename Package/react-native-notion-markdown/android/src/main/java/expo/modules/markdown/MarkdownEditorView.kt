package expo.modules.markdown

import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.DrawableWrapper
import android.media.AudioAttributes
import android.net.Uri
import android.media.MediaMetadataRetriever
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.InputType
import android.text.Spanned
import android.text.TextWatcher
import android.text.style.BackgroundColorSpan
import android.text.style.ForegroundColorSpan
import android.text.style.LeadingMarginSpan
import android.text.style.LineBackgroundSpan
import android.text.style.LineHeightSpan
import android.text.style.RelativeSizeSpan
import android.text.style.ReplacementSpan
import android.text.style.StrikethroughSpan
import android.text.style.StyleSpan
import android.text.style.TypefaceSpan
import android.text.style.UnderlineSpan
import android.text.style.UpdateLayout
import android.view.Gravity
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.inputmethod.BaseInputConnection
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.view.inputmethod.InputConnectionWrapper
import android.view.inputmethod.InputMethodManager
import android.view.inputmethod.CompletionInfo
import android.view.inputmethod.CorrectionInfo
import android.view.inputmethod.TextAttribute
import android.widget.EditText
import android.widget.FrameLayout
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.hypot
import kotlin.math.roundToInt
import kotlin.math.sin

private const val FRAGMENT_MIME = "application/vnd.react-native-notion-markdown.editor+json"
private const val AUDIO_WAVEFORM_BAR_COUNT = 32

/** Relative text size applied to each heading level's span, matching Markdown's own descending scale. */
private val headingScale = mapOf(1 to 1.875f, 2 to 1.5f, 3 to 1.25f, 4 to 1.125f)

/** Solid text colors -- the same nine named colors and RGB values as `MarkdownTextFieldView`'s
 *  inline `markColors`, kept in sync manually since this is a block-level, not inline, span. */
private val editorTextColors: Map<String, Int> = mapOf(
  "gray" to Color.rgb(120, 119, 116),
  "brown" to Color.rgb(159, 107, 83),
  "orange" to Color.rgb(217, 115, 13),
  "yellow" to Color.rgb(203, 145, 47),
  "green" to Color.rgb(68, 131, 97),
  "blue" to Color.rgb(51, 126, 169),
  "purple" to Color.rgb(144, 101, 176),
  "pink" to Color.rgb(193, 76, 138),
  "red" to Color.rgb(212, 76, 71)
)

/** The `_bg` background variants -- the same nine hues as `editorTextColors`, applied as a
 *  translucent tint so they read against both light and dark editor backgrounds. */
private val editorBackgroundColors: Map<String, Int> = mapOf(
  "gray_bg" to Color.argb(56, 120, 119, 116),
  "brown_bg" to Color.argb(56, 159, 107, 83),
  "orange_bg" to Color.argb(56, 217, 115, 13),
  "yellow_bg" to Color.argb(56, 203, 145, 47),
  "green_bg" to Color.argb(56, 68, 131, 97),
  "blue_bg" to Color.argb(56, 51, 126, 169),
  "purple_bg" to Color.argb(56, 144, 101, 176),
  "pink_bg" to Color.argb(56, 193, 76, 138),
  "red_bg" to Color.argb(56, 212, 76, 71)
)

private val editorValidBlockTypes = listOf(
  "text", "heading_1", "heading_2", "heading_3", "heading_4", "bulleted_list_item",
  "numbered_list_item", "to_do", "callout", "quote", "table", "divider", "table_of_contents", "column_list", "image", "audio", "video", "file",
  "link_to_page"
)
private val editorValidColors = editorTextColors.keys + editorBackgroundColors.keys

/** Block types with mergeable text content -- eligible on either side of an atomic-block-skipping
 *  backspace merge (see [MarkdownEditorView.handleAtomicBlockBackspace]). */
private val editorMergeableBlockTypes = setOf(
  "text", "heading_1", "heading_2", "heading_3", "heading_4",
  "bulleted_list_item", "numbered_list_item", "to_do", "callout", "quote"
)

/** Block types with no navigable text of their own -- see [MarkdownEditorView.handleAtomicBlockBackspace]. */
private val editorAtomicBlockTypes = setOf("divider", "table", "image", "audio", "video", "file")

/** A checked to-do's checkbox fill and its unchecked border, matching the renderer's theme accent. */
private fun editorAccentColor(dark: Boolean) = if (dark) Color.rgb(0x81, 0xB8, 0xE7) else Color.rgb(0x2F, 0x6E, 0xAB)

/** A checked to-do's text color, matching the renderer theme's muted foreground. */
private fun editorMutedColor(dark: Boolean) = if (dark) Color.rgb(0xA0, 0xA0, 0xA0) else Color.rgb(0x73, 0x73, 0x73)

/** An unchecked to-do checkbox's border color, matching the renderer theme's border. */
private fun editorCheckboxBorderColor(dark: Boolean) = if (dark) Color.rgb(0x41, 0x41, 0x41) else Color.rgb(0xDE, 0xDE, 0xDB)

/** A callout's default box tint when no `_bg` color is chosen, matching the renderer theme's surface. */
private fun editorCalloutDefaultBackground(dark: Boolean) = if (dark) Color.rgb(0x25, 0x25, 0x25) else Color.rgb(0xF7, 0xF7, 0xF5)

/** A quote's default left-border bar color when no color is chosen, matching the renderer's blockquote border. */
private fun editorQuoteBarColor(dark: Boolean) = if (dark) Color.rgb(0x41, 0x41, 0x41) else Color.rgb(0xDE, 0xDE, 0xDB)
private const val DIVIDER_TEXT = "\u200B"
private const val TABLE_OF_CONTENTS_TEXT = "\u200B"
private const val COLUMNS_TEXT = "\u200B"
private const val EMPTY_BLOCK_TEXT = "\u200B"
private const val TABLE_TEXT = "\uFFFC"
private const val MEDIA_TEXT = "\uFFFC"
private const val TABLE_OF_CONTENTS_LABEL = "Table of contents"
private const val DEFAULT_EMPTY_TOGGLE_PLACEHOLDER = "Empty toggle.  Tap to add text or create a new block."
private const val DEFAULT_EMPTY_TODO_PLACEHOLDER = "To do"
private const val DEFAULT_CALLOUT_ICON = "\uD83D\uDCAC"
private const val TOGGLE_BUTTON_WIDTH_SCALE = 1.5f
private const val TODO_CHECKBOX_WIDTH_SCALE = 1.5f
private const val LIST_MARKER_WIDTH_SCALE = 1.5f
private const val CALLOUT_OUTER_PADDING_DP = 8
private const val CALLOUT_SURFACE_PADDING_DP = 12
private const val CALLOUT_ICON_WIDTH_DP = 24
private const val CALLOUT_ICON_GAP_DP = 8
private const val CALLOUT_BLOCK_PADDING_DP =
  CALLOUT_OUTER_PADDING_DP + CALLOUT_SURFACE_PADDING_DP + 6
private const val QUOTE_BAR_WIDTH_DP = 3
private const val QUOTE_TEXT_INDENT_DP = 12
private const val TABLE_CELL_HEIGHT_DP = 44
private const val TABLE_CELL_HORIZONTAL_PADDING_DP = 7
private const val TABLE_CELL_VERTICAL_PADDING_DP = 2

/** Returns the table's rendered width, keeping non-fitting tables content-sized when possible. */
private fun tableDisplayWidthPx(input: EditText, table: EditorTable): Int {
  val density = input.resources.displayMetrics.density
  val pageWidth = (input.width - input.paddingLeft - input.paddingRight).coerceAtLeast(1)
  if (table.fitPageWidth) return pageWidth
  val columnCount = maxOf(1, table.rows.maxOfOrNull { it.cells.size } ?: 1)
  val minimumColumnWidth = (96 * density).roundToInt()
  val padding = (TABLE_CELL_HORIZONTAL_PADDING_DP * density * 2).roundToInt()
  val columnWidths = MutableList(columnCount) { minimumColumnWidth }
  table.rows.forEach { row ->
    row.cells.forEachIndexed { column, cell ->
      val measured = input.paint.measureText(cell.text).roundToInt() + padding
      columnWidths[column] = maxOf(columnWidths[column], measured)
    }
  }
  return columnWidths.sum().coerceAtMost(pageWidth).coerceAtLeast(minimumColumnWidth)
}

private fun editorHeadingLevel(type: String): Int? = when (type) {
  "heading_1" -> 1
  "heading_2" -> 2
  "heading_3" -> 3
  "heading_4" -> 4
  else -> null
}

private data class EditorBlock(
  val id: String,
  var type: String,
  var text: String,
  var color: String? = null,
  var depth: Int = 0,
  var toggle: Boolean = false,
  var collapsed: Boolean = false,
  val marks: MutableList<EditorMark> = mutableListOf(),
  var checked: Boolean = false,
  var url: String? = null,
  var icon: String? = null,
  var columnCount: Int? = null,
  var duration: Double? = null,
  var mimeType: String? = null,
  var fileName: String? = null,
  var fileSize: Double? = null,
  var waveform: List<Float>? = null,
  var table: EditorTable? = null
) {
  fun payload(): Map<String, Any?> {
    val base = mutableMapOf<String, Any?>("id" to id, "type" to type, "text" to text)
    color?.let { base["color"] = it }
    if (depth > 0) base["depth"] = depth
    if (toggle) base["toggle"] = true
    if (toggle && collapsed) base["collapsed"] = true
    if (type == "to_do") base["checked"] = checked
    if (type == "column_list") base["columnCount"] = (columnCount ?: 2).coerceIn(2, 5)
    if (type == "link_to_page" || type == "image" || type == "audio" || type == "video" || type == "file") {
      url?.let { base["url"] = it }
    }
    if (type == "audio" || type == "file") {
      duration?.let { base["duration"] = it }
      mimeType?.let { base["mimeType"] = it }
      fileName?.let { base["fileName"] = it }
      fileSize?.let { base["fileSize"] = it }
    }
    if (type == "audio") {
      waveform?.takeIf { it.isNotEmpty() }?.let { base["waveform"] = it }
    }
    table?.let { base["table"] = it.payload() }
    if (type == "link_to_page" || type == "callout") {
      icon?.let { base["icon"] = it }
    }
    if (marks.isNotEmpty()) {
      base["marks"] = marks.map {
        mapOf(
          "kind" to it.kind,
          "start" to it.start,
          "end" to it.end,
          "url" to it.url
        ).filterValues { value -> value != null }
      }
    }
    return base
  }
}

private data class EditorTableCell(
  var text: String,
  val marks: MutableList<EditorMark> = mutableListOf(),
  var color: String? = null
) {
  fun payload(): Map<String, Any?> = mapOf(
    "text" to text,
    "marks" to marks.map { mark ->
      mapOf("kind" to mark.kind, "start" to mark.start, "end" to mark.end, "url" to mark.url)
        .filterValues { value -> value != null }
    },
    "color" to color
  ).filterValues { value -> value != null }
}

private data class EditorTableRow(
  val cells: MutableList<EditorTableCell>,
  var color: String? = null
) {
  fun payload(): Map<String, Any?> = mapOf("cells" to cells.map { it.payload() }, "color" to color)
    .filterValues { value -> value != null }
}

private data class EditorTable(
  val rows: MutableList<EditorTableRow>,
  val columnColors: MutableList<String?> = mutableListOf(),
  var tableColor: String? = null,
  var fitPageWidth: Boolean = false,
  var headerRow: Boolean = false,
  var headerColumn: Boolean = false
) {
  fun payload(): Map<String, Any?> = mapOf(
    "rows" to rows.map { it.payload() },
    "columnColors" to columnColors,
    "tableColor" to tableColor,
    "fitPageWidth" to fitPageWidth,
    "headerRow" to headerRow,
    "headerColumn" to headerColumn
  )
}

private fun parseEditorTable(value: Any?): EditorTable? {
  val source = value as? Map<*, *> ?: return null
  val rawRows = source["rows"] as? List<*> ?: return null
  if (rawRows.isEmpty()) return null
  val rows = rawRows.mapNotNull { rawRow ->
    val row = rawRow as? Map<*, *> ?: return@mapNotNull null
    val rawCells = row["cells"] as? List<*> ?: return@mapNotNull null
    val cells = rawCells.mapNotNull { rawCell ->
      val cell = rawCell as? Map<*, *> ?: return@mapNotNull null
      val text = cell["text"] as? String ?: return@mapNotNull null
      if (text.contains('\n')) return@mapNotNull null
      val marks = mutableListOf<EditorMark>()
      (cell["marks"] as? List<*>)?.forEach { rawMark ->
        val mark = rawMark as? Map<*, *> ?: return@forEach
        val kind = mark["kind"] as? String ?: return@forEach
        val start = (mark["start"] as? Number)?.toInt() ?: return@forEach
        val end = (mark["end"] as? Number)?.toInt() ?: return@forEach
        val url = (mark["url"] as? String)?.takeIf { kind == "link" }
        if (start >= 0 && end > start && end <= text.length &&
          (kind in listOf("bold", "italic", "strikethrough", "underline", "code") ||
            (kind == "link" && !url.isNullOrBlank()))) marks.add(EditorMark(kind, start, end, url))
      }
      EditorTableCell(text, marks, (cell["color"] as? String)?.takeIf { it in editorValidColors })
    }
    if (cells.size != rawCells.size) return@mapNotNull null
    EditorTableRow(cells.toMutableList(), (row["color"] as? String)?.takeIf { it in editorValidColors })
  }
  if (rows.size != rawRows.size || rows.any { it.cells.isEmpty() }) return null
  val width = rows.first().cells.size
  if (rows.any { it.cells.size != width }) return null
  val colors = (source["columnColors"] as? List<*>)?.map { (it as? String)?.takeIf { value -> value in editorValidColors } }?.toMutableList() ?: mutableListOf()
  return EditorTable(
    rows.toMutableList(),
    colors,
    (source["tableColor"] as? String)?.takeIf { it in editorValidColors },
    source["fitPageWidth"] as? Boolean ?: false,
    source["headerRow"] as? Boolean ?: false,
    source["headerColumn"] as? Boolean ?: false
  )
}

private data class EditorMark(
  val kind: String,
  var start: Int,
  var end: Int,
  val url: String? = null
)

private data class TableCellAddress(
  val blockIndex: Int,
  val row: Int,
  val column: Int
)

private data class EditorPasteBlock(
  val type: String,
  val text: String,
  val color: String?,
  val marks: List<EditorMark>,
  val checked: Boolean = false,
  val url: String? = null,
  val icon: String? = null,
  val columnCount: Int? = null,
  val duration: Double? = null,
  val mimeType: String? = null,
  val fileName: String? = null,
  val fileSize: Double? = null,
  val waveform: List<Float>? = null
)

/** Marker span used to preserve inline marks while Android adjusts ranges during text edits. */
private class EditorInlineMarkSpan(val kind: String, val url: String? = null) : android.text.style.CharacterStyle() {
  override fun updateDrawState(textPaint: android.text.TextPaint) = Unit
}

/**
 * Adds a block's top/bottom padding and a one-eighth natural-height gap between wrapped lines.
 * [blockStart] and [blockEnd] are the block's own fixed offsets at span-creation time (recomputed
 * every [MarkdownEditorView.styleBlocks] pass), compared against the line range Android passes to
 * [chooseHeight] to tell a block's boundary line from an interior wrapped line.
 * This also implements [UpdateLayout] because [MarkdownEditorView.styleBlocks] replaces these spans
 * after edits; DynamicLayout only recalculates existing lines when a changed span has that marker.
 */
private class BlockPaddingSpan(
  private val top: Int,
  private val bottom: Int,
  private val blockStart: Int,
  private val blockEnd: Int
) : LineHeightSpan, UpdateLayout {
  private var previousEnd = -1
  private var previousAscent = 0
  private var previousTop = 0
  private var previousDescent = 0
  private var previousBottom = 0
  private var addedTop = 0
  private var addedBelow = 0

  override fun chooseHeight(
    text: CharSequence,
    start: Int,
    end: Int,
    spanstartv: Int,
    lineHeight: Int,
    fm: Paint.FontMetricsInt
  ) {
    // StaticLayout carries a span's adjusted metrics into its next wrapped line. Undo only the
    // values that survived that carry; a taller glyph on the new line may have replaced them.
    if (start == previousEnd && start > blockStart) {
      if (fm.ascent == previousAscent) fm.ascent += addedTop
      if (fm.top == previousTop) fm.top += addedTop
      if (fm.descent == previousDescent) fm.descent -= addedBelow
      if (fm.bottom == previousBottom) fm.bottom -= addedBelow
    }
    val naturalHeight = fm.descent - fm.ascent
    val firstLineTop = if (start <= blockStart) top else 0
    val lastLineBottom = if (end >= blockEnd) bottom else 0
    val wrapGap = if (end < blockEnd) (naturalHeight * 0.125f).roundToInt() else 0
    if (start <= blockStart) {
      fm.ascent -= top
      fm.top -= top
    }
    fm.descent += lastLineBottom + wrapGap
    fm.bottom += lastLineBottom + wrapGap
    previousEnd = end
    previousAscent = fm.ascent
    previousTop = fm.top
    previousDescent = fm.descent
    previousBottom = fm.bottom
    addedTop = firstLineTop
    addedBelow = lastLineBottom + wrapGap
  }
}

/** Keeps non-rendering blocks measurable while Android applies spans to their caret lines. */
private fun EditorBlock.nativeText(): String = when {
  type == "table" -> TABLE_TEXT
  type == "image" || type == "audio" || type == "video" || type == "file" -> MEDIA_TEXT
  text.isEmpty() -> EMPTY_BLOCK_TEXT
  else -> text
}

private fun List<EditorBlock>.nativeText(): String = joinToString("\n") { it.nativeText() }

/** Draws a divider block while keeping its editor text payload invisible and editable. */
private class DividerSpan(
  private val leftInset: Int,
  private val rightInset: Int
) : ReplacementSpan() {
  override fun getSize(paint: Paint, text: CharSequence, start: Int, end: Int, fm: Paint.FontMetricsInt?): Int {
    val extraBottom = (paint.textSize * 0.5f).toInt()
    fm?.let {
      it.descent += extraBottom
      it.bottom += extraBottom
    }
    return 0
  }

  override fun draw(
    canvas: Canvas,
    text: CharSequence,
    start: Int,
    end: Int,
    x: Float,
    top: Int,
    y: Int,
    bottom: Int,
    paint: Paint
  ) {
    val previousStyle = paint.style
    val previousStrokeWidth = paint.strokeWidth
    val previousAlpha = paint.alpha
    paint.style = Paint.Style.STROKE
    paint.alpha = (previousAlpha * 0.55f).toInt()
    paint.strokeWidth = 0.75f
    val lineY = (top + bottom) / 2f
    canvas.drawLine(
      x + leftInset,
      lineY,
      canvas.width.toFloat() - rightInset,
      lineY,
      paint
    )
    paint.style = previousStyle
    paint.strokeWidth = previousStrokeWidth
    paint.alpha = previousAlpha
  }
}

/** Renders a local camera/gallery asset as a centered, full-width image block. */
private class EditorImageSpan(
  private val input: EditText,
  source: String,
  private val maxWidth: Int
) : ReplacementSpan() {
  private val bitmap = runCatching {
    val uri = Uri.parse(source)
    val stream = when (uri.scheme) {
      "content" -> input.context.contentResolver.openInputStream(uri)
      "file", null -> java.io.FileInputStream(uri.path ?: source)
      else -> null
    }
    stream?.use { BitmapFactory.decodeStream(it) }
  }.getOrNull()

  private fun targetWidth(): Int {
    val available = (input.width - input.paddingLeft - input.paddingRight).coerceAtLeast(1)
    return minOf(available, maxWidth.takeIf { it > 0 } ?: available)
  }

  private fun targetHeight(): Int {
    val image = bitmap ?: return input.textSize.roundToInt().coerceAtLeast(1) * 2
    return (targetWidth() * image.height.toFloat() / image.width.toFloat()).roundToInt().coerceAtLeast(1)
  }

  override fun getSize(
    paint: Paint,
    text: CharSequence,
    start: Int,
    end: Int,
    fm: Paint.FontMetricsInt?
  ): Int {
    val height = targetHeight()
    fm?.let {
      it.top = -height
      it.ascent = -height
      it.descent = 0
      it.bottom = 0
    }
    return targetWidth()
  }

  override fun draw(
    canvas: Canvas,
    text: CharSequence,
    start: Int,
    end: Int,
    x: Float,
    top: Int,
    y: Int,
    bottom: Int,
    paint: Paint
  ) {
    val width = targetWidth()
    val height = targetHeight()
    val left = x + ((input.width - input.paddingLeft - input.paddingRight - width) / 2f)
    val rect = RectF(left, (y - height).toFloat(), left + width, y.toFloat())
    bitmap?.let {
      val previousFilter = paint.isFilterBitmap
      paint.isFilterBitmap = true
      canvas.drawBitmap(it, null, rect, paint)
      paint.isFilterBitmap = previousFilter
    } ?: run {
      val previousColor = paint.color
      paint.color = Color.LTGRAY
      canvas.drawRect(rect, paint)
      paint.color = previousColor
    }
  }
}

/** Renders a local camera/gallery video as a centered, full-width poster with a play affordance. */
private class EditorVideoSpan(
  private val input: EditText,
  source: String,
  private val maxWidth: Int
) : ReplacementSpan() {
  private val frame: Bitmap? = runCatching {
    val retriever = MediaMetadataRetriever()
    try {
      val uri = Uri.parse(source)
      when (uri.scheme) {
        "content" -> retriever.setDataSource(input.context, uri)
        "file", null -> retriever.setDataSource(uri.path ?: source)
        else -> return@runCatching null
      }
      retriever.getFrameAtTime(0L, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
    } finally {
      retriever.release()
    }
  }.getOrNull()

  private fun targetWidth(): Int {
    val available = (input.width - input.paddingLeft - input.paddingRight).coerceAtLeast(1)
    return minOf(available, maxWidth.takeIf { it > 0 } ?: available)
  }

  private fun targetHeight(): Int {
    val image = frame ?: return (targetWidth() * 9f / 16f).roundToInt().coerceAtLeast(1)
    return (targetWidth() * image.height.toFloat() / image.width.toFloat()).roundToInt().coerceAtLeast(1)
  }

  override fun getSize(
    paint: Paint,
    text: CharSequence,
    start: Int,
    end: Int,
    fm: Paint.FontMetricsInt?
  ): Int {
    val height = targetHeight()
    fm?.let {
      it.top = -height
      it.ascent = -height
      it.descent = 0
      it.bottom = 0
    }
    return targetWidth()
  }

  override fun draw(
    canvas: Canvas,
    text: CharSequence,
    start: Int,
    end: Int,
    x: Float,
    top: Int,
    y: Int,
    bottom: Int,
    paint: Paint
  ) {
    val width = targetWidth()
    val height = targetHeight()
    val left = x + ((input.width - input.paddingLeft - input.paddingRight - width) / 2f)
    val rect = RectF(left, (y - height).toFloat(), left + width, y.toFloat())
    frame?.let {
      val previousFilter = paint.isFilterBitmap
      paint.isFilterBitmap = true
      canvas.drawBitmap(it, null, rect, paint)
      paint.isFilterBitmap = previousFilter
    } ?: run {
      val previousColor = paint.color
      paint.color = Color.DKGRAY
      canvas.drawRect(rect, paint)
      paint.color = previousColor
    }

    val previousStyle = paint.style
    val previousColor = paint.color
    val previousAlpha = paint.alpha
    paint.style = Paint.Style.FILL
    paint.color = Color.argb(110, 0, 0, 0)
    canvas.drawRect(rect, paint)
    val centerX = rect.centerX()
    val centerY = rect.centerY()
    val radius = minOf(rect.width(), rect.height()) * 0.13f
    val play = Path().apply {
      moveTo(centerX - radius * 0.35f, centerY - radius)
      lineTo(centerX + radius, centerY)
      lineTo(centerX - radius * 0.35f, centerY + radius)
      close()
    }
    paint.color = Color.WHITE
    canvas.drawPath(play, paint)
    paint.style = previousStyle
    paint.color = previousColor
    paint.alpha = previousAlpha
  }
}

private fun fallbackAudioWaveform(seed: String): List<Float> {
  var hash = 2166136261L
  seed.forEach { character ->
    hash = (hash xor character.code.toLong()) * 16777619L
  }
  return List(AUDIO_WAVEFORM_BAR_COUNT) { index ->
    (0.18f + abs(sin((index + 1) * 1.73 + (hash and 0xffffffffL) / 100000000.0)).toFloat() * 0.62f)
      .coerceIn(0.18f, 1f)
  }
}

private fun audioWaveformFromValue(value: Any?): List<Float>? =
  (value as? List<*>)?.mapNotNull { (it as? Number)?.toFloat()?.takeIf { number -> number.isFinite() } }
    ?.map { it.coerceIn(0f, 1f) }
    ?.take(AUDIO_WAVEFORM_BAR_COUNT)
    ?.takeIf { it.isNotEmpty() }

private fun audioWaveform(block: EditorBlock): List<Float> =
  block.waveform?.filter { it.isFinite() }?.map { it.coerceIn(0f, 1f) }?.takeIf { it.isNotEmpty() }
    ?: fallbackAudioWaveform(block.fileName ?: block.url ?: block.id)

private fun blendAudioColors(from: Int, to: Int, amount: Float): Int {
  val fraction = amount.coerceIn(0f, 1f)
  val red = (Color.red(from) + (Color.red(to) - Color.red(from)) * fraction).roundToInt()
  val green = (Color.green(from) + (Color.green(to) - Color.green(from)) * fraction).roundToInt()
  val blue = (Color.blue(from) + (Color.blue(to) - Color.blue(from)) * fraction).roundToInt()
  return Color.rgb(red, green, blue)
}

/** Draws a compact, atomic audio card. Playback is owned by [MarkdownEditorView] so every audio
 * block in one editor shares one player and tapping the card can distinguish play from select. */
private class EditorAudioSpan(
  private val input: EditText,
  private val label: String,
  private val durationSeconds: Double?,
  private val waveform: List<Float>,
  private val dark: Boolean,
  private val currentTimeSeconds: () -> Double,
  private val playing: () -> Boolean
) : ReplacementSpan() {
  private val density = input.resources.displayMetrics.density
  private val cardHeight = (88 * density).roundToInt().coerceAtLeast(1)

  private fun targetWidth(): Int = (input.width - input.paddingLeft - input.paddingRight).coerceAtLeast(1)

  override fun getSize(
    paint: Paint,
    text: CharSequence,
    start: Int,
    end: Int,
    fm: Paint.FontMetricsInt?
  ): Int {
    fm?.let {
      it.top = -cardHeight
      it.ascent = -cardHeight
      it.descent = 0
      it.bottom = 0
    }
    return targetWidth()
  }

  override fun draw(
    canvas: Canvas,
    text: CharSequence,
    start: Int,
    end: Int,
    x: Float,
    top: Int,
    y: Int,
    bottom: Int,
    paint: Paint
  ) {
    val width = targetWidth().toFloat()
    val rect = RectF(x, (y - cardHeight).toFloat(), x + width, y.toFloat())
    val previousColor = paint.color
    val previousStyle = paint.style
    paint.style = Paint.Style.FILL
    paint.color = if (dark) Color.rgb(45, 54, 59) else Color.rgb(240, 246, 248)
    canvas.drawRoundRect(rect, 12 * density, 12 * density, paint)
    paint.color = if (dark) Color.rgb(142, 193, 219) else Color.rgb(51, 126, 169)
    val centerY = rect.centerY()
    val iconX = rect.left + 26 * density
    canvas.drawCircle(iconX, centerY, 15 * density, paint)
    paint.color = Color.WHITE
    if (playing()) {
      canvas.drawRoundRect(iconX - 6 * density, centerY - 6 * density,
        iconX - 1 * density, centerY + 6 * density, 1 * density, 1 * density, paint)
      canvas.drawRoundRect(iconX + 1 * density, centerY - 6 * density,
        iconX + 6 * density, centerY + 6 * density, 1 * density, 1 * density, paint)
    } else {
      val triangle = Path().apply {
        moveTo(iconX - 3 * density, centerY - 6 * density)
        lineTo(iconX + 6 * density, centerY)
        lineTo(iconX - 3 * density, centerY + 6 * density)
        close()
      }
      canvas.drawPath(triangle, paint)
    }
    paint.color = if (dark) Color.WHITE else Color.rgb(44, 44, 43)
    paint.textSize = 16 * density
    canvas.drawText(label.ifBlank { "Audio" }.take(42), rect.left + 52 * density, centerY - 22 * density, paint)

    val current = currentTimeSeconds().coerceAtLeast(0.0).coerceAtMost(durationSeconds ?: Double.MAX_VALUE)
    val progress = if (durationSeconds != null && durationSeconds > 0) {
      (current / durationSeconds).toFloat().coerceIn(0f, 1f)
    } else 0f
    val waveformLeft = rect.left + 52 * density
    val waveformRight = rect.right - 12 * density
    val waveformWidth = (waveformRight - waveformLeft).coerceAtLeast(1f)
    val gap = 2 * density
    val barSlotWidth = ((waveformWidth - gap * (waveform.size - 1)) / waveform.size).coerceAtLeast(1f)
    val barWidth = barSlotWidth / 2
    val waveformCenter = centerY - 1 * density
    val lightWaveformColor = if (dark) Color.rgb(91, 127, 148) else Color.rgb(169, 201, 216)
    val darkWaveformColor = if (dark) Color.rgb(142, 193, 219) else Color.rgb(51, 126, 169)
    waveform.forEachIndexed { index, amplitude ->
      val startProgress = index.toFloat() / waveform.size
      val endProgress = (index + 1).toFloat() / waveform.size
      val colorAmount = ((progress - startProgress) / (endProgress - startProgress)).coerceIn(0f, 1f)
      paint.color = blendAudioColors(lightWaveformColor, darkWaveformColor, colorAmount)
      val barHeight = (5 + amplitude.coerceIn(0f, 1f) * 19) * density
      val left = waveformLeft + index * (barSlotWidth + gap) + (barSlotWidth - barWidth) / 2
      canvas.drawRoundRect(left, waveformCenter - barHeight / 2, left + barWidth,
        waveformCenter + barHeight / 2, barWidth / 2, barWidth / 2, paint)
    }

    paint.color = if (dark) Color.WHITE else Color.rgb(44, 44, 43)
    paint.textSize = 12 * density
    paint.alpha = 175
    val duration = durationSeconds?.takeIf { it.isFinite() && it >= 0 }?.let { formatAudioTime(it) } ?: "Audio"
    canvas.drawText("${formatAudioTime(current)} / $duration", rect.left + 52 * density, centerY + 30 * density, paint)
    paint.alpha = 255
    paint.color = previousColor
    paint.style = previousStyle
  }

  private fun formatAudioTime(seconds: Double): String {
    val total = seconds.roundToInt().coerceAtLeast(0)
    return "${total / 60}:${(total % 60).toString().padStart(2, '0')}"
  }
}

private fun formatFileSize(bytes: Double?): String {
  if (bytes == null || !bytes.isFinite() || bytes < 0) return "Unknown size"
  val units = arrayOf("B", "KB", "MB", "GB", "TB")
  var value = bytes
  var unit = 0
  while (value >= 1024 && unit < units.lastIndex) {
    value /= 1024
    unit += 1
  }
  val formatted = if (unit == 0) value.roundToInt().toString() else String.format("%.1f", value)
  return "$formatted ${units[unit]}"
}

/** Draws a compact, atomic file card with a generic document icon and file metadata. */
private class EditorFileSpan(
  private val input: EditText,
  private val fileName: String?,
  private val fileSize: Double?,
  private val dark: Boolean
) : ReplacementSpan() {
  private val density = input.resources.displayMetrics.density
  private val cardHeight = (72 * density).roundToInt().coerceAtLeast(1)

  private fun targetWidth(): Int = (input.width - input.paddingLeft - input.paddingRight).coerceAtLeast(1)

  override fun getSize(
    paint: Paint,
    text: CharSequence,
    start: Int,
    end: Int,
    fm: Paint.FontMetricsInt?
  ): Int {
    fm?.let {
      it.top = -cardHeight
      it.ascent = -cardHeight
      it.descent = 0
      it.bottom = 0
    }
    return targetWidth()
  }

  override fun draw(
    canvas: Canvas,
    text: CharSequence,
    start: Int,
    end: Int,
    x: Float,
    top: Int,
    y: Int,
    bottom: Int,
    paint: Paint
  ) {
    val width = targetWidth().toFloat()
    val rect = RectF(x, (y - cardHeight).toFloat(), x + width, y.toFloat())
    val previousColor = paint.color
    val previousStyle = paint.style
    val previousStrokeWidth = paint.strokeWidth
    paint.style = Paint.Style.FILL
    paint.color = if (dark) Color.rgb(45, 45, 44) else Color.rgb(247, 247, 245)
    canvas.drawRoundRect(rect, 12 * density, 12 * density, paint)

    val iconLeft = rect.left + 16 * density
    val iconTop = rect.centerY() - 18 * density
    val iconRight = iconLeft + 28 * density
    val iconBottom = iconTop + 36 * density
    paint.color = if (dark) Color.rgb(142, 193, 219) else Color.rgb(51, 126, 169)
    canvas.drawRoundRect(iconLeft, iconTop, iconRight, iconBottom, 4 * density, 4 * density, paint)
    paint.color = if (dark) Color.rgb(45, 45, 44) else Color.rgb(247, 247, 245)
    val fold = Path().apply {
      moveTo(iconRight - 10 * density, iconTop)
      lineTo(iconRight, iconTop + 10 * density)
      lineTo(iconRight - 10 * density, iconTop + 10 * density)
      close()
    }
    canvas.drawPath(fold, paint)
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = 1.5f * density
    paint.color = if (dark) Color.rgb(45, 54, 59) else Color.WHITE
    canvas.drawLine(iconLeft + 7 * density, iconTop + 19 * density,
      iconRight - 7 * density, iconTop + 19 * density, paint)
    canvas.drawLine(iconLeft + 7 * density, iconTop + 25 * density,
      iconRight - 7 * density, iconTop + 25 * density, paint)

    paint.style = Paint.Style.FILL
    paint.color = if (dark) Color.WHITE else Color.rgb(44, 44, 43)
    paint.textSize = 16 * density
    canvas.drawText((fileName ?: "File").ifBlank { "File" }.take(48),
      rect.left + 58 * density, rect.centerY() - 3 * density, paint)
    paint.color = if (dark) Color.rgb(173, 169, 163) else Color.rgb(120, 119, 116)
    paint.textSize = 12 * density
    canvas.drawText(formatFileSize(fileSize), rect.left + 58 * density,
      rect.centerY() + 19 * density, paint)
    paint.color = previousColor
    paint.style = previousStyle
    paint.strokeWidth = previousStrokeWidth
  }
}

/** Draws a compact table-of-contents placeholder for the editor's non-text block. */
private class TableOfContentsSpan : ReplacementSpan() {
  override fun getSize(paint: Paint, text: CharSequence, start: Int, end: Int, fm: Paint.FontMetricsInt?): Int =
    (paint.measureText(TABLE_OF_CONTENTS_LABEL) + paint.textSize * 2.5f).toInt()

  override fun draw(
    canvas: Canvas,
    text: CharSequence,
    start: Int,
    end: Int,
    x: Float,
    top: Int,
    y: Int,
    bottom: Int,
    paint: Paint
  ) {
    val previousStyle = paint.style
    val previousStrokeWidth = paint.strokeWidth
    val width = getSize(paint, text, start, end, null).toFloat()
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = maxOf(1f, paint.textSize / 16f)
    canvas.drawRoundRect(x, top + 2f, x + width, bottom - 2f, 6f, 6f, paint)
    paint.style = Paint.Style.FILL
    canvas.drawText(TABLE_OF_CONTENTS_LABEL, x + paint.textSize * 1.25f, y.toFloat(), paint)
    paint.style = previousStyle
    paint.strokeWidth = previousStrokeWidth
  }
}

/** Draws the selected-column-count placeholder used by the editor's composite column block. */
private class ColumnsSpan(private val columnCount: Int) : ReplacementSpan() {
  private val count = columnCount.coerceIn(2, 5)

  override fun getSize(paint: Paint, text: CharSequence, start: Int, end: Int, fm: Paint.FontMetricsInt?): Int =
    (paint.textSize * (8f + (count - 2) * 2f)).toInt()

  override fun draw(
    canvas: Canvas,
    text: CharSequence,
    start: Int,
    end: Int,
    x: Float,
    top: Int,
    y: Int,
    bottom: Int,
    paint: Paint
  ) {
    val previousStyle = paint.style
    val previousStrokeWidth = paint.strokeWidth
    val width = getSize(paint, text, start, end, null).toFloat()
    val gap = paint.textSize * 0.5f
    val columnWidth = (width - gap * (count - 1)) / count
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = maxOf(1f, paint.textSize / 16f)
    repeat(count) { index ->
      val left = x + index * (columnWidth + gap)
      canvas.drawRoundRect(left, top + 2f, left + columnWidth, bottom - 2f, 6f, 6f, paint)
    }
    paint.style = previousStyle
    paint.strokeWidth = previousStrokeWidth
  }
}

/** Draws an atomic table preview while the text editor keeps the document transport stable. */
private class TableSpan(
  private val input: EditText,
  private val table: EditorTable,
  private val dark: Boolean
) : ReplacementSpan() {
  private val density = input.resources.displayMetrics.density
  private val rowHeight = (TABLE_CELL_HEIGHT_DP * density).roundToInt().coerceAtLeast(1)
  private val border = if (dark) Color.rgb(65, 65, 65) else Color.rgb(222, 222, 219)
  private val surface = if (dark) Color.rgb(45, 45, 44) else Color.rgb(247, 247, 245)
  private val background = if (dark) Color.rgb(25, 25, 25) else Color.WHITE

  private fun width(): Int = tableDisplayWidthPx(input, table)
  private fun columnCount(): Int = maxOf(1, table.rows.maxOfOrNull { it.cells.size } ?: 1)
  private fun height(): Int = table.rows.size * rowHeight + density.roundToInt()
  private fun namedColor(value: String?): Int? = when (value) {
    "gray" -> Color.rgb(120, 119, 116)
    "brown" -> Color.rgb(159, 107, 83)
    "orange" -> Color.rgb(217, 115, 13)
    "yellow" -> Color.rgb(203, 145, 47)
    "green" -> Color.rgb(68, 131, 97)
    "blue" -> Color.rgb(51, 126, 169)
    "purple" -> Color.rgb(144, 101, 176)
    "pink" -> Color.rgb(193, 76, 138)
    "red" -> Color.rgb(212, 76, 71)
    "gray_bg" -> Color.rgb(233, 233, 231)
    "brown_bg" -> Color.rgb(238, 224, 214)
    "orange_bg" -> Color.rgb(249, 225, 204)
    "yellow_bg" -> Color.rgb(249, 237, 197)
    "green_bg" -> Color.rgb(218, 236, 223)
    "blue_bg" -> Color.rgb(217, 234, 250)
    "purple_bg" -> Color.rgb(233, 223, 241)
    "pink_bg" -> Color.rgb(244, 220, 232)
    "red_bg" -> Color.rgb(248, 222, 221)
    else -> null
  }

  override fun getSize(paint: Paint, text: CharSequence, start: Int, end: Int, fm: Paint.FontMetricsInt?): Int {
    val h = height()
    fm?.let { it.top = -h; it.ascent = -h; it.descent = 0; it.bottom = 0 }
    return width()
  }

  override fun draw(canvas: Canvas, text: CharSequence, start: Int, end: Int, x: Float, top: Int, y: Int, bottom: Int, paint: Paint) {
    val previousColor = paint.color
    val previousStyle = paint.style
    val previousTextSize = paint.textSize
    val columns = columnCount()
    val cellWidth = width().toFloat() / columns
    val tableTop = (y - height()).toFloat()
    table.rows.forEachIndexed { rowIndex, row ->
      repeat(columns) { columnIndex ->
        val cell = row.cells.getOrNull(columnIndex)
        val color = cell?.color ?: row.color ?: table.columnColors.getOrNull(columnIndex)
        val isBackground = color?.endsWith("_bg") == true
        val fill = if (isBackground) namedColor(color) else if (table.headerRow && rowIndex == 0 || table.headerColumn && columnIndex == 0) surface else background
        paint.style = Paint.Style.FILL
        paint.color = fill ?: background
        val left = x + columnIndex * cellWidth
        val cellTop = tableTop + rowIndex * rowHeight
        canvas.drawRect(left, cellTop, left + cellWidth, cellTop + rowHeight, paint)
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = maxOf(1f, density / 2f)
        paint.color = border
        canvas.drawRect(left, cellTop, left + cellWidth, cellTop + rowHeight, paint)
        // Cell text is rendered by the overlaid native EditText for direct IME editing.
      }
    }
    paint.color = previousColor
    paint.style = previousStyle
    paint.textSize = previousTextSize
  }
}

/**
 * Draws the hint for an empty child created under a toggle heading without changing its text.
 */
private class EmptyBlockPlaceholderSpan(
  private val placeholder: String
) : ReplacementSpan() {
  override fun getSize(paint: Paint, text: CharSequence, start: Int, end: Int, fm: Paint.FontMetricsInt?): Int =
    paint.measureText(placeholder).toInt()

  override fun draw(
    canvas: Canvas,
    text: CharSequence,
    start: Int,
    end: Int,
    x: Float,
    top: Int,
    y: Int,
    bottom: Int,
    paint: Paint
  ) {
    val previousAlpha = paint.alpha
    paint.alpha = (previousAlpha * 0.45f).toInt()
    canvas.drawText(placeholder, x, y.toFloat(), paint)
    paint.alpha = previousAlpha
  }
}

/** Renders a read-only page reference with the same compact, underlined treatment as a link. */
private class PageReferenceSpan(
  private val label: String,
  private val icon: String?,
  private val fallbackIcon: String?,
  private val color: Int
) : ReplacementSpan() {
  private val displayedIcon = icon ?: fallbackIcon

  override fun getSize(paint: Paint, text: CharSequence, start: Int, end: Int, fm: Paint.FontMetricsInt?): Int {
    val gap = if (displayedIcon == null) 0f else paint.textSize * 0.3f
    return (paint.measureText(label) + (displayedIcon?.let { paint.measureText(it) } ?: 0f) + gap).toInt()
  }

  override fun draw(
    canvas: Canvas,
    text: CharSequence,
    start: Int,
    end: Int,
    x: Float,
    top: Int,
    y: Int,
    bottom: Int,
    paint: Paint
  ) {
    val previousColor = paint.color
    val previousUnderline = paint.isUnderlineText
    val previousTypeface = paint.typeface
    paint.color = color
    paint.isUnderlineText = true
    var cursor = x
    displayedIcon?.let {
      canvas.drawText(it, cursor, y.toFloat(), paint)
      cursor += paint.measureText(it) + paint.textSize * 0.3f
    }
    canvas.drawText(label, cursor, y.toFloat(), paint)
    paint.color = previousColor
    paint.isUnderlineText = previousUnderline
    paint.typeface = previousTypeface
  }
}

/** Reserves and draws the disclosure control at the start of a toggle heading. */
private class ToggleButtonSpan(
  private val buttonWidth: Int,
  private val expanded: Boolean
) : LeadingMarginSpan {
  override fun getLeadingMargin(first: Boolean): Int = buttonWidth

  override fun drawLeadingMargin(
    canvas: Canvas,
    paint: Paint,
    x: Int,
    dir: Int,
    top: Int,
    baseline: Int,
    bottom: Int,
    text: CharSequence,
    start: Int,
    end: Int,
    first: Boolean,
    layout: android.text.Layout
  ) {
    if (!first) return
    val markerStart = x.toFloat()
    val centerY = (top + bottom) / 2f
    val radius = paint.textSize * 0.30f
    val path = android.graphics.Path()
    if (expanded) {
      path.moveTo(markerStart, centerY - radius / 2f)
      path.lineTo(markerStart + radius * 2f, centerY - radius / 2f)
      path.lineTo(markerStart + radius, centerY + radius)
    } else {
      path.moveTo(markerStart, centerY - radius)
      path.lineTo(markerStart, centerY + radius)
      path.lineTo(markerStart + radius * 2f, centerY)
    }
    path.close()
    val previousStyle = paint.style
    val previousAlpha = paint.alpha
    paint.style = Paint.Style.FILL
    paint.alpha = (previousAlpha * 0.55f).toInt()
    canvas.drawPath(path, paint)
    paint.style = previousStyle
    paint.alpha = previousAlpha
  }
}

/**
 * Reserves and draws the checkbox at the start of a to-do block: an outlined rounded square when
 * unchecked, or a filled accent square with a white checkmark when checked.
 */
private class TodoCheckboxSpan(
  private val checkboxWidth: Int,
  private val checked: Boolean,
  private val accentColor: Int,
  private val borderColor: Int
) : LeadingMarginSpan {
  override fun getLeadingMargin(first: Boolean): Int = checkboxWidth

  override fun drawLeadingMargin(
    canvas: Canvas,
    paint: Paint,
    x: Int,
    dir: Int,
    top: Int,
    baseline: Int,
    bottom: Int,
    text: CharSequence,
    start: Int,
    end: Int,
    first: Boolean,
    layout: android.text.Layout
  ) {
    if (!first) return
    val left = x.toFloat()
    val size = checkboxWidth * 0.68f
    val topEdge = (top + bottom - size) / 2f
    val radius = size * 0.22f
    val previousColor = paint.color
    val previousStyle = paint.style
    val previousStrokeWidth = paint.strokeWidth
    val previousCap = paint.strokeCap
    val previousJoin = paint.strokeJoin
    if (checked) {
      paint.style = Paint.Style.FILL
      paint.color = accentColor
      canvas.drawRoundRect(left, topEdge, left + size, topEdge + size, radius, radius, paint)
      paint.style = Paint.Style.STROKE
      paint.strokeWidth = maxOf(1.5f, paint.textSize / 11f)
      paint.strokeCap = Paint.Cap.ROUND
      paint.strokeJoin = Paint.Join.ROUND
      paint.color = Color.WHITE
      val path = android.graphics.Path()
      path.moveTo(left + size * 0.24f, topEdge + size * 0.52f)
      path.lineTo(left + size * 0.43f, topEdge + size * 0.74f)
      path.lineTo(left + size * 0.78f, topEdge + size * 0.28f)
      canvas.drawPath(path, paint)
    } else {
      paint.style = Paint.Style.STROKE
      paint.strokeWidth = maxOf(1.5f, paint.textSize / 12f)
      paint.color = borderColor
      canvas.drawRoundRect(left, topEdge, left + size, topEdge + size, radius, radius, paint)
    }
    paint.color = previousColor
    paint.style = previousStyle
    paint.strokeWidth = previousStrokeWidth
    paint.strokeCap = previousCap
    paint.strokeJoin = previousJoin
  }
}

/** Reserves and draws a bullet or numbered-list marker before an editable list item. */
private class ListMarkerSpan(
  private val indent: Int,
  private val markerWidth: Int,
  private val marker: String
) : LeadingMarginSpan {
  override fun getLeadingMargin(first: Boolean): Int = indent + markerWidth

  override fun drawLeadingMargin(
    canvas: Canvas,
    paint: Paint,
    x: Int,
    dir: Int,
    top: Int,
    baseline: Int,
    bottom: Int,
    text: CharSequence,
    start: Int,
    end: Int,
    first: Boolean,
    layout: android.text.Layout
  ) {
    if (!first) return
    val markerStart = (if (dir >= 0) x + indent else x - indent - markerWidth).toFloat()
    val previousColor = paint.color
    val previousAlign = paint.textAlign
    paint.textAlign = Paint.Align.LEFT
    if (marker == "•") {
      canvas.drawCircle(
        markerStart + markerWidth * 0.42f,
        (top + bottom) / 2f,
        paint.textSize * 0.18f,
        paint
      )
    } else {
      canvas.drawText(marker, markerStart, baseline.toFloat(), paint)
    }
    paint.textAlign = previousAlign
  }
}

/**
 * A callout's rounded background box is drawn directly in [MarkdownEditorView.EditorInput.onDraw],
 * before the base [EditText] draws its text and cursor -- not as a [LineBackgroundSpan]. Android
 * runs a `LineBackgroundSpan` in the same pass that positions the text cursor, and an opaque
 * fill drawn there can end up layered over the cursor instead of under it, hiding it while the
 * caret sits inside a callout. Drawing the fill first, in our own `onDraw`, guarantees the base
 * class's text and cursor always land on top.
 */

/**
 * Reserves and draws a callout's icon at the start of its first line. Tapping it is a no-op for
 * now -- an emoji picker bottom sheet will make it interactive later.
 */
private class CalloutIconSpan(
  private val iconWidth: Int,
  private val icon: String,
  private val iconInset: Int
) : LeadingMarginSpan {
  override fun getLeadingMargin(first: Boolean): Int = iconWidth

  override fun drawLeadingMargin(
    canvas: Canvas,
    paint: Paint,
    x: Int,
    dir: Int,
    top: Int,
    baseline: Int,
    bottom: Int,
    text: CharSequence,
    start: Int,
    end: Int,
    first: Boolean,
    layout: android.text.Layout
  ) {
    if (!first) return
    val iconPaint = Paint(paint)
    iconPaint.textSize = paint.textSize * 1.3f
    val fm = iconPaint.fontMetrics
    val centerY = (top + bottom) / 2f
    val iconBaseline = centerY - (fm.ascent + fm.descent) / 2f
    canvas.drawText(icon, (x + iconInset).toFloat(), iconBaseline, iconPaint)
  }
}

/** Reserves a small left margin and paints a quote block's vertical accent bar into it, on every
 *  wrapped visual line -- simpler than [CalloutIconSpan]'s box since a thin bar can safely be
 *  drawn as a normal span without the cursor-layering concern described above. */
private class QuoteBorderSpan(
  private val marginWidth: Int,
  private val barWidth: Int,
  private val barColor: Int
) : LeadingMarginSpan {
  override fun getLeadingMargin(first: Boolean): Int = marginWidth

  override fun drawLeadingMargin(
    canvas: Canvas,
    paint: Paint,
    x: Int,
    dir: Int,
    top: Int,
    baseline: Int,
    bottom: Int,
    text: CharSequence,
    start: Int,
    end: Int,
    first: Boolean,
    layout: android.text.Layout
  ) {
    val previousColor = paint.color
    paint.color = barColor
    val barLeft = (if (dir >= 0) x else x - barWidth).toFloat()
    canvas.drawRect(barLeft, top.toFloat(), barLeft + barWidth, bottom.toFloat(), paint)
    paint.color = previousColor
  }
}

/** Hides the text of descendants while their toggle header is collapsed. */
private class CollapsedBlockSpan : ReplacementSpan() {
  override fun getSize(
    paint: Paint,
    text: CharSequence,
    start: Int,
    end: Int,
    fm: Paint.FontMetricsInt?
  ): Int {
    fm?.let {
      it.top = 0
      it.ascent = 0
      it.descent = 0
      it.bottom = 0
    }
    return 0
  }

  override fun draw(
    canvas: Canvas,
    text: CharSequence,
    start: Int,
    end: Int,
    x: Float,
    top: Int,
    y: Int,
    bottom: Int,
    paint: Paint
  ) = Unit
}

/**
 * Milestone-one coordinator: block boundaries share a single Editable and InputConnection.
 * This deliberately proves Android's continuous handles/IME path before separate mounted
 * fields, atomic spans, and heterogeneous blocks are introduced in later milestones.
 */
class MarkdownEditorView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true
  private val onEdit by EventDispatcher()
  private val onPageReferencePress by EventDispatcher()
  private val onBlockActionsPress by EventDispatcher()
  /** Fires whenever the native text layout's own content height changes (e.g. an image finishes
   *  sizing), so the RN side can size this view to its true content instead of clipping it. */
  private val onContentSize by EventDispatcher()
  private var lastReportedContentHeightPx = -1
  private var pageReferenceFallbackIcon: String? = null
  private var emptyTogglePlaceholder = DEFAULT_EMPTY_TOGGLE_PLACEHOLDER
  private var imageMaxWidth = 960
  private var epoch = -1
  private var revision = 0
  private var lastCommand = -1
  private var applying = false
  private var emissionPending = false
  private var source = "selection"
  private var dark = false
  private val blocks = mutableListOf<EditorBlock>()
  // Android may dispatch selection callbacks while the inner EditText is still being constructed.
  private var inputInitialized = false
  private val input = EditorInput(context)
  private val tableOverlay = TableOverlay(context)
  private val inputContainer = FrameLayout(context)
  private var activeTableCell: TableCellAddress? = null
  private var activeTableEditor: TableCellEditor? = null
  private var syncingTableEditor = false
  private var removed = ""
  private var editBlock = 0
  private var probeConnection: InputConnection? = null
  private var keyboardRequestPending = false
  private var keyboardShowAttempts = 0
  private val showKeyboardRunnable = Runnable { showKeyboardWhenReady() }
  private var audioPlayer: MediaPlayer? = null
  private var audioPlayerBlockId: String? = null
  private var audioPlayerPrepared = false
  private var audioPlayerPlaying = false
  private val audioProgressHandler = Handler(Looper.getMainLooper())
  private val audioProgressRunnable = object : Runnable {
    override fun run() {
      if (audioPlayerPlaying) {
        input.invalidate()
        audioProgressHandler.postDelayed(this, 50)
      }
    }
  }

  init {
    input.gravity = Gravity.TOP or Gravity.START
    input.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or
      InputType.TYPE_TEXT_FLAG_CAP_SENTENCES or InputType.TYPE_TEXT_FLAG_AUTO_CORRECT
    input.imeOptions = EditorInfo.IME_FLAG_NO_EXTRACT_UI
    input.setTextSize(16f)
    // BlockPaddingSpan measures each wrapped line before adding its own padding and wrap gap.
    input.setLineSpacing(0f, 1f)
    input.useGlyphHeightCursor()
    // Horizontal padding is uniform across every block type; vertical spacing instead comes from
    // each block's own BlockPaddingSpan (see styleBlocks), so it can vary by block type/level.
    val horizontalPadding = (8 * resources.displayMetrics.density).toInt()
    input.setPadding(horizontalPadding, 0, horizontalPadding, 0)
    input.setBackgroundColor(Color.TRANSPARENT)
    input.contentDescription = "Three-block native editor"
    inputContainer.addView(
      input,
      FrameLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    )
    tableOverlay.setWillNotDraw(true)
    tableOverlay.isClickable = false
    tableOverlay.isFocusable = false
    tableOverlay.contentDescription = "Editable table cells"
    inputContainer.addView(
      tableOverlay,
      FrameLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    )
    addView(inputContainer, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    input.addTextChangedListener(object : TextWatcher {
      override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {
        if (applying) return
        removed = s?.subSequence(start, start + count)?.toString() ?: ""
        editBlock = s?.take(start)?.count { it == '\n' } ?: 0
      }

      override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
        if (applying || blocks.isEmpty()) return
        val sourceBlock = blocks.getOrNull(editBlock)
        val continuedType = sourceBlock?.type?.takeIf {
          it == "bulleted_list_item" || it == "numbered_list_item" || it == "to_do"
        } ?: "text"
        val continuedDepth = sourceBlock?.depth ?: 0
        // Retain IDs on both sides of the edited range; split nodes get new editor IDs.
        repeat(removed.count { it == '\n' }) {
          if (editBlock + 1 < blocks.size) blocks.removeAt(editBlock + 1)
        }
        val inserted = s?.subSequence(start, start + count)?.count { it == '\n' } ?: 0
        repeat(inserted) { index ->
          blocks.add(editBlock + index + 1, EditorBlock(newId(), continuedType, "", depth = continuedDepth))
        }
        val lines = s?.toString()?.split('\n') ?: listOf("")
        lines.forEachIndexed { index, text ->
          blocks[index].text = if (blocks[index].type == "link_to_page") {
            blocks[index].text
          } else if (blocks[index].type == "divider"
            || blocks[index].type == "table_of_contents" || blocks[index].type == "column_list") {
            text
          } else if (blocks[index].type == "table") {
            ""
          } else {
            text.replace(EMPTY_BLOCK_TEXT, "")
          }
        }
        captureInlineMarks()
        scheduleEvent("text")
      }

      override fun afterTextChanged(s: Editable?) {
        if (!applying) {
          normalizeNativeText()
          styleBlocks()
        }
      }
    })
    setDark(false)
    inputInitialized = true
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (keyboardRequestPending) input.post(showKeyboardRunnable)
  }

  fun setSnapshot(value: Map<String, Any?>) {
    val nextEpoch = (value["epoch"] as? Number)?.toInt() ?: return
    // Same-epoch props are acknowledgements, never setText (especially during composition).
    if (nextEpoch <= epoch) return
    val supplied = value["blocks"] as? List<*> ?: return
    val nextBlocks = supplied.mapNotNull { item ->
      val block = item as? Map<*, *> ?: return@mapNotNull null
      val id = block["id"] as? String ?: return@mapNotNull null
      val text = block["text"] as? String ?: return@mapNotNull null
      val type = block["type"] as? String ?: return@mapNotNull null
      val color = (block["color"] as? String)?.takeIf { it in editorValidColors }
      val depth = (block["depth"] as? Number)?.toInt()?.takeIf { it >= 0 } ?: 0
      val toggle = (block["toggle"] as? Boolean) == true && type.startsWith("heading_")
      val collapsed = (block["collapsed"] as? Boolean) == true && toggle
      val checked = (block["checked"] as? Boolean) == true && type == "to_do"
      val url = block["url"] as? String
      val duration = (block["duration"] as? Number)?.toDouble()?.takeIf { it.isFinite() && it >= 0 }
      val mimeType = block["mimeType"] as? String
      val fileName = block["fileName"] as? String
      val fileSize = (block["fileSize"] as? Number)?.toDouble()?.takeIf { it.isFinite() && it >= 0 }
      val waveform = (block["waveform"] as? List<*>)?.mapNotNull { (it as? Number)?.toFloat()?.takeIf { value -> value.isFinite() } }
        ?.take(AUDIO_WAVEFORM_BAR_COUNT)?.takeIf { it.isNotEmpty() }
      val icon = block["icon"] as? String
      val marks = mutableListOf<EditorMark>()
      (block["marks"] as? List<*>)?.forEach { rawMark ->
        val mark = rawMark as? Map<*, *> ?: return@forEach
        val kind = mark["kind"] as? String ?: return@forEach
        val start = (mark["start"] as? Number)?.toInt() ?: return@forEach
        val end = (mark["end"] as? Number)?.toInt() ?: return@forEach
        val markUrl = (mark["url"] as? String)?.takeIf { kind == "link" }
        if ((kind in listOf("bold", "italic", "strikethrough", "underline", "code")
          || (kind == "link" && !markUrl.isNullOrBlank())) &&
          start >= 0 && end > start && end <= text.length) {
          marks.add(EditorMark(kind, start, end, markUrl))
        }
      }
      val columnCount = (block["columnCount"] as? Number)?.toInt()?.takeIf { it in 2..5 }
      val table = parseEditorTable(block["table"])
      if (text.contains('\n') || type !in editorValidBlockTypes
        || (type == "table" && table == null) || (type != "table" && block["table"] != null)
        || ((type == "link_to_page" || type == "image" || type == "audio" || type == "video" || type == "file") && url.isNullOrBlank())) null
      else EditorBlock(id, type, text, color, depth, toggle, collapsed, marks, checked, url, icon, columnCount, duration, mimeType, fileName, fileSize, waveform, table)
    }
    if (nextBlocks.isEmpty() || nextBlocks.size != supplied.size || nextBlocks.map { it.id }.distinct().size != nextBlocks.size) return
    applying = true
    epoch = nextEpoch
    revision = (value["revision"] as? Number)?.toInt() ?: 0
    blocks.clear()
    blocks.addAll(nextBlocks)
    releaseAudioPlayer()
    BaseInputConnection.removeComposingSpans(input.text)
    input.setText(blocks.nativeText())
    input.setSelection(0)
    styleBlocks()
    applying = false
    tableOverlay.post { tableOverlay.sync() }
    // Replacing the document invalidates the old connection's composition and surrounding text.
    if (input.hasFocus()) inputMethodManager().restartInput(input)
    scheduleEvent("replacement")
  }

  /**
   * Focus and IME connection are both asynchronous on Android. Calling showSoftInput directly
   * after requestFocus can race the focus dispatch and be ignored, leaving a visible caret with
   * no keyboard. Keep the request pending until this view owns window focus, then ask the IME on
   * a later UI turn.
   */
  private fun requestKeyboard() {
    keyboardRequestPending = true
    keyboardShowAttempts = 0
    input.requestFocus()
    input.removeCallbacks(showKeyboardRunnable)
    input.post(showKeyboardRunnable)
  }

  private fun showKeyboardWhenReady() {
    if (!keyboardRequestPending) return
    if (!isAttachedToWindow) return
    if (!hasWindowFocus()) return
    if (!input.hasFocus()) input.requestFocus()
    if (!input.hasFocus()) {
      input.postDelayed(showKeyboardRunnable, 16)
      return
    }
    val accepted = inputMethodManager().showSoftInput(input, InputMethodManager.SHOW_IMPLICIT)
    if (accepted || keyboardShowAttempts >= 10) {
      keyboardRequestPending = false
    } else {
      keyboardShowAttempts += 1
      input.postDelayed(showKeyboardRunnable, 50)
    }
  }

  override fun onWindowFocusChanged(hasWindowFocus: Boolean) {
    super.onWindowFocusChanged(hasWindowFocus)
    if (hasWindowFocus && keyboardRequestPending) input.post(showKeyboardRunnable)
  }

  override fun onDetachedFromWindow() {
    keyboardRequestPending = false
    keyboardShowAttempts = 0
    input.removeCallbacks(showKeyboardRunnable)
    releaseAudioPlayer()
    super.onDetachedFromWindow()
  }

  private fun releaseAudioPlayer() {
    audioProgressHandler.removeCallbacks(audioProgressRunnable)
    audioPlayer?.runCatching { stop() }
    audioPlayer?.release()
    audioPlayer = null
    audioPlayerBlockId = null
    audioPlayerPrepared = false
    audioPlayerPlaying = false
  }

  private fun refreshAudioBlock() {
    input.post {
      input.requestLayout()
      input.invalidate()
    }
  }

  private fun toggleAudio(block: EditorBlock) {
    val url = block.url ?: return
    if (audioPlayerBlockId == block.id && audioPlayer != null) {
      if (!audioPlayerPrepared) return
      runCatching {
        if (audioPlayerPlaying) {
          audioPlayer?.pause()
          audioPlayerPlaying = false
        } else {
          audioPlayer?.start()
          audioPlayerPlaying = true
        }
      }.onFailure {
        releaseAudioPlayer()
      }
      refreshAudioBlock()
      if (audioPlayerPlaying) audioProgressHandler.post(audioProgressRunnable)
      else audioProgressHandler.removeCallbacks(audioProgressRunnable)
      return
    }
    releaseAudioPlayer()
    val player = MediaPlayer()
    audioPlayer = player
    audioPlayerBlockId = block.id
    player.setAudioAttributes(
      AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
        .build()
    )
    player.setOnPreparedListener {
      if (audioPlayer !== it || audioPlayerBlockId != block.id) return@setOnPreparedListener
      audioPlayerPrepared = true
      runCatching {
        it.start()
        audioPlayerPlaying = true
      }.onFailure {
        releaseAudioPlayer()
      }
      refreshAudioBlock()
      if (audioPlayerPlaying) audioProgressHandler.post(audioProgressRunnable)
    }
    player.setOnCompletionListener {
      audioPlayerPlaying = false
      refreshAudioBlock()
      audioProgressHandler.removeCallbacks(audioProgressRunnable)
    }
    player.setOnErrorListener { _, _, _ ->
      releaseAudioPlayer()
      true
    }
    runCatching {
      val uri = Uri.parse(url)
      if (uri.scheme == "file" && uri.path != null) {
        player.setDataSource(uri.path!!)
      } else {
        player.setDataSource(context, uri)
      }
      player.prepareAsync()
    }.onFailure {
      releaseAudioPlayer()
    }
  }

  fun setDark(dark: Boolean) {
    this.dark = dark
    input.setTextColor(if (dark) Color.rgb(238, 238, 238) else Color.rgb(44, 44, 43))
    input.setHintTextColor(if (dark) Color.LTGRAY else Color.DKGRAY)
    if (blocks.isNotEmpty()) styleBlocks()
  }

  fun setPageReferenceFallbackIcon(value: String?) {
    pageReferenceFallbackIcon = value
    if (blocks.isNotEmpty()) styleBlocks()
  }

  fun setEmptyTogglePlaceholder(value: String?) {
    emptyTogglePlaceholder = value?.takeIf { it.isNotEmpty() } ?: DEFAULT_EMPTY_TOGGLE_PLACEHOLDER
    if (blocks.isNotEmpty()) styleBlocks()
  }

  fun setImageMaxWidth(value: Int?) {
    imageMaxWidth = value?.takeIf { it > 0 } ?: 960
    if (blocks.any { it.type == "image" || it.type == "audio" || it.type == "video" }) styleBlocks()
  }

  fun command(value: Map<String, Any?>) {
    val commandEpoch = (value["epoch"] as? Number)?.toInt() ?: return
    val id = (value["id"] as? Number)?.toInt() ?: return
    if (commandEpoch != epoch || id <= lastCommand) return
    lastCommand = id
    when (value["action"]) {
      "focus" -> {
        requestKeyboard()
      }
      "dismiss" -> {
        keyboardRequestPending = false
        keyboardShowAttempts = 0
        input.removeCallbacks(showKeyboardRunnable)
        inputMethodManager().hideSoftInputFromWindow(input.windowToken, 0)
      }
      "selectAll" -> (activeTableEditor?.takeIf { it.hasFocus() } ?: input).selectAll()
      "copy" -> copy(false)
      "cut" -> copy(true)
      "paste" -> paste()
      "split" -> if (!handleListEnter() && !handleDividerEnter()) replaceSelection("\n")
      "bulletedList" -> insertList("bulleted_list_item")
      "numberedList" -> insertList("numbered_list_item")
      "divider" -> insertDivider()
      "insertTable" -> insertTable()
      "fitTableWidth" -> tableAction(value) { table -> table.fitPageWidth = !table.fitPageWidth }
      "toggleFitTableWidth" -> tableAction(value) { table -> table.fitPageWidth = !table.fitPageWidth }
      "toggleHeaderRow" -> tableAction(value) { table -> table.headerRow = !table.headerRow }
      "toggleHeaderColumn" -> tableAction(value) { table -> table.headerColumn = !table.headerColumn }
      "insertTableRowAbove" -> tableRowAction(value, below = false, delete = false)
      "insertTableRowBelow" -> tableRowAction(value, below = true, delete = false)
      "insertTableColumnLeft" -> tableColumnAction(value, right = false, delete = false)
      "insertTableColumnRight" -> tableColumnAction(value, right = true, delete = false)
      "duplicateTableRow" -> tableRowAction(value, below = true, delete = false, duplicate = true)
      "duplicateTableColumn" -> tableColumnAction(value, right = true, delete = false, duplicate = true)
      "deleteTableRow" -> tableRowAction(value, below = false, delete = true)
      "deleteTableColumn" -> tableColumnAction(value, right = false, delete = true)
      "clearTableContents" -> clearTableAction(value)
      "clearTableRow", "clearTableColumn", "clearTableCells" -> clearTableAction(value)
      "tableColor", "rowColor", "columnColor", "cellColor" -> colorTableAction(value)
      "duplicateTable" -> duplicateBlockById(value["blockId"] as? String)
      "deleteTable" -> deleteBlockById(value["blockId"] as? String)
      "tableOfContents" -> insertTableOfContents()
      "columns" -> insertColumns((value["columnCount"] as? Number)?.toInt() ?: 2)
      "insertImage" -> insertMedia("image", value["url"] as? String)
      "insertAudio" -> insertAudio(
        value["url"] as? String,
        (value["duration"] as? Number)?.toDouble(),
        value["mimeType"] as? String,
        value["fileName"] as? String,
        (value["fileSize"] as? Number)?.toDouble(),
        audioWaveformFromValue(value["waveform"])
      )
      "insertVideo" -> insertMedia("video", value["url"] as? String)
      "insertFile" -> insertFile(
        value["url"] as? String,
        value["fileName"] as? String,
        (value["fileSize"] as? Number)?.toDouble(),
        value["mimeType"] as? String
      )
      "toDo" -> insertToDo()
      "callout" -> insertCallout()
      "quote" -> insertQuote()
      "heading" -> {
        replaceSelection("\n")
        val index = input.text.take(input.selectionStart).count { it == '\n' }
        val level = (value["level"] as? Number)?.toInt()?.coerceIn(1, 4) ?: 1
        val heading = blocks.getOrNull(index) ?: return
        heading.type = "heading_$level"
        heading.color = (value["color"] as? String)?.takeIf { it in editorValidColors }
        heading.toggle = (value["toggle"] as? Boolean) == true
        heading.collapsed = false
        if (heading.toggle) {
          val childIndex = index + 1
          val child = blocks.getOrNull(childIndex)
          if (child == null || child.text.isNotEmpty()) {
            blocks.add(childIndex, EditorBlock(newId(), "text", "", depth = heading.depth + 1))
          } else {
            child.type = "text"
            child.color = null
            child.toggle = false
            child.collapsed = false
            child.depth = heading.depth + 1
          }
          replaceNativeTextAndSelect(childIndex)
        } else {
          styleBlocks()
        }
        scheduleEvent("insert-heading")
      }
      "color" -> {
        val color = (value["color"] as? String)?.takeIf { it in editorValidColors }
        val blockId = value["blockId"] as? String
        if (blockId.isNullOrBlank()) applySelectionColor(color) else applyBlockColor(blockId, color)
      }
      "icon" -> applyBlockIcon(value["blockId"] as? String, value["icon"] as? String)
      "format" -> toggleFormat((value["mark"] as? String)?.takeIf {
        it in listOf("bold", "italic", "strikethrough", "underline", "code")
      })
      "clearFormat" -> clearFormat()
      "link" -> applyLink(
        value["url"] as? String,
        value["label"] as? String
      )
      "remove" -> removeBlocks()
      "turnInto" -> turnIntoBlocks((value["type"] as? String)?.takeIf {
        it in editorValidBlockTypes && it != "link_to_page"
      })
      "indent" -> indentBlocks()
      "outdent" -> outdentBlocks()
      "moveBlockUp" -> moveBlocks(-1)
      "moveBlockDown" -> moveBlocks(1)
      "insertAbove" -> insertBlockRelativeToId(value["blockId"] as? String, before = true)
      "insertBelow" -> insertBlockRelativeToId(value["blockId"] as? String, before = false)
      "duplicateBlock" -> duplicateBlockById(value["blockId"] as? String)
      "deleteBlock" -> deleteBlockById(value["blockId"] as? String)
      "replaceImage" -> replaceImageById(value["blockId"] as? String, value["url"] as? String)
      "replaceAudio" -> replaceAudioById(
        value["blockId"] as? String,
        value["url"] as? String,
        (value["duration"] as? Number)?.toDouble(),
        value["mimeType"] as? String,
        value["fileName"] as? String,
        (value["fileSize"] as? Number)?.toDouble(),
        audioWaveformFromValue(value["waveform"])
      )
      "softBreak" -> replaceSelection("\u2028")
      // Acceptance probe uses the actual EditText connection, not fabricated composing events.
      "compose" -> {
        input.requestFocus()
        probeConnection = input.onCreateInputConnection(EditorInfo())
        probeConnection?.setComposingText("にほん", 1)
      }
      "commit" -> {
        probeConnection?.commitText("日本", 1)
        probeConnection?.finishComposingText()
      }
      "backspace" -> {
        if (selectedBlockRange()?.any { blocks[it].type == "link_to_page" } == true) return
        val start = minOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
        val end = maxOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
        if (start != end) replaceSelection("")
        else if (start > 0 && !handleAtomicBlockBackspace()) {
          val previous = Character.offsetByCodePoints(input.text, start, -1)
          input.text.delete(previous, start)
          input.setSelection(previous)
        }
      }
    }
  }

  private fun inputMethodManager() = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
  private fun clipboard() = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
  private fun newId() = "editor:${UUID.randomUUID()}"

  private fun replaceSelection(text: String) {
    val cellEditor = activeTableEditor?.takeIf { it.hasFocus() }
    if (cellEditor != null) {
      val start = minOf(cellEditor.selectionStart, cellEditor.selectionEnd).coerceAtLeast(0)
      val end = maxOf(cellEditor.selectionStart, cellEditor.selectionEnd).coerceAtLeast(0)
      cellEditor.text.replace(start, end, text.replace('\n', ' '))
      cellEditor.setSelection((start + text.length).coerceAtMost(cellEditor.text.length))
      return
    }
    if (selectedBlockRange()?.any { blocks[it].type == "link_to_page" } == true) return
    val start = minOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    val end = maxOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    input.text.replace(start, end, text)
    input.setSelection(start + text.length)
  }

  private fun activeCellRange(): Pair<TableCellEditor, Pair<Int, Int>>? {
    val editor = activeTableEditor?.takeIf { it.hasFocus() } ?: return null
    var start = minOf(editor.selectionStart, editor.selectionEnd).coerceAtLeast(0)
    var end = maxOf(editor.selectionStart, editor.selectionEnd).coerceAtLeast(0)
    if (start == end) {
      val word = wordRangeAt(editor.text, start) ?: return null
      start = word.first
      end = word.second
    }
    return editor to (start to end)
  }

  private fun toggleCellFormat(kind: String) {
    val target = activeCellRange() ?: return
    val editor = target.first
    val range = target.second
    val cell = tableCell(editor.address) ?: return
    val remove = cell.marks.filter { it.kind == kind }.fold(range.first) { cursor, mark ->
      if (mark.start <= cursor) maxOf(cursor, mark.end) else cursor
    } >= range.second
    val next = mutableListOf<EditorMark>()
    cell.marks.forEach { mark ->
      if (mark.kind != kind || mark.end <= range.first || mark.start >= range.second) {
        next.add(mark)
      } else if (remove) {
        if (mark.start < range.first) next.add(EditorMark(mark.kind, mark.start, range.first, mark.url))
        if (mark.end > range.second) next.add(EditorMark(mark.kind, range.second, mark.end, mark.url))
      } else {
        next.add(mark)
      }
    }
    if (!remove) next.add(EditorMark(kind, range.first, range.second))
    cell.marks.clear()
    cell.marks.addAll(next.filter { it.start < it.end }
      .sortedWith(compareBy<EditorMark> { it.start }.thenBy { it.end }.thenBy { it.kind }))
    applyCellSpans(editor, cell)
    scheduleEvent("format")
  }

  private fun clearCellFormat() {
    val target = activeCellRange() ?: return
    val editor = target.first
    val range = target.second
    val cell = tableCell(editor.address) ?: return
    val next = mutableListOf<EditorMark>()
    cell.marks.forEach { mark ->
      if (mark.end <= range.first || mark.start >= range.second) {
        next.add(mark)
      } else {
        if (mark.start < range.first) next.add(EditorMark(mark.kind, mark.start, range.first, mark.url))
        if (mark.end > range.second) next.add(EditorMark(mark.kind, range.second, mark.end, mark.url))
      }
    }
    cell.marks.clear()
    cell.marks.addAll(next)
    applyCellSpans(editor, cell)
    scheduleEvent("clear-format")
  }

  private fun applyCellLink(rawUrl: String?, requestedLabel: String?) {
    val url = rawUrl?.trim()?.takeIf { it.isNotEmpty() } ?: return
    val target = activeCellRange() ?: return
    val editor = target.first
    val start = target.second.first
    val originalEnd = target.second.second
    val label = requestedLabel?.takeIf { it.isNotEmpty() }
    if (label != null && editor.text.substring(start, originalEnd) != label) {
      editor.text.replace(start, originalEnd, label)
      editor.setSelection(start, start + label.length)
    }
    val end = start + (label?.length ?: originalEnd - start)
    val cell = tableCell(editor.address) ?: return
    cell.marks.removeAll { it.kind == "link" && it.end > start && it.start < end }
    cell.marks.add(EditorMark("link", start, end, url))
    cell.marks.sortWith(compareBy<EditorMark> { it.start }.thenBy { it.end }.thenBy { it.kind })
    applyCellSpans(editor, cell)
    scheduleEvent("link")
  }

  /**
   * Toggles one inline mark over the selected text, including selections spanning blocks. When
   * the selection is collapsed (a plain cursor), widens it to the word the cursor touches -- at
   * the word's start, middle, or end -- so tapping a sub-menu button formats that word. A cursor
   * touching no word (surrounded by whitespace) is a no-op, matching the disabled button state.
   */
  private fun toggleFormat(kind: String?) {
    if (kind == null) return
    if (activeTableEditor?.hasFocus() == true) {
      toggleCellFormat(kind)
      return
    }
    val localRanges = selectedFormatRanges() ?: return
    val remove = localRanges.all { (index, range) ->
      coversMarkRange(blocks[index], kind, range.first, range.last)
    }
    localRanges.forEach { (index, range) ->
      toggleMarkRange(blocks[index], kind, range.first, range.last, remove)
    }
    styleBlocks()
    scheduleEvent("format")
  }

  /** Resolve the same word/selection target used by every inline-formatting command. */
  private fun selectedFormatRanges(): List<Pair<Int, IntRange>>? {
    var start = minOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    var end = maxOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    if (start == end) {
      val word = wordRangeAt(input.text, start) ?: return null
      start = word.first
      end = word.second
    }
    val ranges = selectedBlockRange() ?: return null
    if (ranges.any { blocks[it].type == "link_to_page" }) return null
    val localRanges = ranges.mapNotNull { index ->
      val block = blocks.getOrNull(index) ?: return@mapNotNull null
      val blockStart = offsetOf(index)
      val localStart = (start - blockStart).coerceIn(0, block.text.length)
      val localEnd = (end - blockStart).coerceIn(0, block.text.length)
      if (localStart < localEnd) index to (localStart..localEnd) else null
    }
    return localRanges.takeIf { it.isNotEmpty() }
  }

  /** Remove every inline mark from the selected text or the word touched by a collapsed cursor. */
  private fun clearFormat() {
    if (activeTableEditor?.hasFocus() == true) {
      clearCellFormat()
      return
    }
    val localRanges = selectedFormatRanges() ?: return
    localRanges.forEach { (index, range) ->
      clearMarkRange(blocks[index], range.first, range.last)
    }
    styleBlocks()
    scheduleEvent("clear-format")
  }

  /** Apply a URL to the selected text, replacing its displayed label when requested. */
  private fun applyLink(rawUrl: String?, requestedLabel: String?) {
    if (activeTableEditor?.hasFocus() == true) {
      applyCellLink(rawUrl, requestedLabel)
      return
    }
    val url = rawUrl?.trim()?.takeIf { it.isNotEmpty() } ?: return
    val bounds = linkSelectionBounds() ?: return
    val start = bounds.first
    val originalEnd = bounds.second
    val label = requestedLabel?.takeIf { it.isNotEmpty() }
    if (label != null && input.text.subSequence(start, originalEnd).toString() != label) {
      input.text.replace(start, originalEnd, label)
      input.setSelection(start, start + label.length)
    }
    val end = start + (label?.length ?: originalEnd - start)
    val ranges = blocks.indices.mapNotNull { index ->
      val blockStart = offsetOf(index)
      val localStart = (start - blockStart).coerceAtLeast(0)
      val localEnd = (end - blockStart).coerceAtMost(blocks[index].text.length)
      if (localStart < localEnd) index to (localStart..localEnd) else null
    }
    ranges.forEach { (index, range) ->
      clearMarkRange(blocks[index], range.first, range.last, "link")
      blocks[index].marks.add(EditorMark("link", range.first, range.last, url))
      blocks[index].marks.sortWith(compareBy<EditorMark> { it.start }.thenBy { it.end }.thenBy { it.kind })
    }
    styleBlocks()
    scheduleEvent("link")
  }

  /** Return the global [start, end) bounds targeted by the link action. */
  private fun linkSelectionBounds(): Pair<Int, Int>? {
    val ranges = selectedBlockRange() ?: return null
    if (ranges.any { blocks[it].type == "link_to_page" }) return null
    var start = minOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    var end = maxOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    if (start == end) {
      val word = wordRangeAt(input.text, start) ?: return null
      start = word.first
      end = word.second
    }
    return start to end
  }

  /**
   * Returns the [start, end) bounds of the word touching a collapsed cursor at [offset] within
   * [text], or null when neither neighboring character is part of a word (the cursor sits
   * between two whitespace characters, including a block-separating newline).
   */
  private fun wordRangeAt(text: CharSequence, offset: Int): Pair<Int, Int>? {
    val leftIsWord = offset > 0 && !text[offset - 1].isWhitespace()
    val rightIsWord = offset < text.length && !text[offset].isWhitespace()
    if (!leftIsWord && !rightIsWord) return null
    var start = offset
    while (start > 0 && !text[start - 1].isWhitespace()) start--
    var end = offset
    while (end < text.length && !text[end].isWhitespace()) end++
    return start to end
  }

  private fun coversMarkRange(block: EditorBlock, kind: String, start: Int, endInclusive: Int): Boolean {
    var cursor = start
    block.marks.filter { it.kind == kind && it.end > it.start }
      .sortedBy { it.start }
      .forEach { mark ->
        if (mark.start <= cursor) cursor = maxOf(cursor, mark.end)
      }
    return cursor >= endInclusive
  }

  private fun toggleMarkRange(
    block: EditorBlock,
    kind: String,
    start: Int,
    endInclusive: Int,
    remove: Boolean
  ) {
    val end = endInclusive
    val next = mutableListOf<EditorMark>()
    block.marks.forEach { mark ->
      if (mark.kind != kind || mark.end <= start || mark.start >= end) {
        next.add(mark)
      } else if (remove) {
        if (mark.start < start) next.add(EditorMark(mark.kind, mark.start, start, mark.url))
        if (mark.end > end) next.add(EditorMark(mark.kind, end, mark.end, mark.url))
      } else {
        next.add(mark)
      }
    }
    if (!remove) next.add(EditorMark(kind, start, end))
    block.marks.clear()
    next.filter { it.start < it.end }
      .sortedWith(compareBy<EditorMark> { it.start }.thenBy { it.end }.thenBy { it.kind })
      .forEach { mark ->
        val previous = block.marks.lastOrNull()
        if (previous?.kind == mark.kind && previous.end >= mark.start) {
          previous.end = maxOf(previous.end, mark.end)
        } else {
          block.marks.add(mark)
        }
      }
  }

  private fun clearMarkRange(block: EditorBlock, start: Int, end: Int, kind: String? = null) {
    val next = mutableListOf<EditorMark>()
    block.marks.forEach { mark ->
      if (mark.end <= start || mark.start >= end || (kind != null && mark.kind != kind)) {
        next.add(mark)
      } else {
        if (mark.start < start) next.add(EditorMark(mark.kind, mark.start, start, mark.url))
        if (mark.end > end) next.add(EditorMark(mark.kind, end, mark.end, mark.url))
      }
    }
    block.marks.clear()
    block.marks.addAll(
      next.filter { it.start < it.end }
        .sortedWith(compareBy<EditorMark> { it.start }.thenBy { it.end }.thenBy { it.kind })
    )
  }

  /** Insert a divider after the current cursor/selection and leave the cursor in the following text block. */
  private fun insertDivider() {
    replaceSelection("\n")
    val index = input.text.take(input.selectionStart).count { it == '\n' }
    if (index !in 0..blocks.size) return
    blocks.add(index, EditorBlock(newId(), "divider", DIVIDER_TEXT))
    replaceNativeTextAndSelect(index + 1)
    scheduleEvent("insert-divider")
  }

  /** Insert a table-of-contents block after the current cursor/selection. */
  private fun insertTableOfContents() {
    replaceSelection("\n")
    val index = input.text.take(input.selectionStart).count { it == '\n' }
    if (index !in 0..blocks.size) return
    blocks.add(index, EditorBlock(newId(), "table_of_contents", TABLE_OF_CONTENTS_TEXT))
    replaceNativeTextAndSelect(index + 1)
    scheduleEvent("insert-table-of-contents")
  }

  /** Insert a blank 3×3 table after the current selection. */
  private fun insertTable() {
    replaceSelection("\n")
    val index = input.text.take(input.selectionStart).count { it == '\n' }
    if (index !in 0..blocks.size) return
    val rows = MutableList(3) {
      EditorTableRow(MutableList(3) { EditorTableCell("") })
    }
    blocks.add(index, EditorBlock(newId(), "table", TABLE_TEXT, table = EditorTable(rows)))
    replaceNativeTextAndSelect(index + 1)
    scheduleEvent("insert-table")
  }

  private fun tableSelectionBounds(value: Map<String, Any?>): IntArray {
    val selection = value["selection"] as? Map<*, *>
    val anchor = selection?.get("anchor") as? Map<*, *>
    val focus = selection?.get("focus") as? Map<*, *>
    val anchorRow = (anchor?.get("row") as? Number)?.toInt() ?: (value["row"] as? Number)?.toInt() ?: 0
    val anchorColumn = (anchor?.get("column") as? Number)?.toInt() ?: (value["column"] as? Number)?.toInt() ?: 0
    val focusRow = (focus?.get("row") as? Number)?.toInt() ?: anchorRow
    val focusColumn = (focus?.get("column") as? Number)?.toInt() ?: anchorColumn
    return intArrayOf(minOf(anchorRow, focusRow), maxOf(anchorRow, focusRow), minOf(anchorColumn, focusColumn), maxOf(anchorColumn, focusColumn))
  }

  private fun tableAction(value: Map<String, Any?>, update: (EditorTable) -> Unit) {
    val index = blockIndexById(value["blockId"] as? String) ?: return
    val table = blocks[index].table ?: return
    update(table)
    replaceNativeTextAndSelect(index)
    scheduleEvent("table-action")
  }

  private fun tableRowAction(
    value: Map<String, Any?>,
    below: Boolean,
    delete: Boolean,
    duplicate: Boolean = false
  ) {
    tableAction(value) { table ->
      if (delete && table.rows.size <= 1) return@tableAction
      val bounds = tableSelectionBounds(value)
      val index = (value["row"] as? Number)?.toInt() ?: bounds[0]
      val safeIndex = index.coerceIn(0, table.rows.lastIndex)
      if (delete) table.rows.removeAt(safeIndex)
      else if (duplicate) {
        val source = table.rows[safeIndex]
        val copy = EditorTableRow(
          source.cells.map { cell ->
            EditorTableCell(cell.text, cell.marks.map { it.copy() }.toMutableList(), cell.color)
          }.toMutableList(),
          source.color
        )
        table.rows.add((safeIndex + 1).coerceAtMost(table.rows.size), copy)
      }
      else {
        val width = table.rows.maxOfOrNull { it.cells.size } ?: 1
        val insertAt = (safeIndex + if (below) 1 else 0).coerceIn(0, table.rows.size)
        table.rows.add(insertAt, EditorTableRow(MutableList(width) { EditorTableCell("") }))
      }
    }
  }

  private fun tableColumnAction(
    value: Map<String, Any?>,
    right: Boolean,
    delete: Boolean,
    duplicate: Boolean = false
  ) {
    tableAction(value) { table ->
      val width = table.rows.maxOfOrNull { it.cells.size } ?: 1
      if (delete && width <= 1) return@tableAction
      val bounds = tableSelectionBounds(value)
      val index = (value["column"] as? Number)?.toInt() ?: bounds[2]
      val safeIndex = index.coerceIn(0, width - 1)
      val target = (safeIndex + if (right && !delete) 1 else 0).coerceIn(0, width)
      table.rows.forEach { row ->
        if (delete) row.cells.removeAt(index.coerceIn(0, row.cells.lastIndex))
        else if (duplicate) {
          val source = row.cells[safeIndex]
          row.cells.add(
            (safeIndex + 1).coerceAtMost(row.cells.size),
            EditorTableCell(source.text, source.marks.map { it.copy() }.toMutableList(), source.color)
          )
        }
        else row.cells.add(target, EditorTableCell(""))
      }
      if (delete) {
        if (safeIndex < table.columnColors.size) table.columnColors.removeAt(safeIndex)
      } else if (duplicate) {
        table.columnColors.add(
          (safeIndex + 1).coerceAtMost(table.columnColors.size),
          table.columnColors.getOrNull(safeIndex)
        )
      } else {
        table.columnColors.add(target.coerceAtMost(table.columnColors.size), null)
      }
    }
  }

  private fun clearTableAction(value: Map<String, Any?>) {
    tableAction(value) { table ->
      val bounds = tableSelectionBounds(value)
      table.rows.forEachIndexed { rowIndex, row ->
        if (rowIndex in bounds[0]..bounds[1]) row.cells.forEachIndexed { columnIndex, cell ->
          if (columnIndex in bounds[2]..bounds[3]) {
            cell.text = ""
            cell.marks.clear()
          }
        }
      }
    }
  }

  private fun colorTableAction(value: Map<String, Any?>) {
    val color = (value["color"] as? String)?.takeIf { it in editorValidColors }
    val scope = value["action"] as? String ?: return
    tableAction(value) { table ->
      val bounds = tableSelectionBounds(value)
      when (scope) {
        "tableColor" -> table.tableColor = color
        "rowColor" -> for (row in bounds[0]..bounds[1]) table.rows.getOrNull(row)?.color = color
        "columnColor" -> for (column in bounds[2]..bounds[3]) {
          while (table.columnColors.size <= column) table.columnColors.add(null)
          table.columnColors[column] = color
        }
        "cellColor" -> for (row in bounds[0]..bounds[1]) for (column in bounds[2]..bounds[3]) {
          table.rows.getOrNull(row)?.cells?.getOrNull(column)?.color = color
        }
      }
    }
  }

  /** Insert a two-column composite block after the current cursor/selection. */
  private fun insertColumns(columnCount: Int) {
    replaceSelection("\n")
    val index = input.text.take(input.selectionStart).count { it == '\n' }
    if (index !in 0..blocks.size) return
    blocks.add(index, EditorBlock(newId(), "column_list", COLUMNS_TEXT, columnCount = columnCount.coerceIn(2, 5)))
    replaceNativeTextAndSelect(index + 1)
    scheduleEvent("insert-columns")
  }

  /** Insert a media block after the block containing the current cursor. */
  private fun insertMedia(type: String, rawUrl: String?) {
    val url = rawUrl?.trim()?.takeIf { it.isNotEmpty() } ?: return
    replaceSelection("\n")
    val index = input.text.take(input.selectionStart).count { it == '\n' }
    if (index !in 0..blocks.size) return
    blocks.add(index, EditorBlock(newId(), type, "", url = url))
    replaceNativeTextAndSelect(index + 1)
    scheduleEvent("insert-$type")
  }

  /** Insert an atomic file block after the current selection, retaining display metadata. */
  private fun insertFile(rawUrl: String?, fileName: String?, fileSize: Double?, mimeType: String?) {
    val url = rawUrl?.trim()?.takeIf { it.isNotEmpty() } ?: return
    replaceSelection("\n")
    val index = input.text.take(input.selectionStart).count { it == '\n' }
    if (index !in 0..blocks.size) return
    blocks.add(index, EditorBlock(newId(), "file", "", url = url,
      mimeType = mimeType?.takeIf { it.isNotBlank() },
      fileName = fileName?.takeIf { it.isNotBlank() },
      fileSize = fileSize?.takeIf { it.isFinite() && it >= 0 }))
    replaceNativeTextAndSelect(index + 1)
    scheduleEvent("insert-file")
  }

  /** Insert an audio block after the current selection, retaining optional asset metadata. */
  private fun insertAudio(
    rawUrl: String?,
    duration: Double?,
    mimeType: String?,
    fileName: String?,
    fileSize: Double?,
    waveform: List<Float>?
  ) {
    val url = rawUrl?.trim()?.takeIf { it.isNotEmpty() } ?: return
    replaceSelection("\n")
    val index = input.text.take(input.selectionStart).count { it == '\n' }
    if (index !in 0..blocks.size) return
    blocks.add(index, EditorBlock(newId(), "audio", "", url = url,
      duration = duration?.takeIf { it.isFinite() && it >= 0 },
      mimeType = mimeType?.takeIf { it.isNotBlank() },
      fileName = fileName?.takeIf { it.isNotBlank() },
      fileSize = fileSize?.takeIf { it.isFinite() && it >= 0 },
      waveform = waveform))
    replaceNativeTextAndSelect(index + 1)
    scheduleEvent("insert-audio")
  }

  /** Insert a list block after the current cursor/selection. */
  private fun insertList(type: String) {
    replaceSelection("\n")
    val index = input.text.take(input.selectionStart).count { it == '\n' }
    if (index !in 0..blocks.size) return
    blocks.getOrNull(index)?.let {
      it.type = type
      it.checked = false
      it.color = null
      it.toggle = false
      it.collapsed = false
      it.marks.clear()
    } ?: return
    replaceNativeTextAndSelect(index)
    scheduleEvent("insert-$type")
  }

  /** Insert an unchecked to-do block after the current cursor/selection. */
  private fun insertToDo() {
    replaceSelection("\n")
    val index = input.text.take(input.selectionStart).count { it == '\n' }
    if (index !in 0..blocks.size) return
    blocks.getOrNull(index)?.let {
      it.type = "to_do"
      it.checked = false
      it.color = null
      it.toggle = false
      it.collapsed = false
      it.marks.clear()
    } ?: return
    replaceNativeTextAndSelect(index)
    scheduleEvent("insert-to-do")
  }

  /** Convert the block at the cursor/selection into a callout with a default icon. */
  private fun insertCallout() {
    replaceSelection("\n")
    val index = input.text.take(input.selectionStart).count { it == '\n' }
    if (index !in 0..blocks.size) return
    blocks.getOrNull(index)?.let {
      it.type = "callout"
      it.icon = it.icon ?: DEFAULT_CALLOUT_ICON
      it.checked = false
      it.color = null
      it.toggle = false
      it.collapsed = false
      it.marks.clear()
    } ?: return
    replaceNativeTextAndSelect(index)
    scheduleEvent("insert-callout")
  }

  /** Convert the block at the cursor/selection into a quote. */
  private fun insertQuote() {
    replaceSelection("\n")
    val index = input.text.take(input.selectionStart).count { it == '\n' }
    if (index !in 0..blocks.size) return
    blocks.getOrNull(index)?.let {
      it.type = "quote"
      it.checked = false
      it.color = null
      it.toggle = false
      it.collapsed = false
      it.marks.clear()
    } ?: return
    replaceNativeTextAndSelect(index)
    scheduleEvent("insert-quote")
  }

  /** Convert an exact text-block `---` shortcut into a divider and a following empty text block. */
  private fun createDividerFromShortcut(): Boolean {
    if (input.selectionStart != input.selectionEnd) return false
    val cursor = input.selectionStart.coerceAtLeast(0)
    val index = input.text.take(cursor).count { it == '\n' }
    val block = blocks.getOrNull(index) ?: return false
    val blockStart = offsetOf(index)
    if (block.type != "text" || block.text != "---" || cursor != blockStart + block.text.length) {
      return false
    }

    block.type = "divider"
    block.text = DIVIDER_TEXT
    block.color = null
    block.toggle = false
    block.collapsed = false
    blocks.add(index + 1, EditorBlock(newId(), "text", ""))
    replaceNativeTextAndSelect(index + 1)
    scheduleEvent("shortcut-divider")
    return true
  }

  /**
   * Reload the shared native text buffer after a structural operation and place the cursor at
   * [offset] within block [index] -- defaulting to that block's own start.
   */
  private fun replaceNativeTextAndSelect(index: Int, offset: Int = 0) {
    applying = true
    BaseInputConnection.removeComposingSpans(input.text)
    input.setText(blocks.nativeText())
    applying = false
    val clampedIndex = index.coerceIn(0, blocks.lastIndex)
    val clampedOffset = offset.coerceIn(0, blocks[clampedIndex].text.length)
    input.setSelection(offsetOf(clampedIndex) + clampedOffset)
    styleBlocks()
  }

  /** Handle Enter at the end of a list item before the native buffer inserts a newline. */
  private fun handleListEnter(): Boolean {
    if (input.selectionStart != input.selectionEnd || blocks.isEmpty()) return false
    val (index, offset) = logicalSelectionPoint(input.selectionStart)
    val block = blocks[index]
    if (block.type != "bulleted_list_item" && block.type != "numbered_list_item" && block.type != "to_do") {
      return false
    }
    if (offset != block.text.length) return false

    val next = blocks.getOrNull(index + 1)
    if (next?.type == block.type && next.depth == block.depth) {
      blocks.removeAt(index)
      blocks.add(index, EditorBlock(newId(), "text", "", depth = block.depth))
      blocks.add(index + 1, EditorBlock(newId(), "text", "", depth = block.depth))
      replaceNativeTextAndSelect(index)
      scheduleEvent("list-break")
      return true
    }

    if (block.text.isEmpty()) {
      block.type = "text"
      block.checked = false
      styleBlocks()
      scheduleEvent("list-exit")
      return true
    }
    return false
  }

  /**
   * Handle Enter at the end of a block immediately followed by a divider: the new block is
   * inserted after the divider instead of between the current block and it, so the divider stays
   * attached to the content above it rather than sliding down ahead of the split-off block.
   */
  private fun handleDividerEnter(): Boolean {
    if (input.selectionStart != input.selectionEnd || blocks.isEmpty()) return false
    val (index, offset) = logicalSelectionPoint(input.selectionStart)
    val block = blocks[index]
    if (offset != block.text.length) return false
    val next = blocks.getOrNull(index + 1) ?: return false
    if (next.type != "divider") return false

    val continuedType = if (block.type == "bulleted_list_item" || block.type == "numbered_list_item"
      || block.type == "to_do") block.type else "text"
    blocks.add(index + 2, EditorBlock(newId(), continuedType, "", depth = block.depth))
    replaceNativeTextAndSelect(index + 2)
    scheduleEvent("divider-split")
    return true
  }

  /**
   * Handle Backspace at the start of a block immediately preceded by an atomic block -- a
   * divider, image, or video, none of which carry navigable text of their own. The atomic block
   * is skipped over -- as though it weren't there -- merging this block into the block before it
   * instead, and the atomic block is left in place immediately after the merged result. Without
   * this, the default merge would otherwise remove the atomic block from the document and, for
   * an image or video, stuff the removed block's text into its own `text` field -- a field that
   * type of block doesn't use (its content lives in `url`), corrupting it for no visible reason.
   */
  private fun handleAtomicBlockBackspace(): Boolean {
    if (input.selectionStart != input.selectionEnd || blocks.isEmpty()) return false
    val (index, offset) = logicalSelectionPoint(input.selectionStart)
    if (offset != 0) return false
    val atomicIndex = index - 1
    val atomic = blocks.getOrNull(atomicIndex) ?: return false
    if (atomic.type !in editorAtomicBlockTypes) return false
    val beforeIndex = atomicIndex - 1
    val before = blocks.getOrNull(beforeIndex) ?: return false
    val current = blocks[index]
    if (before.type !in editorMergeableBlockTypes || current.type !in editorMergeableBlockTypes) return false

    val joinOffset = before.text.length
    before.marks.addAll(current.marks.map { EditorMark(it.kind, it.start + joinOffset, it.end + joinOffset, it.url) })
    before.text += current.text
    blocks.removeAt(index)
    blocks.removeAt(atomicIndex)
    blocks.add(atomicIndex, atomic)
    replaceNativeTextAndSelect(beforeIndex, joinOffset)
    scheduleEvent("atomic-block-backspace")
    return true
  }

  /** Resolve a block's index by id, e.g. for actions-sheet commands that target a tapped block
   *  which may never have received the text cursor (a divider). */
  private fun blockIndexById(id: String?): Int? {
    if (id.isNullOrEmpty()) return null
    return blocks.indexOfFirst { it.id == id }.takeIf { it >= 0 }
  }

  /** Insert an empty text block immediately above or below the identified block. */
  private fun insertBlockRelativeToId(id: String?, before: Boolean) {
    val index = blockIndexById(id) ?: return
    val target = blocks[index]
    val insertAt = if (before) index else index + 1
    blocks.add(insertAt, EditorBlock(newId(), "text", "", depth = target.depth))
    replaceNativeTextAndSelect(insertAt)
    scheduleEvent(if (before) "insert-block-above" else "insert-block-below")
  }

  /** Insert a copy of the identified block immediately after it. */
  private fun duplicateBlockById(id: String?) {
    val index = blockIndexById(id) ?: return
    val source = blocks[index]
    val copiedTable = source.table?.let { table ->
      EditorTable(
        table.rows.map { row ->
          EditorTableRow(row.cells.map { cell ->
            EditorTableCell(cell.text, cell.marks.map { it.copy() }.toMutableList(), cell.color)
          }.toMutableList(), row.color)
        }.toMutableList(),
        table.columnColors.toMutableList(),
        table.tableColor,
        table.fitPageWidth,
        table.headerRow,
        table.headerColumn
      )
    }
    val copy = source.copy(id = newId(), marks = source.marks.map { it.copy() }.toMutableList(), table = copiedTable)
    blocks.add(index + 1, copy)
    replaceNativeTextAndSelect(index + 1, copy.text.length)
    scheduleEvent("duplicate-block")
  }

  /** Remove the identified block, matching `removeBlocks()`'s never-empty-document guarantee. */
  private fun deleteBlockById(id: String?) {
    val index = blockIndexById(id) ?: return
    if (blocks[index].type == "audio" && audioPlayerBlockId == blocks[index].id) releaseAudioPlayer()
    blocks.removeAt(index)
    if (blocks.isEmpty()) blocks.add(EditorBlock(newId(), "text", ""))
    replaceNativeTextAndSelect(index.coerceAtMost(blocks.lastIndex))
    scheduleEvent("delete-block")
  }

  /** Swap an image block's source in place -- the block keeps its id and document position. */
  private fun replaceImageById(id: String?, rawUrl: String?) {
    val url = rawUrl?.trim()?.takeIf { it.isNotEmpty() } ?: return
    val index = blockIndexById(id) ?: return
    if (blocks[index].type != "image") return
    blocks[index].url = url
    styleBlocks()
    invalidate()
    scheduleEvent("replace-image")
  }

  /** Swap an audio source in place while preserving its block id and position. */
  private fun replaceAudioById(
    id: String?,
    rawUrl: String?,
    duration: Double?,
    mimeType: String?,
    fileName: String?,
    fileSize: Double?,
    waveform: List<Float>?
  ) {
    val url = rawUrl?.trim()?.takeIf { it.isNotEmpty() } ?: return
    val index = blockIndexById(id) ?: return
    val block = blocks[index]
    if (block.type != "audio") return
    if (audioPlayerBlockId == block.id) releaseAudioPlayer()
    block.url = url
    block.duration = duration?.takeIf { it.isFinite() && it >= 0 }
    block.mimeType = mimeType?.takeIf { it.isNotBlank() }
    block.fileName = fileName?.takeIf { it.isNotBlank() }
    block.fileSize = fileSize?.takeIf { it.isFinite() && it >= 0 }
    block.waveform = waveform
    styleBlocks()
    invalidate()
    scheduleEvent("replace-audio")
  }

  private fun logicalSelectionPoint(position: Int): Pair<Int, Int> {
    val safePosition = position.coerceIn(0, input.text.length)
    val blockIndex = input.text.take(safePosition).count { it == '\n' }.coerceIn(0, blocks.lastIndex)
    val lineStart = input.text.lastIndexOf('\n', safePosition - 1).let { if (it < 0) 0 else it + 1 }
    return blockIndex to (safePosition - lineStart).coerceIn(0, blocks[blockIndex].text.length)
  }

  /** Restores the hidden marker after an edit removes it from an empty text block. */
  private fun normalizeNativeText() {
    val desired = blocks.nativeText()
    if (input.text.toString() == desired) return

    val startPoint = logicalSelectionPoint(input.selectionStart)
    val endPoint = logicalSelectionPoint(input.selectionEnd)
    applying = true
    BaseInputConnection.removeComposingSpans(input.text)
    input.setText(desired)
    applying = false
    val startOffset = offsetOf(startPoint.first) + startPoint.second
    val endOffset = offsetOf(endPoint.first) + endPoint.second
    input.setSelection(startOffset, endOffset)
  }

  private fun copy(cut: Boolean): Boolean {
    val cellEditor = activeTableEditor?.takeIf { it.hasFocus() }
    if (cellEditor != null) {
      val start = minOf(cellEditor.selectionStart, cellEditor.selectionEnd).coerceAtLeast(0)
      val end = maxOf(cellEditor.selectionStart, cellEditor.selectionEnd).coerceAtLeast(0)
      if (start == end) return true
      val selected = cellEditor.text.subSequence(start, end).toString()
      clipboard().setPrimaryClip(ClipData.newPlainText("Markdown table cell", selected))
      if (cut) {
        cellEditor.text.delete(start, end)
        cellEditor.setSelection(start)
      }
      scheduleEvent(if (cut) "table-cut" else "table-copy")
      return true
    }
    val start = minOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    val end = maxOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    if (start == end) return true
    val fragment = JSONArray()
    var offset = 0
    blocks.forEach { block ->
      val blockEnd = offset + block.nativeText().length
      if (offset <= end && blockEnd >= start) {
        val textStart = (start - offset).coerceIn(0, block.text.length)
        val textEnd = (end - offset).coerceIn(0, block.text.length)
        val item = JSONObject().put("type", block.type).put("text", block.text.substring(
          textStart, textEnd))
        block.color?.let { item.put("color", it) }
        val marks = JSONArray()
        block.marks.forEach { mark ->
          val markStart = maxOf(mark.start, textStart)
          val markEnd = minOf(mark.end, textEnd)
          if (markStart < markEnd) {
            marks.put(JSONObject()
              .put("kind", mark.kind)
              .put("start", markStart - textStart)
              .put("end", markEnd - textStart)
              .apply { mark.url?.let { put("url", it) } })
          }
        }
        if (marks.length() > 0) item.put("marks", marks)
        if (block.type == "to_do") item.put("checked", block.checked)
        if (block.type == "column_list") item.put("columnCount", (block.columnCount ?: 2).coerceIn(2, 5))
        if (block.type == "link_to_page" || block.type == "image" || block.type == "audio" || block.type == "video" || block.type == "file") {
          block.url?.let { item.put("url", it) }
        }
        if (block.type == "audio" || block.type == "file") {
          block.duration?.let { item.put("duration", it) }
          block.mimeType?.let { item.put("mimeType", it) }
          block.fileName?.let { item.put("fileName", it) }
          block.fileSize?.let { item.put("fileSize", it) }
        }
        if (block.type == "audio") {
          block.waveform?.let { item.put("waveform", JSONArray(it)) }
        }
        if (block.type == "link_to_page" || block.type == "callout") {
          block.icon?.let { item.put("icon", it) }
        }
        fragment.put(item)
      }
      offset = blockEnd + 1
    }
    val json = JSONObject().put("version", 1).put("blocks", fragment).toString()
    val intent = Intent().putExtra(FRAGMENT_MIME, json)
    val plain = input.text.subSequence(start, end).toString()
      .replace(EMPTY_BLOCK_TEXT, "")
      .replace('\u2028', '\n')
    // A single item exposes interoperable text plus private structured data, not two pasted items.
    clipboard().setPrimaryClip(ClipData(ClipDescription("Markdown document fragment", arrayOf("text/plain", FRAGMENT_MIME)),
      ClipData.Item(plain, null, intent, null)))
    if (cut) replaceSelection("")
    scheduleEvent(if (cut) "structured-cut" else "structured-copy")
    return true
  }

  private fun paste(): Boolean {
    val cellEditor = activeTableEditor?.takeIf { it.hasFocus() }
    if (cellEditor != null) {
      val clip = clipboard().primaryClip ?: return true
      if (clip.itemCount == 0) return true
      val pasted = clip.getItemAt(0).coerceToText(context).toString().replace('\r', ' ').replace('\n', ' ')
      val start = minOf(cellEditor.selectionStart, cellEditor.selectionEnd).coerceAtLeast(0)
      val end = maxOf(cellEditor.selectionStart, cellEditor.selectionEnd).coerceAtLeast(0)
      cellEditor.text.replace(start, end, pasted)
      cellEditor.setSelection(start + pasted.length)
      scheduleEvent("table-paste")
      return true
    }
    val clip = clipboard().primaryClip ?: return true
    if (clip.itemCount == 0) return true
    val item = clip.getItemAt(0)
    val json = item.intent?.getStringExtra(FRAGMENT_MIME)
    if (json != null && json.length <= 1_000_000 && clip.description.hasMimeType(FRAGMENT_MIME)) {
      try {
        val fragment = JSONObject(json)
        val data = fragment.getJSONArray("blocks")
        require(fragment.getInt("version") == 1 && data.length() in 1..10000)
        val parts = (0 until data.length()).map { index ->
          val block = data.getJSONObject(index)
          val type = block.getString("type")
          val text = block.getString("text")
          require(type in editorValidBlockTypes && !text.contains('\n'))
          val color = if (block.has("color")) block.getString("color").takeIf { it in editorValidColors } else null
          val url = if (block.has("url")) block.getString("url") else null
          val duration = if (block.has("duration")) block.getDouble("duration") else null
          val mimeType = if (block.has("mimeType")) block.getString("mimeType") else null
          val fileName = if (block.has("fileName")) block.getString("fileName") else null
          val fileSize = if (block.has("fileSize")) block.getDouble("fileSize") else null
          val waveform = if (block.has("waveform")) {
            (0 until block.getJSONArray("waveform").length()).mapNotNull { index ->
              block.getJSONArray("waveform").optDouble(index).toFloat().takeIf { it.isFinite() }
            }.map { it.coerceIn(0f, 1f) }.take(AUDIO_WAVEFORM_BAR_COUNT).takeIf { it.isNotEmpty() }
          } else null
          val icon = if (block.has("icon")) block.getString("icon") else null
          val columnCount = if (block.has("columnCount")) block.getInt("columnCount") else null
          require(columnCount?.let { type == "column_list" && it in 2..5 } ?: true)
          require((type != "link_to_page" && type != "image" && type != "audio" && type != "video") || !url.isNullOrBlank())
          require(type != "audio" || (duration == null || duration.isFinite() && duration >= 0)
            && (fileSize == null || fileSize.isFinite() && fileSize >= 0))
          val marks = mutableListOf<EditorMark>()
          block.optJSONArray("marks")?.let { markData ->
            for (markIndex in 0 until markData.length()) {
              val mark = markData.getJSONObject(markIndex)
              val kind = mark.getString("kind")
              val markStart = mark.getInt("start")
              val markEnd = mark.getInt("end")
              val markUrl = if (mark.has("url")) mark.getString("url") else null
              require(kind in listOf("bold", "italic", "strikethrough", "underline", "code")
                || (kind == "link" && !markUrl.isNullOrBlank()))
              require(markStart >= 0 && markEnd > markStart && markEnd <= text.length)
              marks.add(EditorMark(kind, markStart, markEnd, markUrl))
            }
          }
          EditorPasteBlock(
            type,
            text,
            color,
            marks,
            block.optBoolean("checked", false) && type == "to_do",
            url,
            icon,
            columnCount,
            duration,
            mimeType,
            fileName,
            fileSize,
            waveform
          )
        }
        val start = minOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
        val firstBlock = input.text.take(start).count { it == '\n' }
        val startsAtBoundary = pointAt(start)["offset"] == 0
        replaceSelection(parts.joinToString("\n") { it.text })
        parts.forEachIndexed { index, part ->
          if (index > 0 || startsAtBoundary) {
            blocks[firstBlock + index].type = part.type
            blocks[firstBlock + index].color = part.color
            blocks[firstBlock + index].checked = part.checked
            blocks[firstBlock + index].url = part.url
            blocks[firstBlock + index].icon = part.icon
            blocks[firstBlock + index].columnCount = part.columnCount
            blocks[firstBlock + index].duration = part.duration
            blocks[firstBlock + index].mimeType = part.mimeType
            blocks[firstBlock + index].fileName = part.fileName
            blocks[firstBlock + index].fileSize = part.fileSize
            blocks[firstBlock + index].waveform = part.waveform
            blocks[firstBlock + index].marks.clear()
            blocks[firstBlock + index].marks.addAll(part.marks)
          }
        }
        styleBlocks()
        scheduleEvent("structured-paste")
        return true
      } catch (_: Exception) {
        // Untrusted/malformed private data falls back to the interoperable plain item.
      }
    }
    replaceSelection(item.coerceToText(context).toString().replace("\r\n", "\n").replace('\r', '\n'))
    scheduleEvent("plain-paste")
    return true
  }

  /** Returns the block range touched by the cursor or selection. */
  private fun selectedBlockRange(): IntRange? {
    if (blocks.isEmpty()) return null
    val selStart = minOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    val selEnd = maxOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    val lowIndex = input.text.take(selStart).count { it == '\n' }
    val highIndex = input.text.take(selEnd).count { it == '\n' }
    if (lowIndex !in blocks.indices || highIndex !in blocks.indices) return null
    return lowIndex..highIndex
  }

  /** Removes the block containing the cursor or all blocks touched by the selection. */
  private fun removeBlocks() {
    val range = selectedBlockRange() ?: return
    val firstRemoved = range.first
    blocks.subList(range.first, range.last + 1).clear()
    if (blocks.isEmpty()) {
      blocks.add(EditorBlock(newId(), "text", ""))
    }

    val nextIndex = firstRemoved.coerceAtMost(blocks.lastIndex)
    applying = true
    BaseInputConnection.removeComposingSpans(input.text)
    input.setText(blocks.nativeText())
    applying = false
    val selectionOffset = offsetOf(nextIndex)
    input.setSelection(selectionOffset)
    styleBlocks()
    scheduleEvent("remove-block")
  }

  /** Converts every block touched by the cursor or selection independently to the requested type. */
  private fun turnIntoBlocks(type: String?) {
    if (type == null) return
    val range = selectedBlockRange() ?: return
    // The turn-into MAB replaces the IME while it is open. Restore it after the transform.
    requestKeyboard()
    var changed = false
    range.forEach { index ->
      if (blocks[index].type != type) {
        blocks[index].type = type
        if (!type.startsWith("heading_")) blocks[index].toggle = false
        if (type != "to_do") blocks[index].checked = false
        if (type != "link_to_page") {
          blocks[index].url = null
          blocks[index].icon = null
        }
        changed = true
      }
    }
    if (!changed) return
    styleBlocks()
    scheduleEvent("turn-into")
  }

  private fun indentBlocks() {
    val range = selectedBlockRange() ?: return
    if (range.first == 0) return
    range.forEach { index -> blocks[index].depth += 1 }
    styleBlocks()
    scheduleEvent("indent-block")
  }

  private fun outdentBlocks() {
    val range = selectedBlockRange() ?: return
    var changed = false
    range.forEach { index ->
      if (blocks[index].depth > 0) {
        blocks[index].depth -= 1
        changed = true
      }
    }
    if (!changed) return
    styleBlocks()
    scheduleEvent("outdent-block")
  }

  private fun moveBlocks(direction: Int) {
    if (blocks.size < 2) return
    val selStart = minOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    val selEnd = maxOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    val lowIndex = input.text.take(selStart).count { it == '\n' }
    val highIndex = input.text.take(selEnd).count { it == '\n' }
    val swapIndex = if (direction < 0) lowIndex - 1 else highIndex + 1
    if (swapIndex < 0 || swapIndex >= blocks.size) return

    val moving = blocks.removeAt(swapIndex)
    blocks.add(if (direction < 0) highIndex else lowIndex, moving)

    applying = true
    BaseInputConnection.removeComposingSpans(input.text)
    input.setText(blocks.nativeText())
    applying = false

    val newLow = lowIndex + direction
    val newHigh = highIndex + direction
    input.setSelection(offsetOf(newLow), offsetOf(newHigh) + blocks[newHigh].nativeText().length)
    styleBlocks()
    scheduleEvent("move-block")
  }

  /** Applies a foreground/background color to every colorable block touched by the selection. */
  private fun applySelectionColor(color: String?) {
    if (blocks.isEmpty()) return
    val selStart = minOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    val selEnd = maxOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    val lowIndex = input.text.take(selStart).count { it == '\n' }
    val highIndex = input.text.take(selEnd).count { it == '\n' }
    var changed = false
    for (index in lowIndex..highIndex) {
      val block = blocks.getOrNull(index) ?: continue
      if (block.type == "divider" || block.type == "table_of_contents" || block.type == "column_list"
        || block.type == "link_to_page"
        || block.type !in editorValidBlockTypes || block.color == color) continue
      block.color = color
      changed = true
    }
    if (!changed) return
    styleBlocks()
    scheduleEvent("color")
  }

  /** Apply a color to one block, used by block-level action sheets whose opening gesture may not
   * leave a reliable text selection behind. */
  private fun applyBlockColor(id: String, color: String?) {
    val block = blocks.firstOrNull { it.id == id } ?: return
    if (block.type == "divider" || block.type == "table_of_contents" || block.type == "column_list"
      || block.type == "link_to_page" || block.type !in editorValidBlockTypes || block.color == color) return
    block.color = color
    styleBlocks()
    scheduleEvent("color")
  }

  /** Apply an emoji icon to one callout, used by the callout emoji picker. */
  private fun applyBlockIcon(id: String?, icon: String?) {
    val block = blocks.firstOrNull { it.id == id } ?: return
    val nextIcon = icon?.trim()?.takeIf { it.isNotEmpty() } ?: return
    if (block.type != "callout" || block.icon == nextIcon) return
    block.icon = nextIcon
    styleBlocks()
    invalidate()
    scheduleEvent("icon")
  }

  private fun offsetOf(index: Int): Int {
    var offset = 0
    for (i in 0 until index) offset += blocks[i].nativeText().length + 1
    return offset
  }

  private fun pointAt(position: Int): Map<String, Any> {
    val cellEditor = activeTableEditor?.takeIf { it.hasFocus() }
    val cellAddress = activeTableCell
    if (cellEditor != null && cellAddress != null && tableCell(cellAddress) != null) {
      return mapOf(
        "blockId" to blocks[cellAddress.blockIndex].id,
        "field" to "cell",
        "row" to cellAddress.row,
        "column" to cellAddress.column,
        "offset" to cellEditor.selectionStart.coerceAtLeast(0)
      )
    }
    var remaining = position.coerceAtLeast(0)
    blocks.forEach { block ->
      if (remaining <= block.nativeText().length) {
        return mapOf("blockId" to block.id, "field" to "rich_text", "offset" to remaining.coerceAtMost(block.text.length))
      }
      remaining -= block.nativeText().length + 1
    }
    val last = blocks.last()
    return mapOf("blockId" to last.id, "field" to "rich_text", "offset" to last.text.length)
  }

  /**
   * Report the text layout's true content height to RN, in dp, when it changes. `shouldUseAndroidLayout`
   * keeps this view's own Yoga-assigned box fixed regardless of content (see [ExpoView]'s docs),
   * so without this, content taller than that box (e.g. a tall image) is simply clipped -- nothing
   * ever tells the RN side, or a wrapping ScrollView, how tall the document actually wants to be.
   */
  private fun reportContentSize() {
    val heightPx = input.layout?.height ?: return
    if (heightPx == lastReportedContentHeightPx) return
    lastReportedContentHeightPx = heightPx
    val heightDp = ceil(heightPx / resources.displayMetrics.density).toInt()
    onContentSize(mapOf("height" to heightDp))
  }

  private fun shouldShowEmptyTodoPlaceholder(index: Int, block: EditorBlock): Boolean {
    if (input.selectionStart != input.selectionEnd || block.type != "to_do" || block.text.isNotEmpty()) {
      return false
    }
    val cursor = input.selectionStart.coerceIn(0, input.text.length)
    return input.text.take(cursor).count { it == '\n' } == index
  }

  private fun styleBlocks() {
    val editable = input.text
    editable.getSpans(0, editable.length, RelativeSizeSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, StyleSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, LeadingMarginSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, BlockPaddingSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, DividerSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, EditorImageSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, EditorVideoSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, EditorFileSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, TableOfContentsSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, ColumnsSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, TableSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, EmptyBlockPlaceholderSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, PageReferenceSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, TodoCheckboxSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, ListMarkerSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, CollapsedBlockSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, ForegroundColorSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, BackgroundColorSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, InlineCodeSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, UnderlineSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, StrikethroughSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, TypefaceSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, EditorInlineMarkSpan::class.java).forEach { editable.removeSpan(it) }
    var start = 0
    var collapsedDepth: Int? = null
    var numberedListNumber = 0
    blocks.forEachIndexed { index, block ->
      val end = start + block.nativeText().length
      numberedListNumber = if (block.type == "numbered_list_item") {
        val previous = blocks.getOrNull(index - 1)
        if (previous?.type == "numbered_list_item" && previous.depth == block.depth) {
          numberedListNumber + 1
        } else {
          1
        }
      } else {
        0
      }
      if (collapsedDepth != null && block.depth <= collapsedDepth!!) collapsedDepth = null
      val collapsed = collapsedDepth != null
      if (collapsed && block.text.isNotEmpty()) {
        editable.setSpan(CollapsedBlockSpan(), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
      }
      val previous = blocks.getOrNull(index - 1)
      if (!collapsed && block.text.isEmpty() && block.type == "text" &&
        previous?.toggle == true && editorHeadingLevel(previous.type) != null &&
        block.depth == previous.depth + 1 && emptyTogglePlaceholder.isNotEmpty()) {
        editable.setSpan(
          EmptyBlockPlaceholderSpan(emptyTogglePlaceholder),
          start,
          end,
          Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
        )
      }
      if (shouldShowEmptyTodoPlaceholder(index, block)) {
        editable.setSpan(
          EmptyBlockPlaceholderSpan(DEFAULT_EMPTY_TODO_PLACEHOLDER),
          start,
          end,
          Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
        )
      }
      if (block.nativeText().isNotEmpty()) {
        // Adjacent items of the same list type collapse their shared edge to 4px, keeping the
        // full 8px only where the list starts/ends (a different block type, or a list boundary).
        val isListItem = block.type == "bulleted_list_item" || block.type == "numbered_list_item"
        val next = blocks.getOrNull(index + 1)
        val blockPaddingTop = when {
          block.type == "callout" -> CALLOUT_BLOCK_PADDING_DP
          editorHeadingLevel(block.type) == 1 -> 32
          editorHeadingLevel(block.type) == 2 -> 28
          editorHeadingLevel(block.type) == 3 -> 24
          editorHeadingLevel(block.type) == 4 -> 20
          isListItem && previous?.type == block.type -> 4
          else -> 8
        }
        val blockPaddingBottom = if (block.type == "callout") CALLOUT_BLOCK_PADDING_DP
        else if (isListItem && next?.type == block.type) 4 else 8
        editable.setSpan(
          BlockPaddingSpan(
            (blockPaddingTop * resources.displayMetrics.density).toInt(),
            (blockPaddingBottom * resources.displayMetrics.density).toInt(),
            start,
            end
          ),
          start,
          end,
          Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
        )
        if (block.type == "divider") {
          val inset = (4 * resources.displayMetrics.density).toInt()
          editable.setSpan(
            DividerSpan(inset, input.paddingRight + inset),
            start,
            end,
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
          )
        }
          if (block.type == "table") {
            block.table?.let { editable.setSpan(TableSpan(input, it, dark), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE) }
          } else if (block.type == "table_of_contents") {
          editable.setSpan(TableOfContentsSpan(), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
        if (block.type == "column_list") {
          editable.setSpan(ColumnsSpan(block.columnCount ?: 2), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
        if (block.type == "link_to_page") {
          editable.setSpan(
            PageReferenceSpan(block.text, block.icon, pageReferenceFallbackIcon, input.currentTextColor),
            start,
            end,
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
          )
        }
        if (block.type == "callout") {
          // The callout's background box is painted in EditorInput.onDraw, not as a span here --
          // see the comment above CalloutIconSpan's declaration for why.
          editable.setSpan(
            CalloutIconSpan(
              ((CALLOUT_OUTER_PADDING_DP + CALLOUT_SURFACE_PADDING_DP + CALLOUT_ICON_WIDTH_DP
                + CALLOUT_ICON_GAP_DP)
                * resources.displayMetrics.density).toInt().coerceAtLeast(1),
              block.icon ?: DEFAULT_CALLOUT_ICON,
              ((CALLOUT_OUTER_PADDING_DP + CALLOUT_SURFACE_PADDING_DP)
                * resources.displayMetrics.density).toInt().coerceAtLeast(1)
            ),
            start,
            end,
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
          )
        }
        if (block.type == "quote") {
          val barColor = block.color?.let { editorTextColors[it] } ?: editorQuoteBarColor(dark)
          editable.setSpan(
            QuoteBorderSpan(
              (QUOTE_TEXT_INDENT_DP * resources.displayMetrics.density).toInt().coerceAtLeast(1),
              (QUOTE_BAR_WIDTH_DP * resources.displayMetrics.density).toInt().coerceAtLeast(1),
              barColor
            ),
            start,
            end,
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
          )
        }
        if (block.type == "image") {
          block.url?.let { url ->
            editable.setSpan(
              EditorImageSpan(input, url, imageMaxWidth),
              start,
              end,
              Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
            )
          }
        }
        if (block.type == "video") {
          block.url?.let { url ->
            editable.setSpan(
              EditorVideoSpan(input, url, imageMaxWidth),
              start,
              end,
              Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
            )
          }
        }
        if (block.type == "audio") {
          block.url?.let {
            editable.setSpan(
              EditorAudioSpan(input, block.fileName ?: "Audio", block.duration, audioWaveform(block), dark, {
                if (audioPlayerBlockId == block.id) {
                  runCatching { (audioPlayer?.currentPosition ?: 0) / 1000.0 }.getOrDefault(0.0)
                } else 0.0
              }, {
                audioPlayerBlockId == block.id && audioPlayerPlaying
              }),
              start,
              end,
              Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
            )
          }
        }
        if (block.type == "file") {
          editable.setSpan(
            EditorFileSpan(input, block.fileName, block.fileSize, dark),
            start,
            end,
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
          )
        }
        if (block.type == "to_do") {
          editable.setSpan(
            TodoCheckboxSpan(
              (input.textSize * TODO_CHECKBOX_WIDTH_SCALE).toInt().coerceAtLeast(1),
              block.checked,
              editorAccentColor(dark),
              editorCheckboxBorderColor(dark)
            ),
            start,
            end,
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
          )
        }
        if (block.toggle && editorHeadingLevel(block.type) != null) {
          editable.setSpan(
            ToggleButtonSpan(
              (input.textSize * TOGGLE_BUTTON_WIDTH_SCALE).toInt().coerceAtLeast(1),
              !block.collapsed
            ),
            start,
            end,
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
          )
        }
        if (block.type == "bulleted_list_item" || block.type == "numbered_list_item") {
          val indent = (block.depth * 32 * resources.displayMetrics.density).toInt()
          val markerWidth = (input.textSize * LIST_MARKER_WIDTH_SCALE).toInt().coerceAtLeast(1)
          val marker = if (block.type == "bulleted_list_item") "•" else numberedListNumber.toString()
          editable.setSpan(
            ListMarkerSpan(indent, markerWidth, marker),
            start,
            end,
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
          )
        } else if (block.depth > 0) {
          val margin = (block.depth * 32 * resources.displayMetrics.density).toInt()
          editable.setSpan(LeadingMarginSpan.Standard(margin), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
        editorHeadingLevel(block.type)?.let { level ->
          editable.setSpan(RelativeSizeSpan(headingScale.getValue(level)), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
          editable.setSpan(StyleSpan(Typeface.BOLD), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
        block.color?.let { color ->
          // A callout's `_bg` color instead tints the box EditorInput.onDraw paints for it.
          if (block.type != "callout") {
            editorBackgroundColors[color]?.let { editable.setSpan(BackgroundColorSpan(it), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE) }
          }
          editorTextColors[color]?.let { editable.setSpan(ForegroundColorSpan(it), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE) }
        }
        block.marks.forEach { mark ->
          val markStart = (start + mark.start).coerceIn(start, end)
          val markEnd = (start + mark.end).coerceIn(markStart, end)
          if (markStart >= markEnd) return@forEach
          editable.setSpan(EditorInlineMarkSpan(mark.kind, mark.url), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
          when (mark.kind) {
            "bold" -> editable.setSpan(StyleSpan(Typeface.BOLD), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            "italic" -> editable.setSpan(StyleSpan(Typeface.ITALIC), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            "underline" -> editable.setSpan(UnderlineSpan(), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            "strikethrough" -> editable.setSpan(StrikethroughSpan(), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            "link" -> {
              editable.setSpan(ForegroundColorSpan(editorAccentColor(dark)), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
              editable.setSpan(UnderlineSpan(), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
            "code" -> {
              editable.setSpan(TypefaceSpan("monospace"), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
              editable.setSpan(ForegroundColorSpan(INLINE_CODE_FOREGROUND), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
              editable.setSpan(inlineCodeSpan(context), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
          }
        }
        if (block.type == "to_do" && block.checked) {
          editable.setSpan(ForegroundColorSpan(editorMutedColor(dark)), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
          editable.setSpan(StrikethroughSpan(), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
      }
      if (block.toggle && block.collapsed) collapsedDepth = block.depth
      start = end + 1
    }
    tableOverlay.sync()
    input.post { reportContentSize() }
  }

  /** Copies Android-adjusted inline marker ranges back into the block transport model. */
  private fun captureInlineMarks() {
    blocks.forEach { it.marks.clear() }
    val editable = input.text
    editable.getSpans(0, editable.length, EditorInlineMarkSpan::class.java).forEach { span ->
      val globalStart = editable.getSpanStart(span)
      val globalEnd = editable.getSpanEnd(span)
      if (globalStart < 0 || globalEnd <= globalStart) return@forEach
      val blockIndex = editable.subSequence(0, globalStart).count { it == '\n' }
      val block = blocks.getOrNull(blockIndex) ?: return@forEach
      val blockStart = if (blockIndex == 0) 0 else editable.subSequence(0, globalStart)
        .toString().lastIndexOf('\n') + 1
      val localStart = (globalStart - blockStart).coerceIn(0, block.text.length)
      val localEnd = (globalEnd - blockStart).coerceIn(localStart, block.text.length)
      if (localStart < localEnd) block.marks.add(EditorMark(span.kind, localStart, localEnd, span.url))
    }
    blocks.forEach { block ->
      block.marks.sortWith(compareBy<EditorMark> { it.start }.thenBy { it.end }.thenBy { it.kind })
    }
  }

  private fun scheduleEvent(reason: String) {
    if (applying || epoch < 0 || blocks.isEmpty()) return
    if (reason != "selection" || !emissionPending) source = reason
    if (emissionPending) return
    emissionPending = true
    val scheduledEpoch = epoch
    post {
      emissionPending = false
      if (epoch != scheduledEpoch) {
        scheduleEvent("replacement")
        return@post
      }
      revision += 1
      val tablePoints = tableOverlay.eventPoints()
      onEdit(mapOf(
        "epoch" to epoch, "revision" to revision, "blocks" to blocks.map { it.payload() },
        "anchor" to (tablePoints?.first ?: pointAt(input.selectionStart)),
        "focus" to (tablePoints?.second ?: pointAt(input.selectionEnd)),
        "composingStart" to (activeTableEditor?.let { BaseInputConnection.getComposingSpanStart(it.text) }
          ?: BaseInputConnection.getComposingSpanStart(input.text)),
        "composingEnd" to (activeTableEditor?.let { BaseInputConnection.getComposingSpanEnd(it.text) }
          ?: BaseInputConnection.getComposingSpanEnd(input.text)), "source" to source
      ))
    }
  }

  private fun tableCell(address: TableCellAddress): EditorTableCell? =
    blocks.getOrNull(address.blockIndex)?.table?.rows?.getOrNull(address.row)?.cells?.getOrNull(address.column)

  private fun tableRowHeightPx(): Int =
    (TABLE_CELL_HEIGHT_DP * resources.displayMetrics.density).roundToInt().coerceAtLeast(1)

  private fun tableHeightPx(table: EditorTable): Int =
    table.rows.size * tableRowHeightPx() + resources.displayMetrics.density.roundToInt().coerceAtLeast(1)

  private fun tableColorValue(value: String?): Int? = when (value) {
    "gray" -> editorTextColors["gray"]
    "brown" -> editorTextColors["brown"]
    "orange" -> editorTextColors["orange"]
    "yellow" -> editorTextColors["yellow"]
    "green" -> editorTextColors["green"]
    "blue" -> editorTextColors["blue"]
    "purple" -> editorTextColors["purple"]
    "pink" -> editorTextColors["pink"]
    "red" -> editorTextColors["red"]
    else -> null
  }

  private fun tableCellTextColor(address: TableCellAddress): Int {
    val block = blocks.getOrNull(address.blockIndex)
    val table = block?.table
    val cell = tableCell(address)
    val color = cell?.color ?: table?.rows?.getOrNull(address.row)?.color
      ?: table?.columnColors?.getOrNull(address.column) ?: table?.tableColor
    return if (color?.endsWith("_bg") == true) {
      if (dark) Color.WHITE else Color.rgb(44, 44, 43)
    } else {
      tableColorValue(color) ?: if (dark) Color.WHITE else Color.rgb(44, 44, 43)
    }
  }

  private fun updateCellMarksAfterEdit(
    cell: EditorTableCell,
    start: Int,
    before: Int,
    after: Int,
    newLength: Int
  ) {
    val delta = after - before
    val editEnd = start + before
    cell.marks.removeAll { mark ->
      when {
        mark.end <= start -> false
        mark.start >= editEnd -> {
          mark.start += delta
          mark.end += delta
          false
        }
        else -> {
          mark.end = (mark.end + delta).coerceAtMost(newLength).coerceAtLeast(mark.start + 1)
          mark.start >= newLength || mark.end <= mark.start
        }
      }
    }
  }

  private fun applyCellSpans(editor: TableCellEditor, cell: EditorTableCell) {
    val value = android.text.SpannableStringBuilder(cell.text)
    val fullEnd = value.length
    if (fullEnd > 0 && blocks.getOrNull(editor.address.blockIndex)?.table?.let { table ->
        table.headerRow && editor.address.row == 0 || table.headerColumn && editor.address.column == 0
      } == true) {
      value.setSpan(StyleSpan(Typeface.BOLD), 0, fullEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    }
    cell.marks.forEach { mark ->
      val start = mark.start.coerceIn(0, fullEnd)
      val end = mark.end.coerceIn(start, fullEnd)
      if (start >= end) return@forEach
      when (mark.kind) {
        "bold" -> value.setSpan(StyleSpan(Typeface.BOLD), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        "italic" -> value.setSpan(StyleSpan(Typeface.ITALIC), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        "underline" -> value.setSpan(UnderlineSpan(), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        "strikethrough" -> value.setSpan(StrikethroughSpan(), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        "code" -> value.setSpan(TypefaceSpan("monospace"), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        "link" -> {
          value.setSpan(ForegroundColorSpan(editorAccentColor(dark)), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
          value.setSpan(UnderlineSpan(), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
      }
    }
    syncingTableEditor = true
    val selectionStart = editor.selectionStart.coerceAtLeast(0)
    val selectionEnd = editor.selectionEnd.coerceAtLeast(0)
    editor.setText(value, android.widget.TextView.BufferType.SPANNABLE)
    editor.setSelection(selectionStart.coerceAtMost(value.length), selectionEnd.coerceAtMost(value.length))
    syncingTableEditor = false
  }

  private inner class TableCellEditor(
    context: Context,
    val address: TableCellAddress
  ) : EditText(context) {
    private var editStart = 0
    private var editBefore = 0
    private var rangeDrag = false
    private var downX = 0f
    private var downY = 0f
    private var downTime = 0L

    init {
      setSingleLine(true)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
      gravity = Gravity.CENTER_VERTICAL or Gravity.START
      includeFontPadding = true
      val horizontal = (TABLE_CELL_HORIZONTAL_PADDING_DP * resources.displayMetrics.density).roundToInt()
      val vertical = (TABLE_CELL_VERTICAL_PADDING_DP * resources.displayMetrics.density).roundToInt()
      setPadding(horizontal, vertical, horizontal, vertical)
      inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES or
        InputType.TYPE_TEXT_FLAG_AUTO_CORRECT
      contentDescription = "Table cell row ${address.row + 1}, column ${address.column + 1}"
      setSelectAllOnFocus(false)
      setOnLongClickListener {
        val block = blocks.getOrNull(address.blockIndex)
        if (block != null) {
          val selection = tableOverlay.selectionPayload(address)
          val anchor = selection["anchor"] as? Map<*, *>
          val focus = selection["focus"] as? Map<*, *>
          val singleCell = anchor?.get("row") == focus?.get("row")
            && anchor?.get("column") == focus?.get("column")
          onBlockActionsPress(mapOf(
            "id" to block.id,
            "type" to block.type,
            "scope" to if (singleCell) "cell" else "cells",
            "selection" to selection
          ))
        }
        true
      }
      addTextChangedListener(object : TextWatcher {
        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {
          editStart = start
          editBefore = count
        }

        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit

        override fun afterTextChanged(s: Editable?) {
          if (syncingTableEditor) return
          val cell = tableCell(address) ?: return
          val nextText = s?.toString()?.replace('\n', ' ') ?: ""
          val oldLength = cell.text.length
          updateCellMarksAfterEdit(
            cell,
            editStart,
            editBefore,
            nextText.length - oldLength + editBefore,
            nextText.length
          )
          cell.text = nextText
          scheduleEvent("table-text")
          invalidate()
        }
      })
    }

    fun syncFromModel() {
      val cell = tableCell(address) ?: return
      applyCellSpans(this, cell)
      setTextColor(tableCellTextColor(address))
      val selected = tableOverlay.isCellInRange(address)
      val stroke = if (hasFocus() || selected) editorAccentColor(dark) else Color.TRANSPARENT
      background = GradientDrawable().apply {
        setColor(Color.TRANSPARENT)
        setStroke(
          (if (hasFocus() || selected) 2 else 1)
            * resources.displayMetrics.density.roundToInt().coerceAtLeast(1),
          stroke
        )
      }
    }

    override fun onFocusChanged(focused: Boolean, direction: Int, previouslyFocusedRect: android.graphics.Rect?) {
      super.onFocusChanged(focused, direction, previouslyFocusedRect)
      if (focused) {
        if (!tableOverlay.isCellInRange(address)) tableOverlay.clearRange()
        activeTableCell = address
        activeTableEditor = this
        post { inputMethodManager().showSoftInput(this, InputMethodManager.SHOW_IMPLICIT) }
        scheduleEvent("selection")
      } else if (activeTableEditor === this) {
        activeTableEditor = null
        activeTableCell = null
      }
      tableOverlay.refreshChrome()
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          rangeDrag = false
          downX = event.x
          downY = event.y
          downTime = event.eventTime
        }
        MotionEvent.ACTION_MOVE -> {
          val density = resources.displayMetrics.density
          val edge = 14 * density
          val fromEdge = downX <= edge || downX >= width - edge || downY <= edge || downY >= height - edge
          val moved = hypot((event.x - downX).toDouble(), (event.y - downY).toDouble())
          if (!rangeDrag && fromEdge && event.eventTime - downTime >= 300
            && moved >= ViewConfiguration.get(context).scaledTouchSlop) {
            rangeDrag = true
            tableOverlay.beginRange(address)
            parent?.requestDisallowInterceptTouchEvent(true)
          }
          if (rangeDrag) tableOverlay.updateRangeFrom(this, event.x, event.y)
        }
        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
          if (rangeDrag) {
            tableOverlay.updateRangeFrom(this, event.x, event.y)
            parent?.requestDisallowInterceptTouchEvent(false)
            rangeDrag = false
            scheduleEvent("selection")
            return true
          }
        }
      }
      return super.onTouchEvent(event)
    }

    override fun onSelectionChanged(start: Int, end: Int) {
      super.onSelectionChanged(start, end)
      if (hasFocus() && inputInitialized) scheduleEvent("selection")
    }
  }

  private inner class TableOverlay(context: Context) : FrameLayout(context) {
    private val editors = mutableListOf<TableCellEditor>()
    private val widthToggles = mutableListOf<TableWidthToggle>()
    private val actionButtons = mutableListOf<TableActionsButton>()
    private val rowThumbs = mutableListOf<TableSelectionThumb>()
    private val columnThumbs = mutableListOf<TableSelectionThumb>()
    private val startHandle = TableSelectionHandle(context, true)
    private val endHandle = TableSelectionHandle(context, false)
    private var rangeAnchor: TableCellAddress? = null
    private var rangeFocus: TableCellAddress? = null

    private inner class TableSelectionHandle(
      context: Context,
      val anchorHandle: Boolean
    ) : View(context) {
      private var dragging = false

      init {
        val size = (12 * resources.displayMetrics.density).roundToInt().coerceAtLeast(1)
        minimumWidth = size
        minimumHeight = size
        contentDescription = if (anchorHandle) "Table selection start" else "Table selection end"
        background = GradientDrawable().apply {
          shape = GradientDrawable.OVAL
          setColor(editorAccentColor(dark))
        }
        setOnTouchListener { view, event ->
          when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
              dragging = true
              view.parent?.requestDisallowInterceptTouchEvent(true)
              true
            }
            MotionEvent.ACTION_MOVE -> {
              if (dragging) updateHandleRange(this, event.x, event.y)
              true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
              if (dragging) {
                updateHandleRange(this, event.x, event.y)
                view.parent?.requestDisallowInterceptTouchEvent(false)
                scheduleEvent("selection")
              }
              dragging = false
              true
            }
            else -> true
          }
        }
      }
    }

    private inner class TableWidthToggle(
      context: Context,
      val blockIndex: Int
    ) : View(context) {
      private val density = resources.displayMetrics.density
      private val trackWidth = (54 * density).roundToInt()
      private val trackHeight = (34 * density).roundToInt()
      private val thumbSize = (30 * density).roundToInt()
      private val thumbTravel = (20 * density).roundToInt()

      init {
        contentDescription = "Fit table to page width"
        isClickable = true
      }

      fun trackWidthForLayout(): Int = trackWidth
      fun trackHeightForLayout(): Int = trackHeight

      override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        setMeasuredDimension(trackWidth, trackHeight)
      }

      override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val fit = blocks.getOrNull(blockIndex)?.table?.fitPageWidth == true
        val track = Paint(Paint.ANTI_ALIAS_FLAG).apply {
          color = if (fit) editorAccentColor(dark) else if (dark) Color.rgb(91, 91, 89) else Color.rgb(208, 208, 204)
          style = Paint.Style.FILL
        }
        val radius = trackHeight / 2f
        canvas.drawRoundRect(0f, 0f, trackWidth.toFloat(), trackHeight.toFloat(), radius, radius, track)
        val thumb = Paint(Paint.ANTI_ALIAS_FLAG).apply {
          color = Color.WHITE
          style = Paint.Style.FILL
            setShadowLayer(1.5f * density, 0f, density, 0x4A000000)
        }
        setLayerType(LAYER_TYPE_SOFTWARE, thumb)
        val left = 2f * density + if (fit) thumbTravel.toFloat() else 0f
        canvas.drawCircle(left + thumbSize / 2f, trackHeight / 2f, thumbSize / 2f, thumb)
      }

      override fun onTouchEvent(event: MotionEvent): Boolean {
        if (event.actionMasked != MotionEvent.ACTION_UP) return true
        val block = blocks.getOrNull(blockIndex) ?: return true
        block.table?.fitPageWidth = !(block.table?.fitPageWidth ?: false)
        replaceNativeTextAndSelect(blockIndex)
        performClick()
        return true
      }

      override fun performClick(): Boolean {
        super.performClick()
        return true
      }
    }

    private inner class TableActionsButton(
      context: Context,
      val blockIndex: Int
    ) : View(context) {
      private val density = resources.displayMetrics.density
      private val size = (34 * density).roundToInt()

      init {
        contentDescription = "Table actions"
        isClickable = true
      }

      fun sizeForLayout(): Int = size

      override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        setMeasuredDimension(size, size)
      }

      override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
          color = if (dark) Color.rgb(245, 245, 245) else Color.rgb(55, 53, 47)
          style = Paint.Style.FILL
        }
        val center = size / 2f
        val dot = (2 * density).coerceAtLeast(1f)
        canvas.drawCircle(center - 6 * density, center, dot, paint)
        canvas.drawCircle(center, center, dot, paint)
        canvas.drawCircle(center + 6 * density, center, dot, paint)
      }

      override fun onTouchEvent(event: MotionEvent): Boolean {
        if (event.actionMasked != MotionEvent.ACTION_UP) return true
        val block = blocks.getOrNull(blockIndex) ?: return true
        onBlockActionsPress(mapOf("id" to block.id, "type" to block.type, "scope" to "table"))
        performClick()
        return true
      }

      override fun performClick(): Boolean {
        super.performClick()
        return true
      }
    }

    private inner class TableSelectionThumb(
      context: Context,
      val blockIndex: Int,
      val row: Int?,
      val column: Int?
    ) : View(context) {
      private val density = resources.displayMetrics.density
      private val size = (18 * density).roundToInt()

      init {
        contentDescription = if (row != null) "Select table row" else "Select table column"
        isClickable = true
        background = GradientDrawable().apply {
          shape = GradientDrawable.OVAL
          setColor(editorAccentColor(dark))
        }
      }

      fun sizeForLayout(): Int = size

      override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        setMeasuredDimension(size, size)
      }

      override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
          color = Color.WHITE
          strokeWidth = density
          style = Paint.Style.STROKE
        }
        if (row != null) {
          canvas.drawLine(5 * density, size / 2f, size - 5 * density, size / 2f, paint)
          canvas.drawLine(size / 2f, 5 * density, size / 2f, size - 5 * density, paint)
        } else {
          canvas.drawLine(5 * density, size / 2f, size - 5 * density, size / 2f, paint)
          canvas.drawLine(size / 2f, 5 * density, size / 2f, size - 5 * density, paint)
        }
      }

      override fun onTouchEvent(event: MotionEvent): Boolean {
        if (event.actionMasked != MotionEvent.ACTION_UP) return true
        val block = blocks.getOrNull(blockIndex)?.takeIf { it.type == "table" }
        val table = block?.table ?: return true
        val width = table.rows.maxOfOrNull { it.cells.size }?.coerceAtLeast(1) ?: 1
        val active = rangeAnchor ?: activeTableCell
        if (row != null) {
          selectRow(blockIndex, (active?.row ?: 0).coerceIn(0, table.rows.lastIndex), width)
        } else if (column != null) {
          selectColumn(blockIndex, (active?.column ?: 0).coerceIn(0, width - 1), table.rows.size)
        }
        performClick()
        return true
      }

      override fun performClick(): Boolean {
        super.performClick()
        return true
      }
    }

    private fun selectRow(blockIndex: Int, row: Int, width: Int) {
      rangeAnchor = TableCellAddress(blockIndex, row, 0)
      rangeFocus = TableCellAddress(blockIndex, row, width - 1)
      refreshChrome()
      val block = blocks.getOrNull(blockIndex) ?: return
      onBlockActionsPress(mapOf(
        "id" to block.id,
        "type" to block.type,
        "scope" to "row",
        "selection" to selectionPayload(TableCellAddress(blockIndex, row, 0))
      ))
    }

    private fun selectColumn(blockIndex: Int, column: Int, height: Int) {
      rangeAnchor = TableCellAddress(blockIndex, 0, column)
      rangeFocus = TableCellAddress(blockIndex, height - 1, column)
      refreshChrome()
      val block = blocks.getOrNull(blockIndex) ?: return
      onBlockActionsPress(mapOf(
        "id" to block.id,
        "type" to block.type,
        "scope" to "column",
        "selection" to selectionPayload(TableCellAddress(blockIndex, 0, column))
      ))
    }

    fun clearRange() {
      if (rangeAnchor == null && rangeFocus == null) return
      rangeAnchor = null
      rangeFocus = null
      refreshChrome()
    }

    fun beginRange(address: TableCellAddress) {
      rangeAnchor = address
      rangeFocus = address
      refreshChrome()
    }

    fun isCellInRange(address: TableCellAddress): Boolean {
      val anchor = rangeAnchor ?: return false
      val focus = rangeFocus ?: return false
      if (anchor.blockIndex != address.blockIndex || focus.blockIndex != address.blockIndex) return false
      return address.row in minOf(anchor.row, focus.row)..maxOf(anchor.row, focus.row)
        && address.column in minOf(anchor.column, focus.column)..maxOf(anchor.column, focus.column)
    }

    fun selectionPayload(fallback: TableCellAddress): Map<String, Any> {
      val anchor = rangeAnchor ?: fallback
      val focus = rangeFocus ?: fallback
      return mapOf(
        "anchor" to mapOf("row" to anchor.row, "column" to anchor.column),
        "focus" to mapOf("row" to focus.row, "column" to focus.column)
      )
    }

    fun eventPoints(): Pair<Map<String, Any>, Map<String, Any>>? {
      val anchor = rangeAnchor ?: return null
      val focus = rangeFocus ?: return null
      val block = blocks.getOrNull(anchor.blockIndex) ?: return null
      if (focus.blockIndex != anchor.blockIndex) return null
      val focusEditor = editors.firstOrNull { it.address == focus }
      return mapOf(
        "blockId" to block.id,
        "field" to "cell",
        "row" to anchor.row,
        "column" to anchor.column,
        "offset" to 0
      ) to mapOf(
        "blockId" to block.id,
        "field" to "cell",
        "row" to focus.row,
        "column" to focus.column,
        "offset" to (focusEditor?.selectionStart?.coerceAtLeast(0) ?: 0)
      )
    }

    fun updateRangeFrom(editor: TableCellEditor, x: Float, y: Float) {
      val targetX = editor.left + x
      val targetY = editor.top + y
      val target = editors.firstOrNull { candidate ->
        candidate.address.blockIndex == editor.address.blockIndex
          && targetX >= candidate.left && targetX < candidate.right
          && targetY >= candidate.top && targetY < candidate.bottom
      } ?: return
      if (target.address != rangeFocus) {
        rangeFocus = target.address
        refreshChrome()
      }
    }

    private fun updateHandleRange(handle: TableSelectionHandle, x: Float, y: Float) {
      val targetX = handle.left + x
      val targetY = handle.top + y
      val target = editors.firstOrNull { candidate ->
        targetX >= candidate.left && targetX < candidate.right
          && targetY >= candidate.top && targetY < candidate.bottom
      } ?: return
      if (handle.anchorHandle) rangeAnchor = target.address else rangeFocus = target.address
      refreshChrome()
    }

    fun sync() {
      val restore = activeTableCell
      removeAllViews()
      editors.clear()
      widthToggles.clear()
      actionButtons.clear()
      rowThumbs.clear()
      columnThumbs.clear()
      blocks.forEachIndexed { blockIndex, block ->
        if (block.type != "table") return@forEachIndexed
        val widthToggle = TableWidthToggle(context, blockIndex)
        val actionButton = TableActionsButton(context, blockIndex)
        val rowThumb = TableSelectionThumb(context, blockIndex, 0, null)
        val columnThumb = TableSelectionThumb(context, blockIndex, null, 0)
        widthToggles.add(widthToggle)
        actionButtons.add(actionButton)
        rowThumbs.add(rowThumb)
        columnThumbs.add(columnThumb)
        block.table?.rows?.forEachIndexed { row, tableRow ->
          tableRow.cells.forEachIndexed { column, _ ->
            val editor = TableCellEditor(context, TableCellAddress(blockIndex, row, column))
            editor.syncFromModel()
            editors.add(editor)
            addView(editor, LayoutParams(0, 0))
          }
        }
        addView(widthToggle, LayoutParams(0, 0))
        addView(actionButton, LayoutParams(0, 0))
        addView(rowThumb, LayoutParams(0, 0))
        addView(columnThumb, LayoutParams(0, 0))
      }
      addView(startHandle, LayoutParams(0, 0))
      addView(endHandle, LayoutParams(0, 0))
      updateHandleVisibility()
      post {
        requestLayout()
        restore?.let { address ->
          editors.firstOrNull { it.address == address }?.let { editor ->
            activeTableCell = address
            activeTableEditor = editor
            editor.requestFocus()
            editor.setSelection(editor.text.length)
          }
        }
      }
    }

    private fun updateHandleVisibility() {
      val visible = rangeAnchor != null && rangeFocus != null
      startHandle.visibility = if (visible) View.VISIBLE else View.GONE
      endHandle.visibility = if (visible) View.VISIBLE else View.GONE
      val active = rangeAnchor ?: activeTableCell
      widthToggles.forEachIndexed { index, view ->
        view.visibility = if (active?.blockIndex == view.blockIndex) View.VISIBLE else View.GONE
      }
      actionButtons.forEachIndexed { index, view ->
        view.visibility = if (active?.blockIndex == view.blockIndex) View.VISIBLE else View.GONE
      }
      rowThumbs.forEach { view ->
        view.visibility = if (active?.blockIndex == view.blockIndex) View.VISIBLE else View.GONE
      }
      columnThumbs.forEach { view ->
        view.visibility = if (active?.blockIndex == view.blockIndex) View.VISIBLE else View.GONE
      }
    }

    fun refreshChrome() {
      editors.forEach { it.syncFromModel() }
      updateHandleVisibility()
      requestLayout()
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
      super.onMeasure(widthMeasureSpec, heightMeasureSpec)
      val rowHeight = tableRowHeightPx()
      editors.forEach { editor ->
        val table = blocks.getOrNull(editor.address.blockIndex)?.table
        val columnCount = table?.rows?.maxOfOrNull { it.cells.size }?.coerceAtLeast(1) ?: 1
        val cellWidth = table?.let {
          (tableDisplayWidthPx(input, it) / columnCount.toFloat()).roundToInt().coerceAtLeast(1)
        } ?: 1
        editor.measure(
          MeasureSpec.makeMeasureSpec(cellWidth, MeasureSpec.EXACTLY),
          MeasureSpec.makeMeasureSpec(rowHeight, MeasureSpec.EXACTLY)
        )
      }
      widthToggles.forEach { toggle ->
        toggle.measure(
          MeasureSpec.makeMeasureSpec(toggle.trackWidthForLayout(), MeasureSpec.EXACTLY),
          MeasureSpec.makeMeasureSpec(toggle.trackHeightForLayout(), MeasureSpec.EXACTLY)
        )
      }
      actionButtons.forEach { button ->
        button.measure(MeasureSpec.makeMeasureSpec(button.sizeForLayout(), MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(button.sizeForLayout(), MeasureSpec.EXACTLY))
      }
      rowThumbs.forEach { thumb ->
        thumb.measure(MeasureSpec.makeMeasureSpec(thumb.sizeForLayout(), MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(thumb.sizeForLayout(), MeasureSpec.EXACTLY))
      }
      columnThumbs.forEach { thumb ->
        thumb.measure(MeasureSpec.makeMeasureSpec(thumb.sizeForLayout(), MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(thumb.sizeForLayout(), MeasureSpec.EXACTLY))
      }
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
      super.onLayout(changed, left, top, right, bottom)
      val textLayout = input.layout ?: return
      val rowHeight = tableRowHeightPx()
      editors.forEach { editor ->
        val address = editor.address
        val table = blocks.getOrNull(address.blockIndex)?.table ?: return@forEach
        val width = maxOf(1, table.rows.maxOfOrNull { it.cells.size } ?: 1)
        val line = textLayout.getLineForOffset(offsetOf(address.blockIndex))
        val tableTop = textLayout.getLineBaseline(line) - tableHeightPx(table)
        val tableWidth = tableDisplayWidthPx(input, table)
        val cellWidth = tableWidth / width.toFloat()
        val cellLeft = input.left + input.paddingLeft + (address.column * cellWidth).roundToInt()
        val cellRight = input.left + input.paddingLeft + ((address.column + 1) * cellWidth).roundToInt()
        val cellTop = input.top + tableTop + address.row * rowHeight
        editor.layout(cellLeft, cellTop, cellRight.coerceAtLeast(cellLeft + 1), cellTop + rowHeight)
      }
      val handleSize = (12 * resources.displayMetrics.density).roundToInt().coerceAtLeast(1)
      fun layoutHandle(handle: TableSelectionHandle, address: TableCellAddress?) {
        val editor = address?.let { selected -> editors.firstOrNull { it.address == selected } }
        if (editor == null || handle.visibility != View.VISIBLE) return
        val centerX = if (handle === startHandle) editor.left else editor.right
        val centerY = if (handle === startHandle) editor.top else editor.bottom
        handle.layout(
          centerX - handleSize / 2,
          centerY - handleSize / 2,
          centerX - handleSize / 2 + handleSize,
          centerY - handleSize / 2 + handleSize
        )
      }
      layoutHandle(startHandle, rangeAnchor)
      layoutHandle(endHandle, rangeFocus)

      val chromeSize = (34 * resources.displayMetrics.density).roundToInt().coerceAtLeast(1)
      val thumbSize = (18 * resources.displayMetrics.density).roundToInt().coerceAtLeast(1)
      blocks.forEachIndexed { blockIndex, block ->
        val table = block.table ?: return@forEachIndexed
        if (block.type != "table") return@forEachIndexed
        val line = textLayout.getLineForOffset(offsetOf(blockIndex))
        val tableTop = textLayout.getLineBaseline(line) - tableHeightPx(table)
        val tableLeft = input.left + input.paddingLeft
        val tableRight = tableLeft + tableDisplayWidthPx(input, table)
        val toggle = widthToggles.firstOrNull { it.blockIndex == blockIndex }
        val actions = actionButtons.firstOrNull { it.blockIndex == blockIndex }
        if (toggle != null && toggle.visibility == View.VISIBLE && actions != null) {
          val actionsLeft = tableRight - chromeSize
          val toggleLeft = actionsLeft - toggle.measuredWidth
          toggle.layout(toggleLeft, tableTop + 4 * resources.displayMetrics.density.roundToInt(), actionsLeft, tableTop + 4 * resources.displayMetrics.density.roundToInt() + toggle.measuredHeight)
          actions.layout(actionsLeft, tableTop + 4 * resources.displayMetrics.density.roundToInt(), tableRight, tableTop + 4 * resources.displayMetrics.density.roundToInt() + actions.measuredHeight)
        }
        val active = rangeAnchor ?: activeTableCell
        if (active?.blockIndex == blockIndex) {
          val row = active.row.coerceIn(0, table.rows.lastIndex)
          val column = active.column.coerceIn(0, (table.rows.maxOfOrNull { it.cells.size } ?: 1) - 1)
          val cellWidth = tableDisplayWidthPx(input, table) / (table.rows.maxOfOrNull { it.cells.size } ?: 1).toFloat()
          val rowThumb = rowThumbs.firstOrNull { it.blockIndex == blockIndex }
          val columnThumb = columnThumbs.firstOrNull { it.blockIndex == blockIndex }
          rowThumb?.layout(
            tableLeft - thumbSize / 2,
            tableTop + row * rowHeight + rowHeight / 2 - thumbSize / 2,
            tableLeft - thumbSize / 2 + thumbSize,
            tableTop + row * rowHeight + rowHeight / 2 - thumbSize / 2 + thumbSize
          )
          columnThumb?.layout(
            (tableLeft + column * cellWidth + cellWidth / 2 - thumbSize / 2).roundToInt(),
            tableTop - thumbSize / 2,
            (tableLeft + column * cellWidth + cellWidth / 2 + thumbSize / 2).roundToInt(),
            tableTop + thumbSize / 2
          )
        }
      }
    }
  }

  private inner class EditorInput(context: Context) : EditText(context) {
    private var pressedToggleBlock = -1
    private var pressedTodoBlock = -1
    private var pressedPageReferenceBlock = -1
    private var pressedDividerBlock = -1
    private var pressedImageBlock = -1
    private var pressedAudioBlock = -1
    private var pressedFileBlock = -1
    private var pressedTableBlock = -1
    private var pressStartX = 0f
    private var pressStartY = 0f
    private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop

    /** BlockPaddingSpan enlarges a line's metrics, including Android's default cursor bounds. */
    fun useGlyphHeightCursor() {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
      val nativeCursor = textCursorDrawable ?: return
      setTextCursorDrawable(object : DrawableWrapper(nativeCursor) {
        override fun draw(canvas: Canvas) {
          val textLayout = layout ?: return super.draw(canvas)
          val offset = selectionStart.takeIf { it >= 0 } ?: return super.draw(canvas)
          val line = textLayout.getLineForOffset(offset)
          val blockIndex = text.take(textLayout.getLineStart(line)).count { it == '\n' }
          val scale = blocks.getOrNull(blockIndex)?.type?.let(::editorHeadingLevel)
            ?.let(headingScale::get) ?: 1f
          val glyphPaint = Paint(paint).apply { textSize *= scale }
          val metrics = glyphPaint.fontMetricsInt
          val baseline = textLayout.getLineBaseline(line)
          val glyphTop = baseline + metrics.ascent
          val glyphBottom = baseline + metrics.descent
          val saved = canvas.save()
          canvas.clipRect(bounds.left, glyphTop, bounds.right, glyphBottom)
          super.draw(canvas)
          canvas.restoreToCount(saved)
        }
      })
    }

    /** Paints every callout's rounded background box before the base class draws text and cursor. */
    override fun onDraw(canvas: Canvas) {
      drawCalloutBackgrounds(canvas)
      super.onDraw(canvas)
    }

    private fun drawCalloutBackgrounds(canvas: Canvas) {
      val textLayout = layout ?: return
      val outerPadding = CALLOUT_OUTER_PADDING_DP * resources.displayMetrics.density
      val left = totalPaddingLeft + outerPadding
      val right = width - totalPaddingRight - outerPadding
      val topOffset = totalPaddingTop
      val density = resources.displayMetrics.density
      val radius = 12f * density
      val fillPaint = Paint(paint).apply { style = Paint.Style.FILL }
      val borderPaint = Paint(paint).apply {
        style = Paint.Style.STROKE
        strokeWidth = density
      }
      var start = 0
      blocks.forEach { block ->
        val end = start + block.nativeText().length
        if (block.type == "callout") {
          val firstLine = textLayout.getLineForOffset(start)
          val lastLine = textLayout.getLineForOffset(end)
          val top = textLayout.getLineTop(firstLine) + topOffset + outerPadding
          val bottom = textLayout.getLineBottom(lastLine) + topOffset - outerPadding
          val rect = RectF(left, top, right, bottom)
          val isForegroundColor = block.color?.let { it in editorTextColors } == true
          fillPaint.color = when {
            block.color?.let { editorBackgroundColors[it] } != null ->
              editorBackgroundColors.getValue(block.color!!)
            isForegroundColor -> if (dark) Color.rgb(0x19, 0x19, 0x19) else Color.WHITE
            else -> editorCalloutDefaultBackground(dark)
          }
          canvas.drawRoundRect(rect, radius, radius, fillPaint)
          if (isForegroundColor) {
            borderPaint.color = if (dark) Color.rgb(0x48, 0x48, 0x46) else Color.rgb(0xE6, 0xE5, 0xE2)
            canvas.drawRoundRect(rect, radius, radius, borderPaint)
          }
        }
        start = end + 1
      }
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
      super.onSizeChanged(w, h, oldw, oldh)
      if (w != oldw && blocks.any { it.type == "image" || it.type == "audio" || it.type == "video" || it.type == "file" || it.type == "table" }) {
        post {
          styleBlocks()
          tableOverlay.requestLayout()
          invalidate()
        }
      }
    }

    private fun toggleBlockAt(event: MotionEvent): Int? {
      val textLayout = layout ?: return null
      if (textLayout.height == 0) return null
      val lineY = (event.y - totalPaddingTop).toInt().coerceIn(0, textLayout.height - 1)
      val line = textLayout.getLineForVertical(lineY)
      val lineStart = textLayout.getLineStart(line)
      val blockIndex = text.take(lineStart).count { it == '\n' }
      val block = blocks.getOrNull(blockIndex) ?: return null
      if (!block.toggle || editorHeadingLevel(block.type) == null) return null
      val textStart = textLayout.getPrimaryHorizontal(lineStart)
      val buttonWidth = textSize * TOGGLE_BUTTON_WIDTH_SCALE
      return if (event.x in (textStart - buttonWidth)..textStart) blockIndex else null
    }

    private fun todoBlockAt(event: MotionEvent): Int? {
      val textLayout = layout ?: return null
      if (textLayout.height == 0) return null
      val lineY = (event.y - totalPaddingTop).toInt().coerceIn(0, textLayout.height - 1)
      val line = textLayout.getLineForVertical(lineY)
      val lineStart = textLayout.getLineStart(line)
      val blockIndex = text.take(lineStart).count { it == '\n' }
      val block = blocks.getOrNull(blockIndex) ?: return null
      if (block.type != "to_do") return null
      val textStart = textLayout.getPrimaryHorizontal(lineStart)
      val buttonWidth = textSize * TODO_CHECKBOX_WIDTH_SCALE
      return if (event.x in (textStart - buttonWidth)..textStart) blockIndex else null
    }

    private fun pageReferenceBlockAt(event: MotionEvent): Int? {
      val textLayout = layout ?: return null
      if (textLayout.height == 0) return null
      val lineY = (event.y - totalPaddingTop).toInt().coerceIn(0, textLayout.height - 1)
      val line = textLayout.getLineForVertical(lineY)
      val lineStart = textLayout.getLineStart(line)
      val blockIndex = text.take(lineStart).count { it == '\n' }
      val block = blocks.getOrNull(blockIndex) ?: return null
      if (block.type != "link_to_page" || block.url.isNullOrBlank()) return null
      val start = textLayout.getPrimaryHorizontal(lineStart)
      val end = textLayout.getPrimaryHorizontal(lineStart + block.nativeText().length)
      return if (event.x in minOf(start, end)..maxOf(start, end)) blockIndex else null
    }

    private fun pageReferenceIsSelected(): Boolean {
      val range = selectedBlockRange() ?: return false
      return range.first == range.last && blocks[range.first].type == "link_to_page"
    }

    /** A divider fills its whole line, so any tap along that line -- not just a narrow inline
     *  button region -- opens the actions sheet for it. */
    private fun dividerBlockAt(event: MotionEvent): Int? {
      val textLayout = layout ?: return null
      if (textLayout.height == 0) return null
      val lineY = (event.y - totalPaddingTop).toInt().coerceIn(0, textLayout.height - 1)
      val line = textLayout.getLineForVertical(lineY)
      val lineStart = textLayout.getLineStart(line)
      val blockIndex = text.take(lineStart).count { it == '\n' }
      val block = blocks.getOrNull(blockIndex) ?: return null
      return if (block.type == "divider") blockIndex else null
    }

    /** An image fills its whole line, so any tap along that line opens the actions sheet for it. */
    private fun imageBlockAt(event: MotionEvent): Int? {
      val textLayout = layout ?: return null
      if (textLayout.height == 0) return null
      val lineY = (event.y - totalPaddingTop).toInt().coerceIn(0, textLayout.height - 1)
      val line = textLayout.getLineForVertical(lineY)
      val lineStart = textLayout.getLineStart(line)
      val blockIndex = text.take(lineStart).count { it == '\n' }
      val block = blocks.getOrNull(blockIndex) ?: return null
      return if (block.type == "image") blockIndex else null
    }

    /** An audio card is selectable across its whole line; its leading circle is playback. */
    private fun audioBlockAt(event: MotionEvent): Int? {
      val textLayout = layout ?: return null
      if (textLayout.height == 0) return null
      val lineY = (event.y - totalPaddingTop).toInt().coerceIn(0, textLayout.height - 1)
      val line = textLayout.getLineForVertical(lineY)
      val lineStart = textLayout.getLineStart(line)
      val blockIndex = text.take(lineStart).count { it == '\n' }
      val block = blocks.getOrNull(blockIndex) ?: return null
      return if (block.type == "audio") blockIndex else null
    }

    /** A file card is selectable across its whole line and opens the block-actions sheet. */
    private fun fileBlockAt(event: MotionEvent): Int? {
      val textLayout = layout ?: return null
      if (textLayout.height == 0) return null
      val lineY = (event.y - totalPaddingTop).toInt().coerceIn(0, textLayout.height - 1)
      val line = textLayout.getLineForVertical(lineY)
      val lineStart = textLayout.getLineStart(line)
      val blockIndex = text.take(lineStart).count { it == '\n' }
      val block = blocks.getOrNull(blockIndex) ?: return null
      return if (block.type == "file") blockIndex else null
    }

    private fun tableBlockAt(event: MotionEvent): Int? {
      val textLayout = layout ?: return null
      if (textLayout.height == 0) return null
      val lineY = (event.y - totalPaddingTop).toInt().coerceIn(0, textLayout.height - 1)
      val line = textLayout.getLineForVertical(lineY)
      val lineStart = textLayout.getLineStart(line)
      val blockIndex = text.take(lineStart).count { it == '\n' }
      return blockIndex.takeIf { blocks.getOrNull(it)?.type == "table" }
    }

    /** True once any tap-region has been armed by a preceding [MotionEvent.ACTION_DOWN]. */
    private fun hasPressedBlock() = pressedToggleBlock >= 0 || pressedTodoBlock >= 0 ||
      pressedPageReferenceBlock >= 0 || pressedDividerBlock >= 0 || pressedImageBlock >= 0 ||
      pressedAudioBlock >= 0 || pressedFileBlock >= 0
      || pressedTableBlock >= 0

    /** Disarms every tap-region, e.g. once a gesture turns out to be a scroll, not a tap. */
    private fun clearPressedBlocks() {
      pressedToggleBlock = -1
      pressedTodoBlock = -1
      pressedPageReferenceBlock = -1
      pressedDividerBlock = -1
      pressedImageBlock = -1
      pressedAudioBlock = -1
      pressedFileBlock = -1
      pressedTableBlock = -1
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
      val toggleBlock = toggleBlockAt(event)
      val todoBlock = todoBlockAt(event)
      val pageReferenceBlock = pageReferenceBlockAt(event)
      val dividerBlock = dividerBlockAt(event)
      val imageBlock = imageBlockAt(event)
      val audioBlock = audioBlockAt(event)
      val fileBlock = fileBlockAt(event)
      val tableBlock = tableBlockAt(event)
      val pressedSpecialBlock = hasPressedBlock()
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          pressStartX = event.x
          pressStartY = event.y
          pressedToggleBlock = toggleBlock ?: -1
          pressedTodoBlock = todoBlock ?: -1
          pressedPageReferenceBlock = pageReferenceBlock ?: -1
          pressedDividerBlock = dividerBlock ?: -1
          pressedImageBlock = imageBlock ?: -1
          pressedAudioBlock = audioBlock ?: -1
          pressedFileBlock = fileBlock ?: -1
          pressedTableBlock = tableBlock ?: -1
          if (pressedToggleBlock >= 0) return true
          if (pressedTodoBlock >= 0) return true
          if (pressedPageReferenceBlock >= 0) return true
          if (pressedDividerBlock >= 0) return true
          if (pressedImageBlock >= 0) return true
          if (pressedAudioBlock >= 0) return true
          if (pressedFileBlock >= 0) return true
          if (pressedTableBlock >= 0) return true
        }
        // A tap-region stays armed through ACTION_DOWN's early return above, so a swipe that
        // starts on one (a divider or image commonly fills most of the visible width/height)
        // would otherwise still fire as a tap on ACTION_UP, regardless of how far it dragged in
        // between -- this is what actually opens the actions sheet mid-scroll and, since nothing
        // else was ever asked to handle the gesture, is also why the swipe fails to scroll at all.
        MotionEvent.ACTION_MOVE -> {
          if (hasPressedBlock() &&
            (abs(event.x - pressStartX) > touchSlop || abs(event.y - pressStartY) > touchSlop)) {
            clearPressedBlocks()
          }
        }
        MotionEvent.ACTION_UP -> {
          val pressed = pressedToggleBlock
          val pressedTodo = pressedTodoBlock
          val pressedPageReference = pressedPageReferenceBlock
          val pressedDivider = pressedDividerBlock
          val pressedImage = pressedImageBlock
          val pressedAudio = pressedAudioBlock
          val pressedFile = pressedFileBlock
          val pressedTable = pressedTableBlock
          pressedToggleBlock = -1
          pressedTodoBlock = -1
          pressedPageReferenceBlock = -1
          pressedDividerBlock = -1
          pressedImageBlock = -1
          pressedAudioBlock = -1
          pressedFileBlock = -1
          pressedTableBlock = -1
          if (pressed >= 0 && toggleBlock == pressed) {
            blocks[pressed].collapsed = !blocks[pressed].collapsed
            styleBlocks()
            scheduleEvent("toggle-block")
            performClick()
            return true
          }
          if (pressedTodo >= 0 && todoBlock == pressedTodo) {
            blocks[pressedTodo].checked = !blocks[pressedTodo].checked
            styleBlocks()
            scheduleEvent("toggle-to-do")
            performClick()
            return true
          }
          if (pressedPageReference >= 0 && pageReferenceBlock == pressedPageReference) {
            val block = blocks[pressedPageReference]
            block.url?.let { url ->
              val event = mutableMapOf<String, Any>(
                "id" to block.id,
                "text" to block.text,
                "url" to url
              )
              block.icon?.let { event["icon"] = it }
              onPageReferencePress(event)
            }
            performClick()
            return true
          }
          if (pressedDivider >= 0 && dividerBlock == pressedDivider) {
            val block = blocks[pressedDivider]
            onBlockActionsPress(mapOf("id" to block.id, "type" to block.type))
            performClick()
            return true
          }
          if (pressedImage >= 0 && imageBlock == pressedImage) {
            val block = blocks[pressedImage]
            onBlockActionsPress(mapOf("id" to block.id, "type" to block.type))
            performClick()
            return true
          }
          if (pressedAudio >= 0 && audioBlock == pressedAudio) {
            val block = blocks[pressedAudio]
            if (event.x <= input.paddingLeft + 72 * resources.displayMetrics.density) {
              toggleAudio(block)
            } else {
              onBlockActionsPress(mapOf("id" to block.id, "type" to block.type))
            }
            performClick()
            return true
          }
          if (pressedFile >= 0 && fileBlock == pressedFile) {
            val block = blocks[pressedFile]
            onBlockActionsPress(mapOf("id" to block.id, "type" to block.type))
            performClick()
            return true
          }
          if (pressedTable >= 0 && tableBlock == pressedTable) {
            val block = blocks[pressedTable]
            onBlockActionsPress(mapOf("id" to block.id, "type" to block.type, "scope" to "table"))
            performClick()
            return true
          }
        }
        MotionEvent.ACTION_CANCEL -> {
          clearPressedBlocks()
        }
      }
      val handled = super.onTouchEvent(event)
      /* A focused EditText does not receive another focus transition after the keyboard is
       * dismissed. Re-tapping it can still move the cursor, but Android then leaves the IME
       * hidden unless we explicitly request it for this ordinary text-editing path. */
      if (event.actionMasked == MotionEvent.ACTION_UP && !pressedSpecialBlock && handled) {
        requestKeyboard()
      }
      return handled
    }

    /**
     * Image and video blocks are atomic -- they carry no navigable text of their own, just a
     * single placeholder character standing in for the media. Letting the cursor come to rest on
     * either raw edge of that character is what makes it render at a nonsensical spot over the
     * media itself (flush with its bottom edge, or hidden just before its right edge). Returns
     * where the cursor should land instead, skipping straight over the block in whichever
     * direction it was already headed, or `null` if [offset] isn't on such a block at all.
     */
    private fun mediaBlockSkipTarget(offset: Int): Int? {
      if (blocks.isEmpty()) return null
      val safeOffset = offset.coerceIn(0, text.length)
      val index = text.take(safeOffset).count { it == '\n' }.coerceIn(0, blocks.lastIndex)
      val block = blocks[index]
      if (block.type != "image" && block.type != "audio" && block.type != "video" && block.type != "file") return null
      val blockStart = offsetOf(index)
      val forward = safeOffset <= blockStart
      return when {
        forward && index < blocks.lastIndex -> offsetOf(index + 1)
        !forward && index > 0 -> offsetOf(index) - 1
        index < blocks.lastIndex -> offsetOf(index + 1)
        index > 0 -> offsetOf(index) - 1
        else -> null
      }
    }

    override fun onSelectionChanged(start: Int, end: Int) {
      super.onSelectionChanged(start, end)
      if (!inputInitialized) return
      if (start == end) {
        val target = mediaBlockSkipTarget(start)
        if (target != null) {
          setSelection(target)
          return
        }
      }
      styleBlocks()
      scheduleEvent("selection")
    }

    override fun onTextContextMenuItem(id: Int): Boolean = when (id) {
      android.R.id.copy -> copy(false)
      android.R.id.cut -> copy(true)
      android.R.id.paste -> paste()
      android.R.id.pasteAsPlainText -> {
        val clip = clipboard().primaryClip
        if (clip != null && clip.itemCount > 0) replaceSelection(clip.getItemAt(0).coerceToText(context).toString())
        true
      }
      else -> super.onTextContextMenuItem(id)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
      if (pageReferenceIsSelected() && keyCode != KeyEvent.KEYCODE_DPAD_LEFT
        && keyCode != KeyEvent.KEYCODE_DPAD_RIGHT
        && keyCode != KeyEvent.KEYCODE_DPAD_UP
        && keyCode != KeyEvent.KEYCODE_DPAD_DOWN) {
        return true
      }
      if (keyCode == KeyEvent.KEYCODE_ENTER && !event.isShiftPressed
        && (createDividerFromShortcut() || handleListEnter() || handleDividerEnter())) {
        return true
      }
      if (keyCode == KeyEvent.KEYCODE_ENTER && event.isShiftPressed) {
        replaceSelection("\u2028")
        return true
      }
      if (keyCode == KeyEvent.KEYCODE_DEL && handleAtomicBlockBackspace()) {
        return true
      }
      return super.onKeyDown(keyCode, event)
    }

    override fun onCreateInputConnection(outAttrs: EditorInfo): InputConnection? {
      val connection = super.onCreateInputConnection(outAttrs) ?: return null
      val connectionEpoch = epoch
      return object : InputConnectionWrapper(connection, false) {
        override fun setComposingText(text: CharSequence?, newCursorPosition: Int): Boolean {
          if (epoch != connectionEpoch) return false
          if (pageReferenceIsSelected()) return true
          val result = super.setComposingText(text, newCursorPosition)
          scheduleEvent("ime-composing")
          return result
        }
        override fun commitText(text: CharSequence?, newCursorPosition: Int): Boolean {
          if (epoch != connectionEpoch) return false
          if (pageReferenceIsSelected()) return true
          if (text?.toString() == "\n" && (createDividerFromShortcut() || handleListEnter() || handleDividerEnter())) return true
          val result = super.commitText(text, newCursorPosition)
          scheduleEvent("ime-commit")
          return result
        }
        override fun finishComposingText(): Boolean {
          if (epoch != connectionEpoch) return false
          val result = super.finishComposingText()
          scheduleEvent("ime-finish")
          return result
        }
        override fun setComposingRegion(start: Int, end: Int): Boolean {
          if (epoch != connectionEpoch) return false
          val result = super.setComposingRegion(start, end)
          scheduleEvent("ime-composing-region")
          return result
        }
        override fun commitText(text: CharSequence, newCursorPosition: Int, textAttribute: TextAttribute?): Boolean {
          if (epoch != connectionEpoch) return false
          if (pageReferenceIsSelected()) return true
          if (text.toString() == "\n" && (createDividerFromShortcut() || handleListEnter() || handleDividerEnter())) return true
          val result = super.commitText(text, newCursorPosition, textAttribute)
          scheduleEvent("ime-commit")
          return result
        }
        override fun setComposingText(text: CharSequence, newCursorPosition: Int, textAttribute: TextAttribute?): Boolean {
          if (epoch != connectionEpoch) return false
          if (pageReferenceIsSelected()) return true
          val result = super.setComposingText(text, newCursorPosition, textAttribute)
          scheduleEvent("ime-composing")
          return result
        }
        override fun setComposingRegion(start: Int, end: Int, textAttribute: TextAttribute?): Boolean {
          if (epoch != connectionEpoch) return false
          val result = super.setComposingRegion(start, end, textAttribute)
          scheduleEvent("ime-composing-region")
          return result
        }
        override fun replaceText(start: Int, end: Int, text: CharSequence, newCursorPosition: Int, textAttribute: TextAttribute?): Boolean =
          epoch == connectionEpoch && !pageReferenceIsSelected() && super.replaceText(start, end, text, newCursorPosition, textAttribute)
        override fun commitCompletion(text: CompletionInfo?): Boolean =
          epoch == connectionEpoch && super.commitCompletion(text)
        override fun commitCorrection(correctionInfo: CorrectionInfo?): Boolean =
          epoch == connectionEpoch && super.commitCorrection(correctionInfo)
        override fun performContextMenuAction(id: Int): Boolean =
          epoch == connectionEpoch && super.performContextMenuAction(id)
        override fun performEditorAction(editorAction: Int): Boolean =
          epoch == connectionEpoch && super.performEditorAction(editorAction)
        override fun beginBatchEdit(): Boolean = epoch == connectionEpoch && super.beginBatchEdit()
        override fun endBatchEdit(): Boolean = epoch == connectionEpoch && super.endBatchEdit()
        override fun deleteSurroundingText(beforeLength: Int, afterLength: Int): Boolean {
          if (epoch != connectionEpoch) return false
          if (pageReferenceIsSelected()) return true
          if (beforeLength > 0 && afterLength == 0 && handleAtomicBlockBackspace()) return true
          return super.deleteSurroundingText(beforeLength, afterLength)
        }
        override fun deleteSurroundingTextInCodePoints(beforeLength: Int, afterLength: Int): Boolean {
          if (epoch != connectionEpoch) return false
          if (pageReferenceIsSelected()) return true
          if (beforeLength > 0 && afterLength == 0 && handleAtomicBlockBackspace()) return true
          return super.deleteSurroundingTextInCodePoints(beforeLength, afterLength)
        }
        override fun setSelection(start: Int, end: Int): Boolean =
          epoch == connectionEpoch && super.setSelection(start, end)
        override fun sendKeyEvent(event: KeyEvent): Boolean =
          epoch == connectionEpoch && super.sendKeyEvent(event)
      }
    }
  }
}
