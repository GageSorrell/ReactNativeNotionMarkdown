package expo.modules.notionmarkdown

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
import android.net.Uri
import android.media.MediaMetadataRetriever
import android.os.Build
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
import android.view.Gravity
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.inputmethod.BaseInputConnection
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.view.inputmethod.InputConnectionWrapper
import android.view.inputmethod.InputMethodManager
import android.view.inputmethod.CompletionInfo
import android.view.inputmethod.CorrectionInfo
import android.view.inputmethod.TextAttribute
import android.widget.EditText
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import kotlin.math.roundToInt

private const val FRAGMENT_MIME = "application/vnd.react-native-notion-markdown.proof+json"

/** Relative text size applied to each heading level's span, matching Notion's own descending scale. */
private val headingScale = mapOf(1 to 1.875f, 2 to 1.5f, 3 to 1.25f, 4 to 1.125f)

/** Solid text colors -- the same nine named colors and RGB values as `NotionTextFieldView`'s
 *  inline `markColors`, kept in sync manually since this is a block-level, not inline, span. */
private val proofTextColors: Map<String, Int> = mapOf(
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

/** The `_bg` background variants -- the same nine hues as `proofTextColors`, applied as a
 *  translucent tint so they read against both light and dark editor backgrounds. */
private val proofBackgroundColors: Map<String, Int> = mapOf(
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

private val proofValidBlockTypes = listOf(
  "text", "heading_1", "heading_2", "heading_3", "heading_4", "bulleted_list_item",
  "numbered_list_item", "to_do", "callout", "divider", "table_of_contents", "column_list", "image", "video",
  "link_to_page"
)
private val proofValidColors = proofTextColors.keys + proofBackgroundColors.keys

/** Block types with mergeable text content -- eligible on either side of a divider-skipping
 *  backspace merge (see [NotionProofView.handleDividerBackspace]). */
private val proofMergeableBlockTypes = setOf(
  "text", "heading_1", "heading_2", "heading_3", "heading_4",
  "bulleted_list_item", "numbered_list_item", "to_do", "callout"
)

/** A checked to-do's checkbox fill and its unchecked border, matching the renderer's theme accent. */
private fun proofAccentColor(dark: Boolean) = if (dark) Color.rgb(0x81, 0xB8, 0xE7) else Color.rgb(0x2F, 0x6E, 0xAB)

/** A checked to-do's text color, matching the renderer theme's muted foreground. */
private fun proofMutedColor(dark: Boolean) = if (dark) Color.rgb(0xA0, 0xA0, 0xA0) else Color.rgb(0x73, 0x73, 0x73)

/** An unchecked to-do checkbox's border color, matching the renderer theme's border. */
private fun proofCheckboxBorderColor(dark: Boolean) = if (dark) Color.rgb(0x41, 0x41, 0x41) else Color.rgb(0xDE, 0xDE, 0xDB)

/** A callout's default box tint when no `_bg` color is chosen, matching the renderer theme's surface. */
private fun proofCalloutDefaultBackground(dark: Boolean) = if (dark) Color.rgb(0x25, 0x25, 0x25) else Color.rgb(0xF7, 0xF7, 0xF5)
private const val DIVIDER_TEXT = "\u200B"
private const val TABLE_OF_CONTENTS_TEXT = "\u200B"
private const val COLUMNS_TEXT = "\u200B"
private const val EMPTY_BLOCK_TEXT = "\u200B"
private const val MEDIA_TEXT = "\uFFFC"
private const val TABLE_OF_CONTENTS_LABEL = "Table of contents"
private const val DEFAULT_EMPTY_TOGGLE_PLACEHOLDER = "Empty toggle.  Tap to add text or create a new block."
private const val DEFAULT_CALLOUT_ICON = "\uD83D\uDCAC"
private const val TOGGLE_BUTTON_WIDTH_SCALE = 1.5f
private const val TODO_CHECKBOX_WIDTH_SCALE = 1.5f
private const val LIST_MARKER_WIDTH_SCALE = 1.5f
private const val CALLOUT_ICON_WIDTH_SCALE = 2f

private fun proofHeadingLevel(type: String): Int? = when (type) {
  "heading_1" -> 1
  "heading_2" -> 2
  "heading_3" -> 3
  "heading_4" -> 4
  else -> null
}

private data class ProofBlock(
  val id: String,
  var type: String,
  var text: String,
  var color: String? = null,
  var depth: Int = 0,
  var toggle: Boolean = false,
  var collapsed: Boolean = false,
  val marks: MutableList<ProofMark> = mutableListOf(),
  var checked: Boolean = false,
  var url: String? = null,
  var icon: String? = null,
  var columnCount: Int? = null
) {
  fun payload(): Map<String, Any?> {
    val base = mutableMapOf<String, Any?>("id" to id, "type" to type, "text" to text)
    color?.let { base["color"] = it }
    if (depth > 0) base["depth"] = depth
    if (toggle) base["toggle"] = true
    if (toggle && collapsed) base["collapsed"] = true
    if (type == "to_do") base["checked"] = checked
    if (type == "column_list") base["columnCount"] = (columnCount ?: 2).coerceIn(2, 5)
    if (type == "link_to_page" || type == "image" || type == "video") {
      url?.let { base["url"] = it }
    }
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

private data class ProofMark(
  val kind: String,
  var start: Int,
  var end: Int,
  val url: String? = null
)

private data class ProofPasteBlock(
  val type: String,
  val text: String,
  val color: String?,
  val marks: List<ProofMark>,
  val checked: Boolean = false,
  val url: String? = null,
  val icon: String? = null,
  val columnCount: Int? = null
)

/** Marker span used to preserve inline marks while Android adjusts ranges during text edits. */
private class ProofInlineMarkSpan(val kind: String, val url: String? = null) : android.text.style.CharacterStyle() {
  override fun updateDrawState(textPaint: android.text.TextPaint) = Unit
}

/**
 * Adds a block's top/bottom padding and a one-eighth natural-height gap between wrapped lines.
 * [blockStart] and [blockEnd] are the block's own fixed offsets at span-creation time (recomputed
 * every [NotionProofView.styleBlocks] pass), compared against the line range Android passes to
 * [chooseHeight] to tell a block's boundary line from an interior wrapped line.
 */
private class BlockPaddingSpan(
  private val top: Int,
  private val bottom: Int,
  private val blockStart: Int,
  private val blockEnd: Int
) : LineHeightSpan {
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
private fun ProofBlock.nativeText(): String = when {
  type == "image" || type == "video" -> MEDIA_TEXT
  text.isEmpty() -> EMPTY_BLOCK_TEXT
  else -> text
}

private fun List<ProofBlock>.nativeText(): String = joinToString("\n") { it.nativeText() }

/** Draws a divider block while keeping its proof text payload invisible and editable. */
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
private class ProofImageSpan(
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
private class ProofVideoSpan(
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

/** Draws a compact table-of-contents placeholder for the proof editor's non-text block. */
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

/** Draws the selected-column-count placeholder used by the proof editor's composite column block. */
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

/**
 * Draws the hint for an empty child created under a toggle heading without changing its text.
 */
private class EmptyTogglePlaceholderSpan(
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
 * Draws a callout's rounded background box behind its (possibly wrapped) text. [blockStart] and
 * [blockEnd] are the block's fixed offsets at span-creation time, used the same way as in
 * [BlockPaddingSpan] to tell the block's first/last line -- which get rounded corners -- from an
 * interior wrapped line, which stays flat so the fill reads as one continuous shape.
 */
private class CalloutBackgroundSpan(
  private val color: Int,
  private val blockStart: Int,
  private val blockEnd: Int
) : LineBackgroundSpan {
  override fun drawBackground(
    canvas: Canvas,
    paint: Paint,
    left: Int,
    right: Int,
    top: Int,
    baseline: Int,
    bottom: Int,
    text: CharSequence,
    start: Int,
    end: Int,
    lineNumber: Int
  ) {
    val radius = paint.textSize * 0.35f
    val topRadius = if (start <= blockStart) radius else 0f
    val bottomRadius = if (end >= blockEnd) radius else 0f
    val path = Path()
    path.addRoundRect(
      RectF(left.toFloat(), top.toFloat(), right.toFloat(), bottom.toFloat()),
      floatArrayOf(
        topRadius, topRadius,
        topRadius, topRadius,
        bottomRadius, bottomRadius,
        bottomRadius, bottomRadius
      ),
      Path.Direction.CW
    )
    val previousColor = paint.color
    val previousStyle = paint.style
    paint.color = color
    paint.style = Paint.Style.FILL
    canvas.drawPath(path, paint)
    paint.color = previousColor
    paint.style = previousStyle
  }
}

/**
 * Reserves and draws a callout's icon at the start of its first line. Tapping it is a no-op for
 * now -- an emoji picker bottom sheet will make it interactive later.
 */
private class CalloutIconSpan(
  private val iconWidth: Int,
  private val icon: String
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
    canvas.drawText(icon, x.toFloat(), iconBaseline, iconPaint)
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
class NotionProofView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true
  private val onEdit by EventDispatcher()
  private val onPageReferencePress by EventDispatcher()
  private val onBlockActionsPress by EventDispatcher()
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
  private val blocks = mutableListOf<ProofBlock>()
  private val input = ProofInput(context)
  private var removed = ""
  private var editBlock = 0
  private var probeConnection: InputConnection? = null
  private var keyboardRequestPending = false
  private var keyboardShowAttempts = 0
  private val showKeyboardRunnable = Runnable { showKeyboardWhenReady() }

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
    addView(input, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
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
          blocks.add(editBlock + index + 1, ProofBlock(newId(), continuedType, "", depth = continuedDepth))
        }
        val lines = s?.toString()?.split('\n') ?: listOf("")
        lines.forEachIndexed { index, text ->
          blocks[index].text = if (blocks[index].type == "link_to_page") {
            blocks[index].text
          } else if (blocks[index].type == "divider"
            || blocks[index].type == "table_of_contents" || blocks[index].type == "column_list") {
            text
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
      val color = (block["color"] as? String)?.takeIf { it in proofValidColors }
      val depth = (block["depth"] as? Number)?.toInt()?.takeIf { it >= 0 } ?: 0
      val toggle = (block["toggle"] as? Boolean) == true && type.startsWith("heading_")
      val collapsed = (block["collapsed"] as? Boolean) == true && toggle
      val checked = (block["checked"] as? Boolean) == true && type == "to_do"
      val url = block["url"] as? String
      val icon = block["icon"] as? String
      val marks = mutableListOf<ProofMark>()
      (block["marks"] as? List<*>)?.forEach { rawMark ->
        val mark = rawMark as? Map<*, *> ?: return@forEach
        val kind = mark["kind"] as? String ?: return@forEach
        val start = (mark["start"] as? Number)?.toInt() ?: return@forEach
        val end = (mark["end"] as? Number)?.toInt() ?: return@forEach
        val markUrl = (mark["url"] as? String)?.takeIf { kind == "link" }
        if ((kind in listOf("bold", "italic", "strikethrough", "underline", "code")
          || (kind == "link" && !markUrl.isNullOrBlank())) &&
          start >= 0 && end > start && end <= text.length) {
          marks.add(ProofMark(kind, start, end, markUrl))
        }
      }
      val columnCount = (block["columnCount"] as? Number)?.toInt()?.takeIf { it in 2..5 }
      if (text.contains('\n') || type !in proofValidBlockTypes
        || ((type == "link_to_page" || type == "image" || type == "video") && url.isNullOrBlank())) null
      else ProofBlock(id, type, text, color, depth, toggle, collapsed, marks, checked, url, icon, columnCount)
    }
    if (nextBlocks.isEmpty() || nextBlocks.size != supplied.size || nextBlocks.map { it.id }.distinct().size != nextBlocks.size) return
    applying = true
    epoch = nextEpoch
    revision = (value["revision"] as? Number)?.toInt() ?: 0
    blocks.clear()
    blocks.addAll(nextBlocks)
    BaseInputConnection.removeComposingSpans(input.text)
    input.setText(blocks.nativeText())
    input.setSelection(0)
    styleBlocks()
    applying = false
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
    super.onDetachedFromWindow()
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
    if (blocks.any { it.type == "image" || it.type == "video" }) styleBlocks()
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
      "selectAll" -> input.selectAll()
      "copy" -> copy(false)
      "cut" -> copy(true)
      "paste" -> paste()
      "split" -> if (!handleListEnter() && !handleDividerEnter()) replaceSelection("\n")
      "divider" -> insertDivider()
      "tableOfContents" -> insertTableOfContents()
      "columns" -> insertColumns((value["columnCount"] as? Number)?.toInt() ?: 2)
      "insertImage" -> insertMedia("image", value["url"] as? String)
      "insertVideo" -> insertMedia("video", value["url"] as? String)
      "toDo" -> insertToDo()
      "callout" -> insertCallout()
      "heading" -> {
        replaceSelection("\n")
        val index = input.text.take(input.selectionStart).count { it == '\n' }
        val level = (value["level"] as? Number)?.toInt()?.coerceIn(1, 4) ?: 1
        val heading = blocks.getOrNull(index) ?: return
        heading.type = "heading_$level"
        heading.color = (value["color"] as? String)?.takeIf { it in proofValidColors }
        heading.toggle = (value["toggle"] as? Boolean) == true
        heading.collapsed = false
        if (heading.toggle) {
          val childIndex = index + 1
          val child = blocks.getOrNull(childIndex)
          if (child == null || child.text.isNotEmpty()) {
            blocks.add(childIndex, ProofBlock(newId(), "text", "", depth = heading.depth + 1))
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
      "color" -> applySelectionColor((value["color"] as? String)?.takeIf { it in proofValidColors })
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
        it in proofValidBlockTypes && it != "link_to_page"
      })
      "indent" -> indentBlocks()
      "outdent" -> outdentBlocks()
      "moveBlockUp" -> moveBlocks(-1)
      "moveBlockDown" -> moveBlocks(1)
      "insertAbove" -> insertBlockRelativeToId(value["blockId"] as? String, before = true)
      "insertBelow" -> insertBlockRelativeToId(value["blockId"] as? String, before = false)
      "duplicateBlock" -> duplicateBlockById(value["blockId"] as? String)
      "deleteBlock" -> deleteBlockById(value["blockId"] as? String)
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
        else if (start > 0 && !handleDividerBackspace()) {
          val previous = Character.offsetByCodePoints(input.text, start, -1)
          input.text.delete(previous, start)
          input.setSelection(previous)
        }
      }
    }
  }

  private fun inputMethodManager() = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
  private fun clipboard() = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
  private fun newId() = "proof:${UUID.randomUUID()}"

  private fun replaceSelection(text: String) {
    if (selectedBlockRange()?.any { blocks[it].type == "link_to_page" } == true) return
    val start = minOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    val end = maxOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    input.text.replace(start, end, text)
    input.setSelection(start + text.length)
  }

  /**
   * Toggles one inline mark over the selected text, including selections spanning blocks. When
   * the selection is collapsed (a plain cursor), widens it to the word the cursor touches -- at
   * the word's start, middle, or end -- so tapping a sub-menu button formats that word. A cursor
   * touching no word (surrounded by whitespace) is a no-op, matching the disabled button state.
   */
  private fun toggleFormat(kind: String?) {
    if (kind == null) return
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
    val localRanges = selectedFormatRanges() ?: return
    localRanges.forEach { (index, range) ->
      clearMarkRange(blocks[index], range.first, range.last)
    }
    styleBlocks()
    scheduleEvent("clear-format")
  }

  /** Apply a URL to the selected text, replacing its displayed label when requested. */
  private fun applyLink(rawUrl: String?, requestedLabel: String?) {
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
      blocks[index].marks.add(ProofMark("link", range.first, range.last, url))
      blocks[index].marks.sortWith(compareBy<ProofMark> { it.start }.thenBy { it.end }.thenBy { it.kind })
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

  private fun coversMarkRange(block: ProofBlock, kind: String, start: Int, endInclusive: Int): Boolean {
    var cursor = start
    block.marks.filter { it.kind == kind && it.end > it.start }
      .sortedBy { it.start }
      .forEach { mark ->
        if (mark.start <= cursor) cursor = maxOf(cursor, mark.end)
      }
    return cursor >= endInclusive
  }

  private fun toggleMarkRange(
    block: ProofBlock,
    kind: String,
    start: Int,
    endInclusive: Int,
    remove: Boolean
  ) {
    val end = endInclusive
    val next = mutableListOf<ProofMark>()
    block.marks.forEach { mark ->
      if (mark.kind != kind || mark.end <= start || mark.start >= end) {
        next.add(mark)
      } else if (remove) {
        if (mark.start < start) next.add(ProofMark(mark.kind, mark.start, start, mark.url))
        if (mark.end > end) next.add(ProofMark(mark.kind, end, mark.end, mark.url))
      } else {
        next.add(mark)
      }
    }
    if (!remove) next.add(ProofMark(kind, start, end))
    block.marks.clear()
    next.filter { it.start < it.end }
      .sortedWith(compareBy<ProofMark> { it.start }.thenBy { it.end }.thenBy { it.kind })
      .forEach { mark ->
        val previous = block.marks.lastOrNull()
        if (previous?.kind == mark.kind && previous.end >= mark.start) {
          previous.end = maxOf(previous.end, mark.end)
        } else {
          block.marks.add(mark)
        }
      }
  }

  private fun clearMarkRange(block: ProofBlock, start: Int, end: Int, kind: String? = null) {
    val next = mutableListOf<ProofMark>()
    block.marks.forEach { mark ->
      if (mark.end <= start || mark.start >= end || (kind != null && mark.kind != kind)) {
        next.add(mark)
      } else {
        if (mark.start < start) next.add(ProofMark(mark.kind, mark.start, start, mark.url))
        if (mark.end > end) next.add(ProofMark(mark.kind, end, mark.end, mark.url))
      }
    }
    block.marks.clear()
    block.marks.addAll(
      next.filter { it.start < it.end }
        .sortedWith(compareBy<ProofMark> { it.start }.thenBy { it.end }.thenBy { it.kind })
    )
  }

  /** Insert a divider after the current cursor/selection and leave the cursor in the following text block. */
  private fun insertDivider() {
    replaceSelection("\n")
    val index = input.text.take(input.selectionStart).count { it == '\n' }
    if (index !in 0..blocks.size) return
    blocks.add(index, ProofBlock(newId(), "divider", DIVIDER_TEXT))
    replaceNativeTextAndSelect(index + 1)
    scheduleEvent("insert-divider")
  }

  /** Insert a table-of-contents block after the current cursor/selection. */
  private fun insertTableOfContents() {
    replaceSelection("\n")
    val index = input.text.take(input.selectionStart).count { it == '\n' }
    if (index !in 0..blocks.size) return
    blocks.add(index, ProofBlock(newId(), "table_of_contents", TABLE_OF_CONTENTS_TEXT))
    replaceNativeTextAndSelect(index + 1)
    scheduleEvent("insert-table-of-contents")
  }

  /** Insert a two-column composite block after the current cursor/selection. */
  private fun insertColumns(columnCount: Int) {
    replaceSelection("\n")
    val index = input.text.take(input.selectionStart).count { it == '\n' }
    if (index !in 0..blocks.size) return
    blocks.add(index, ProofBlock(newId(), "column_list", COLUMNS_TEXT, columnCount = columnCount.coerceIn(2, 5)))
    replaceNativeTextAndSelect(index + 1)
    scheduleEvent("insert-columns")
  }

  /** Insert a media block after the block containing the current cursor. */
  private fun insertMedia(type: String, rawUrl: String?) {
    val url = rawUrl?.trim()?.takeIf { it.isNotEmpty() } ?: return
    replaceSelection("\n")
    val index = input.text.take(input.selectionStart).count { it == '\n' }
    if (index !in 0..blocks.size) return
    blocks.add(index, ProofBlock(newId(), type, "", url = url))
    replaceNativeTextAndSelect(index + 1)
    scheduleEvent("insert-image")
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
    blocks.add(index + 1, ProofBlock(newId(), "text", ""))
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
      blocks.add(index, ProofBlock(newId(), "text", "", depth = block.depth))
      blocks.add(index + 1, ProofBlock(newId(), "text", "", depth = block.depth))
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
    blocks.add(index + 2, ProofBlock(newId(), continuedType, "", depth = block.depth))
    replaceNativeTextAndSelect(index + 2)
    scheduleEvent("divider-split")
    return true
  }

  /**
   * Handle Backspace at the start of a block immediately preceded by a divider: the divider is
   * skipped over -- as though it weren't there -- merging this block into the block before the
   * divider instead, and the divider is left in place immediately after the merged result.
   */
  private fun handleDividerBackspace(): Boolean {
    if (input.selectionStart != input.selectionEnd || blocks.isEmpty()) return false
    val (index, offset) = logicalSelectionPoint(input.selectionStart)
    if (offset != 0) return false
    val dividerIndex = index - 1
    val divider = blocks.getOrNull(dividerIndex) ?: return false
    if (divider.type != "divider") return false
    val beforeIndex = dividerIndex - 1
    val before = blocks.getOrNull(beforeIndex) ?: return false
    val current = blocks[index]
    if (before.type !in proofMergeableBlockTypes || current.type !in proofMergeableBlockTypes) return false

    val joinOffset = before.text.length
    before.marks.addAll(current.marks.map { ProofMark(it.kind, it.start + joinOffset, it.end + joinOffset, it.url) })
    before.text += current.text
    blocks.removeAt(index)
    blocks.removeAt(dividerIndex)
    blocks.add(dividerIndex, divider)
    replaceNativeTextAndSelect(beforeIndex, joinOffset)
    scheduleEvent("divider-backspace")
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
    blocks.add(insertAt, ProofBlock(newId(), "text", "", depth = target.depth))
    replaceNativeTextAndSelect(insertAt)
    scheduleEvent(if (before) "insert-block-above" else "insert-block-below")
  }

  /** Insert a copy of the identified block immediately after it. */
  private fun duplicateBlockById(id: String?) {
    val index = blockIndexById(id) ?: return
    val source = blocks[index]
    val copy = source.copy(id = newId(), marks = source.marks.map { it.copy() }.toMutableList())
    blocks.add(index + 1, copy)
    replaceNativeTextAndSelect(index + 1, copy.text.length)
    scheduleEvent("duplicate-block")
  }

  /** Remove the identified block, matching `removeBlocks()`'s never-empty-document guarantee. */
  private fun deleteBlockById(id: String?) {
    val index = blockIndexById(id) ?: return
    blocks.removeAt(index)
    if (blocks.isEmpty()) blocks.add(ProofBlock(newId(), "text", ""))
    replaceNativeTextAndSelect(index.coerceAtMost(blocks.lastIndex))
    scheduleEvent("delete-block")
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
        if (block.type == "link_to_page" || block.type == "image" || block.type == "video") {
          block.url?.let { item.put("url", it) }
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
    clipboard().setPrimaryClip(ClipData(ClipDescription("Notion document fragment", arrayOf("text/plain", FRAGMENT_MIME)),
      ClipData.Item(plain, null, intent, null)))
    if (cut) replaceSelection("")
    scheduleEvent(if (cut) "structured-cut" else "structured-copy")
    return true
  }

  private fun paste(): Boolean {
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
          require(type in proofValidBlockTypes && !text.contains('\n'))
          val color = if (block.has("color")) block.getString("color").takeIf { it in proofValidColors } else null
          val url = if (block.has("url")) block.getString("url") else null
          val icon = if (block.has("icon")) block.getString("icon") else null
          val columnCount = if (block.has("columnCount")) block.getInt("columnCount") else null
          require(columnCount?.let { type == "column_list" && it in 2..5 } ?: true)
          require((type != "link_to_page" && type != "image" && type != "video") || !url.isNullOrBlank())
          val marks = mutableListOf<ProofMark>()
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
              marks.add(ProofMark(kind, markStart, markEnd, markUrl))
            }
          }
          ProofPasteBlock(
            type,
            text,
            color,
            marks,
            block.optBoolean("checked", false) && type == "to_do",
            url,
            icon,
            columnCount
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
      blocks.add(ProofBlock(newId(), "text", ""))
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
        || block.type !in proofValidBlockTypes || block.color == color) continue
      block.color = color
      changed = true
    }
    if (!changed) return
    styleBlocks()
    scheduleEvent("color")
  }

  private fun offsetOf(index: Int): Int {
    var offset = 0
    for (i in 0 until index) offset += blocks[i].nativeText().length + 1
    return offset
  }

  private fun pointAt(position: Int): Map<String, Any> {
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

  private fun styleBlocks() {
    val editable = input.text
    editable.getSpans(0, editable.length, RelativeSizeSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, StyleSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, LeadingMarginSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, BlockPaddingSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, DividerSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, CalloutBackgroundSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, ProofImageSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, ProofVideoSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, TableOfContentsSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, ColumnsSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, EmptyTogglePlaceholderSpan::class.java).forEach { editable.removeSpan(it) }
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
    editable.getSpans(0, editable.length, ProofInlineMarkSpan::class.java).forEach { editable.removeSpan(it) }
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
        previous?.toggle == true && proofHeadingLevel(previous.type) != null &&
        block.depth == previous.depth + 1 && emptyTogglePlaceholder.isNotEmpty()) {
        editable.setSpan(
          EmptyTogglePlaceholderSpan(emptyTogglePlaceholder),
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
          proofHeadingLevel(block.type) == 1 -> 32
          proofHeadingLevel(block.type) == 2 -> 28
          proofHeadingLevel(block.type) == 3 -> 24
          proofHeadingLevel(block.type) == 4 -> 20
          isListItem && previous?.type == block.type -> 4
          else -> 8
        }
        val blockPaddingBottom = if (isListItem && next?.type == block.type) 4 else 8
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
        if (block.type == "table_of_contents") {
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
          val backgroundColor = block.color?.let { proofBackgroundColors[it] } ?: proofCalloutDefaultBackground(dark)
          editable.setSpan(
            CalloutBackgroundSpan(backgroundColor, start, end),
            start,
            end,
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
          )
          editable.setSpan(
            CalloutIconSpan(
              (input.textSize * CALLOUT_ICON_WIDTH_SCALE).toInt().coerceAtLeast(1),
              block.icon ?: DEFAULT_CALLOUT_ICON
            ),
            start,
            end,
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
          )
        }
        if (block.type == "image") {
          block.url?.let { url ->
            editable.setSpan(
              ProofImageSpan(input, url, imageMaxWidth),
              start,
              end,
              Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
            )
          }
        }
        if (block.type == "video") {
          block.url?.let { url ->
            editable.setSpan(
              ProofVideoSpan(input, url, imageMaxWidth),
              start,
              end,
              Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
            )
          }
        }
        if (block.type == "to_do") {
          editable.setSpan(
            TodoCheckboxSpan(
              (input.textSize * TODO_CHECKBOX_WIDTH_SCALE).toInt().coerceAtLeast(1),
              block.checked,
              proofAccentColor(dark),
              proofCheckboxBorderColor(dark)
            ),
            start,
            end,
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
          )
        }
        if (block.toggle && proofHeadingLevel(block.type) != null) {
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
        proofHeadingLevel(block.type)?.let { level ->
          editable.setSpan(RelativeSizeSpan(headingScale.getValue(level)), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
          editable.setSpan(StyleSpan(Typeface.BOLD), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
        block.color?.let { color ->
          // A callout's `_bg` color instead tints its CalloutBackgroundSpan box above.
          if (block.type != "callout") {
            proofBackgroundColors[color]?.let { editable.setSpan(BackgroundColorSpan(it), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE) }
          }
          proofTextColors[color]?.let { editable.setSpan(ForegroundColorSpan(it), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE) }
        }
        block.marks.forEach { mark ->
          val markStart = (start + mark.start).coerceIn(start, end)
          val markEnd = (start + mark.end).coerceIn(markStart, end)
          if (markStart >= markEnd) return@forEach
          editable.setSpan(ProofInlineMarkSpan(mark.kind, mark.url), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
          when (mark.kind) {
            "bold" -> editable.setSpan(StyleSpan(Typeface.BOLD), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            "italic" -> editable.setSpan(StyleSpan(Typeface.ITALIC), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            "underline" -> editable.setSpan(UnderlineSpan(), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            "strikethrough" -> editable.setSpan(StrikethroughSpan(), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            "link" -> {
              editable.setSpan(ForegroundColorSpan(proofAccentColor(dark)), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
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
          editable.setSpan(ForegroundColorSpan(proofMutedColor(dark)), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
          editable.setSpan(StrikethroughSpan(), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
      }
      if (block.toggle && block.collapsed) collapsedDepth = block.depth
      start = end + 1
    }
  }

  /** Copies Android-adjusted inline marker ranges back into the block transport model. */
  private fun captureInlineMarks() {
    blocks.forEach { it.marks.clear() }
    val editable = input.text
    editable.getSpans(0, editable.length, ProofInlineMarkSpan::class.java).forEach { span ->
      val globalStart = editable.getSpanStart(span)
      val globalEnd = editable.getSpanEnd(span)
      if (globalStart < 0 || globalEnd <= globalStart) return@forEach
      val blockIndex = editable.subSequence(0, globalStart).count { it == '\n' }
      val block = blocks.getOrNull(blockIndex) ?: return@forEach
      val blockStart = if (blockIndex == 0) 0 else editable.subSequence(0, globalStart)
        .toString().lastIndexOf('\n') + 1
      val localStart = (globalStart - blockStart).coerceIn(0, block.text.length)
      val localEnd = (globalEnd - blockStart).coerceIn(localStart, block.text.length)
      if (localStart < localEnd) block.marks.add(ProofMark(span.kind, localStart, localEnd, span.url))
    }
    blocks.forEach { block ->
      block.marks.sortWith(compareBy<ProofMark> { it.start }.thenBy { it.end }.thenBy { it.kind })
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
      onEdit(mapOf(
        "epoch" to epoch, "revision" to revision, "blocks" to blocks.map { it.payload() },
        "anchor" to pointAt(input.selectionStart), "focus" to pointAt(input.selectionEnd),
        "composingStart" to BaseInputConnection.getComposingSpanStart(input.text),
        "composingEnd" to BaseInputConnection.getComposingSpanEnd(input.text), "source" to source
      ))
    }
  }

  private inner class ProofInput(context: Context) : EditText(context) {
    private var pressedToggleBlock = -1
    private var pressedTodoBlock = -1
    private var pressedPageReferenceBlock = -1
    private var pressedDividerBlock = -1

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
          val scale = blocks.getOrNull(blockIndex)?.type?.let(::proofHeadingLevel)
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

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
      super.onSizeChanged(w, h, oldw, oldh)
      if (w != oldw && blocks.any { it.type == "image" || it.type == "video" }) {
        post {
          styleBlocks()
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
      if (!block.toggle || proofHeadingLevel(block.type) == null) return null
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

    override fun onTouchEvent(event: MotionEvent): Boolean {
      val toggleBlock = toggleBlockAt(event)
      val todoBlock = todoBlockAt(event)
      val pageReferenceBlock = pageReferenceBlockAt(event)
      val dividerBlock = dividerBlockAt(event)
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          pressedToggleBlock = toggleBlock ?: -1
          pressedTodoBlock = todoBlock ?: -1
          pressedPageReferenceBlock = pageReferenceBlock ?: -1
          pressedDividerBlock = dividerBlock ?: -1
          if (pressedToggleBlock >= 0) return true
          if (pressedTodoBlock >= 0) return true
          if (pressedPageReferenceBlock >= 0) return true
          if (pressedDividerBlock >= 0) return true
        }
        MotionEvent.ACTION_UP -> {
          val pressed = pressedToggleBlock
          val pressedTodo = pressedTodoBlock
          val pressedPageReference = pressedPageReferenceBlock
          val pressedDivider = pressedDividerBlock
          pressedToggleBlock = -1
          pressedTodoBlock = -1
          pressedPageReferenceBlock = -1
          pressedDividerBlock = -1
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
        }
        MotionEvent.ACTION_CANCEL -> {
          pressedToggleBlock = -1
          pressedTodoBlock = -1
          pressedPageReferenceBlock = -1
          pressedDividerBlock = -1
        }
      }
      return super.onTouchEvent(event)
    }

    override fun onSelectionChanged(start: Int, end: Int) {
      super.onSelectionChanged(start, end)
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
      if (keyCode == KeyEvent.KEYCODE_DEL && handleDividerBackspace()) {
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
          if (beforeLength > 0 && afterLength == 0 && handleDividerBackspace()) return true
          return super.deleteSurroundingText(beforeLength, afterLength)
        }
        override fun deleteSurroundingTextInCodePoints(beforeLength: Int, afterLength: Int): Boolean {
          if (epoch != connectionEpoch) return false
          if (pageReferenceIsSelected()) return true
          if (beforeLength > 0 && afterLength == 0 && handleDividerBackspace()) return true
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
