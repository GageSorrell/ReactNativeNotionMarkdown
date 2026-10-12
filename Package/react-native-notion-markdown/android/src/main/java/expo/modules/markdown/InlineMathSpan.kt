package expo.modules.markdown

import android.content.res.AssetManager
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.text.Layout
import android.text.Spanned
import android.text.StaticLayout
import android.text.TextPaint
import android.text.TextUtils
import android.text.style.LeadingMarginSpan
import android.text.style.ReplacementSpan
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.ceil
import kotlin.math.roundToInt

private const val MATH_LAYOUT_VERSION = 1
private const val MATH_MARGIN_EM = 0.08f
private const val MATH_STROKE_EM = 0.04f
private const val MATH_SOURCE_MIN_FIRST_LINE_CHARACTERS = 4
/** The narrowest horizontal gap a rendered equation may be broken at: just under a thin space. */
private const val MATH_BREAK_GAP_EM = 0.15f
private const val MATH_ROW_GAP_EM = 0.2f
private const val MATH_MEASURE_TEXT_SIZE = 1000f

/** One drawing instruction of a [MathLayout], in em. A null color means "the surrounding text color". */
internal sealed class MathItem {
  class Glyph(val font: String, val text: String, val scale: Float, val x: Float, val y: Float, val color: Int?) : MathItem()

  /** A horizontal rule whose [y] is its vertical center. */
  class Line(val x: Float, val y: Float, val width: Float, val thickness: Float, val color: Int?) : MathItem()

  /** A filled box whose [x]/[y] is its top-left corner. */
  class Rect(val x: Float, val y: Float, val width: Float, val height: Float, val color: Int?) : MathItem()

  /** An outline relative to [x]/[y]; filled, or stroked when [fill] is false. */
  class Outline(val x: Float, val y: Float, val fill: Boolean, val path: Path, val color: Int?) : MathItem()
}

/** A run of a [MathLayout]'s items that a line break may not split, spanning [start, end) in em. */
internal class MathPiece(val start: Float, val end: Float, val items: List<MathItem>)

/**
 * A RaTeX DisplayList (`renderToView` in `react-native-ratex`) parsed into plain drawing items.
 * Every length is in em; the origin is the box's top-left corner and the baseline sits at
 * `y = height`, with [depth] extending below it.
 */
internal class MathLayout(
  val width: Float,
  val height: Float,
  val depth: Float,
  val items: List<MathItem>
) {
  private var pieces: List<MathPiece>? = null

  /**
   * The layout cut into the pieces a line break may fall between, left to right.
   *
   * The DisplayList carries no structure, only positioned ink, so a break is allowed wherever no
   * item is drawn across a gap of at least [MATH_BREAK_GAP_EM]. That is the spacing TeX puts
   * around relations and binary operators; a base and its script, a fraction, or a radical and
   * its radicand leave no such gap and stay whole.
   */
  fun pieces(assets: AssetManager): List<MathPiece> {
    pieces?.let { return it }
    val measure = Paint()
    val pathBounds = RectF()
    val extents = items.map { item ->
      when (item) {
        is MathItem.Glyph -> {
          measure.typeface = MathTypefaces.get(assets, item.font)
          measure.textSize = MATH_MEASURE_TEXT_SIZE
          Triple(item.x, item.x + measure.measureText(item.text) / MATH_MEASURE_TEXT_SIZE * item.scale, item)
        }
        is MathItem.Line -> Triple(item.x, item.x + item.width, item)
        is MathItem.Rect -> Triple(item.x, item.x + item.width, item)
        is MathItem.Outline -> {
          item.path.computeBounds(pathBounds, true)
          Triple(item.x + pathBounds.left, item.x + pathBounds.right, item)
        }
      }
    }.sortedBy { it.first }
    val result = mutableListOf<MathPiece>()
    var start = 0f
    var end = 0f
    var group = mutableListOf<MathItem>()
    extents.forEach { (itemStart, itemEnd, item) ->
      if (group.isNotEmpty() && itemStart >= end + MATH_BREAK_GAP_EM) {
        result.add(MathPiece(start, end, group))
        group = mutableListOf()
      }
      if (group.isEmpty()) {
        start = itemStart
        end = itemEnd
      }
      end = maxOf(end, itemEnd)
      group.add(item)
    }
    if (group.isNotEmpty()) result.add(MathPiece(start, end, group))
    pieces = result
    return result
  }

  companion object {
    /** Parse DisplayList JSON, or return null for malformed input or an unknown version. */
    fun parse(json: String?): MathLayout? = runCatching {
      val root = JSONObject(json ?: return null)
      if (root.getInt("version") != MATH_LAYOUT_VERSION) return null
      val width = root.finite("width")
      val height = root.finite("height")
      val depth = root.finite("depth")
      if (width < 0f || height + depth <= 0f) return null
      val source = root.getJSONArray("items")
      val items = (0 until source.length()).mapNotNull { index -> item(source.getJSONObject(index)) }
      MathLayout(width, height, depth, items)
    }.getOrNull()

    private fun JSONObject.finite(name: String): Float =
      getDouble(name).toFloat().also { require(it.isFinite()) }

    /** RaTeX's default ink is opaque black; anything else was requested with `\color`. */
    private fun color(value: JSONObject?): Int? {
      value ?: return null
      fun channel(name: String): Int = (value.optDouble(name, 0.0).coerceIn(0.0, 1.0) * 255.0).roundToInt()
      val alpha = (value.optDouble("a", 1.0).coerceIn(0.0, 1.0) * 255.0).roundToInt()
      val color = Color.argb(alpha, channel("r"), channel("g"), channel("b"))
      return color.takeIf { it != Color.BLACK }
    }

    private fun item(source: JSONObject): MathItem? {
      val color = color(source.optJSONObject("color"))
      return when (source.getString("type")) {
        "GlyphPath" -> {
          val font = source.getString("font")
          require(font.isNotEmpty() && font.all { it.isLetterOrDigit() || it == '-' })
          MathItem.Glyph(
            font,
            String(Character.toChars(source.getInt("char_code"))),
            source.finite("scale"),
            source.finite("x"),
            source.finite("y"),
            color
          )
        }
        "Line" -> MathItem.Line(
          source.finite("x"), source.finite("y"), source.finite("width"), source.finite("thickness"), color
        )
        "Rect" -> MathItem.Rect(
          source.finite("x"), source.finite("y"), source.finite("width"), source.finite("height"), color
        )
        "Path" -> MathItem.Outline(
          source.finite("x"),
          source.finite("y"),
          source.optBoolean("fill", true),
          path(source.getJSONArray("commands")),
          color
        )
        // An item type from a newer RaTeX is skipped rather than failing the whole equation.
        else -> null
      }
    }

    private fun path(commands: JSONArray): Path {
      val path = Path()
      for (index in 0 until commands.length()) {
        val command = commands.getJSONObject(index)
        when (command.getString("type")) {
          "MoveTo" -> path.moveTo(command.finite("x"), command.finite("y"))
          "LineTo" -> path.lineTo(command.finite("x"), command.finite("y"))
          "QuadTo" -> path.quadTo(
            command.finite("x1"), command.finite("y1"), command.finite("x"), command.finite("y")
          )
          "CubicTo" -> path.cubicTo(
            command.finite("x1"), command.finite("y1"),
            command.finite("x2"), command.finite("y2"),
            command.finite("x"), command.finite("y")
          )
          "Close" -> path.close()
        }
      }
      return path
    }
  }
}

/** What the editor currently knows about an expression's layout. */
internal sealed class MathLayoutState {
  /** JS has not delivered a layout for the expression yet. */
  object Pending : MathLayoutState()

  /** RaTeX rejected the expression. */
  object Invalid : MathLayoutState()

  class Ready(val layout: MathLayout) : MathLayoutState()
}

/** The KaTeX fonts `react-native-ratex` ships in the APK's assets, loaded once each. */
internal object MathTypefaces {
  private val cache = HashMap<String, Typeface?>()

  /** The typeface for a DisplayList font name such as `Math-Italic`, or null when it is missing. */
  fun get(assets: AssetManager, font: String): Typeface? = synchronized(cache) {
    if (!cache.containsKey(font)) {
      cache[font] = runCatching { Typeface.createFromAsset(assets, "fonts/KaTeX_$font.ttf") }.getOrNull()
    }
    cache[font]
  }
}

/** The colors and fallback typeface one [InlineMathSpan] draws with. */
internal class InlineMathColors(
  /** Ink for items RaTeX left at its default color, and for nothing else. */
  val foreground: Int,
  /** Painted behind the equation, standing in for the `BackgroundColorSpan` a replacement hides. */
  val background: Int?,
  val muted: Int,
  val error: Int,
  val monospace: Typeface
)

/** What an [InlineMathSpan] needs to know about the text view it is drawn in. */
internal interface InlineMathHost {
  /** The width of a full line of text, in px; zero when the view has not been measured. */
  fun lineWidth(): Int

  /** The view's base text paint, before any span is applied. */
  fun textPaint(): TextPaint
}

/**
 * Draws one inline equation in place of its `U+FFFC` placeholder character. The paint's text size
 * is the em, so an equation scales with the heading it sits in, and tall math (a fraction) asks
 * for a taller line (see [lineAscent]) instead of overlapping its neighbors.
 *
 * Mirroring `MarkdownMathView`, the LaTeX source is shown instead while the layout has not arrived
 * (monospace, muted) or when RaTeX rejected the expression (error color).
 *
 * Content too long for the rest of its line continues on the following lines, as paragraph text
 * would: source breaks between characters, and a rendered equation between its [MathPiece]s. A
 * replacement span is one unbreakable box, so the paragraph cannot do that wrapping itself.
 * Instead the span works out how much of its line the preceding text leaves free, puts as much
 * there as fits, and continues on full-width rows below, which it draws to the left of its own
 * box. The box claims the rest of its line and grows downward to make room for them.
 */
internal class InlineMathSpan(
  val expression: String,
  private val assets: AssetManager,
  private val colors: InlineMathColors,
  private val host: InlineMathHost,
  private val lookup: (String) -> MathLayoutState
) : ReplacementSpan() {
  private val work = Paint()
  private var flowKey: FlowKey? = null
  private var flow = Flow(0f, 0f, 0)
  private var sourceLines: List<String>? = null
  private var mathRows: List<MathRow>? = null
  private var mathRowsLayout: MathLayout? = null

  /** Everything the room available to this span depends on. */
  private data class FlowKey(val textSize: Float, val lineWidth: Int, val indent: Int, val preceding: String)

  /**
   * The room this span has, in px: [remaining] on the line it starts on, [full] on each line
   * after it, and the paragraph's [indent]. [full] is zero when the view cannot wrap content.
   */
  private class Flow(val remaining: Float, val full: Float, val indent: Int)

  /** One drawn row of a rendered equation: the pieces spanning [start, end) in em. */
  private class MathRow(val start: Float, val end: Float, val items: List<MathItem>)

  /** Forget the wrapping, e.g. after an equation earlier in the paragraph changed width. */
  fun invalidate() {
    flowKey = null
  }

  /**
   * The room the equation needs above and below its line's baseline, in px, as of the last
   * measurement. The span does not widen the line's font metrics itself: the layout carries such
   * a change into the next wrapped line. `BlockPaddingSpan` reads these and makes the room.
   */
  var lineAscent = 0
    private set
  var lineDescent = 0
    private set

  /** Where the equation was last drawn, in the coordinates of the canvas it was drawn on. */
  val bounds = RectF()

  /** The part of wrapped content that is drawn to the left of [bounds], below its first row. */
  private val wrapBounds = RectF()

  /** Whether the equation was last drawn over the given point, for tap hit-testing. */
  fun contains(x: Float, y: Float): Boolean = bounds.contains(x, y) || wrapBounds.contains(x, y)

  /** A copy of the line's paint with every text decoration of the surrounding run removed. */
  private fun workPaint(paint: Paint): Paint {
    work.set(paint)
    work.isAntiAlias = true
    work.isFakeBoldText = false
    work.textSkewX = 0f
    work.isUnderlineText = false
    work.isStrikeThruText = false
    work.style = Paint.Style.FILL
    work.pathEffect = null
    work.shader = null
    return work
  }

  private fun fallbackPaint(paint: Paint): Paint =
    workPaint(paint).apply { typeface = colors.monospace }

  /** Resolve the room available to the span at its position in the text. */
  private fun flow(text: CharSequence, start: Int, end: Int, textSize: Float, margin: Float): Flow {
    val lineWidth = host.lineWidth()
    val indent = (text as? Spanned)?.getSpans(start, end, LeadingMarginSpan::class.java)
      ?.sumOf { maxOf(it.getLeadingMargin(true), it.getLeadingMargin(false)) } ?: 0
    val paragraphStart = TextUtils.lastIndexOf(text, '\n', start - 1) + 1
    val preceding = text.subSequence(paragraphStart, start)
    val key = FlowKey(textSize, lineWidth, indent, preceding.toString())
    if (key == flowKey) return flow
    flowKey = key
    sourceLines = null
    mathRows = null
    val full = lineWidth - indent - margin * 2f - 1f
    flow = if (lineWidth <= 0 || full < textSize) Flow(0f, 0f, indent)
    else Flow(full - precedingWidth(preceding, lineWidth), full, indent)
    return flow
  }

  /**
   * How far into its line the text before this span reaches, found by laying that text out the
   * way the view does. The text carries its own spans, including the block's leading margin.
   */
  private fun precedingWidth(preceding: CharSequence, lineWidth: Int): Float {
    if (preceding.isEmpty()) return 0f
    val layout = StaticLayout.Builder.obtain(preceding, 0, preceding.length, host.textPaint(), lineWidth)
      .setBreakStrategy(Layout.BREAK_STRATEGY_SIMPLE)
      .setHyphenationFrequency(Layout.HYPHENATION_FREQUENCY_NONE)
      .setIncludePad(false)
      .build()
    val last = layout.lineCount - 1
    return layout.getLineWidth(last) - layout.getParagraphLeft(last)
  }

  /** The LaTeX source split into the lines it is drawn on. [paint] is the fallback paint. */
  private fun sourceLines(paint: Paint, flow: Flow): List<String> {
    sourceLines?.let { return it }
    // With too little room left on the line, the source starts on the next one instead.
    val first = flow.remaining
      .takeIf { it >= paint.measureText("0") * MATH_SOURCE_MIN_FIRST_LINE_CHARACTERS } ?: flow.full
    val lines = if (flow.full <= 0f || paint.measureText(expression) <= first) {
      listOf(expression)
    } else {
      val lines = mutableListOf<String>()
      var offset = 0
      while (offset < expression.length) {
        val width = if (lines.isEmpty()) first else flow.full
        var count = paint.breakText(expression, offset, expression.length, true, width, null).coerceAtLeast(1)
        // Prefer a break after a space when the line has one; LaTeX source often has none.
        val space = expression.lastIndexOf(' ', offset + count - 1)
        if (offset + count < expression.length && space > offset) count = space - offset + 1
        lines.add(expression.substring(offset, offset + count))
        offset += count
      }
      lines
    }
    sourceLines = lines
    return lines
  }

  /** The rendered equation split into the rows it is drawn on. */
  private fun mathRows(layout: MathLayout, flow: Flow, em: Float): List<MathRow> {
    mathRows?.takeIf { mathRowsLayout === layout }?.let { return it }
    val whole = listOf(MathRow(0f, layout.width, layout.items))
    val pieces = if (flow.full <= 0f || layout.width * em <= flow.remaining) emptyList() else layout.pieces(assets)
    val rows = if (pieces.size < 2) {
      whole
    } else {
      // A first piece too wide for the rest of the line starts the equation on the next one.
      val first = flow.remaining.takeIf { (pieces.first().end - pieces.first().start) * em <= it } ?: flow.full
      val rows = mutableListOf<MathRow>()
      var index = 0
      while (index < pieces.size) {
        val limit = (if (rows.isEmpty()) first else flow.full) / em
        val rowStart = pieces[index].start
        var last = index
        while (last + 1 < pieces.size && pieces[last + 1].end - rowStart <= limit) last++
        rows.add(MathRow(rowStart, pieces[last].end, pieces.subList(index, last + 1).flatMap { it.items }))
        index = last + 1
      }
      if (rows.size > 1) rows else whole
    }
    mathRows = rows
    mathRowsLayout = layout
    return rows
  }

  /** The distance between the baselines of two wrapped source lines. */
  private fun sourceLineHeight(paint: Paint): Int =
    paint.fontMetricsInt.let { it.descent - it.ascent }

  /** The distance between the baselines of two rows of a wrapped equation. */
  private fun mathRowHeight(layout: MathLayout, em: Float): Int =
    ceil((layout.height + layout.depth + MATH_ROW_GAP_EM) * em).toInt()

  /**
   * The width of the span's box, without its margins. Wrapped content claims the rest of its
   * line, so the text after it starts below the wrapped rows.
   */
  private fun boxWidth(wrapped: Boolean, firstRowWidth: Float, flow: Flow): Float =
    if (!wrapped) firstRowWidth else maxOf(firstRowWidth, flow.remaining)

  override fun getSize(
    paint: Paint,
    text: CharSequence,
    start: Int,
    end: Int,
    fm: Paint.FontMetricsInt?
  ): Int {
    val em = paint.textSize
    val margin = MATH_MARGIN_EM * em
    val state = lookup(expression)
    val flow = flow(text, start, end, em, margin)
    if (state !is MathLayoutState.Ready) {
      val source = fallbackPaint(paint)
      val lines = sourceLines(source, flow)
      val metrics = source.fontMetricsInt
      lineAscent = -metrics.ascent
      lineDescent = metrics.descent + (lines.size - 1) * sourceLineHeight(source)
      return ceil(boxWidth(lines.size > 1, source.measureText(lines.first()), flow) + margin * 2f).toInt()
    }
    val layout = state.layout
    val rows = mathRows(layout, flow, em)
    lineAscent = ceil(layout.height * em).toInt()
    lineDescent = ceil(layout.depth * em).toInt() + (rows.size - 1) * mathRowHeight(layout, em)
    val firstRowWidth = (rows.first().end - rows.first().start) * em
    return ceil(boxWidth(rows.size > 1, firstRowWidth, flow) + margin * 2f).toInt()
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
    val em = paint.textSize
    val margin = MATH_MARGIN_EM * em
    val state = lookup(expression)
    val flow = flow(text, start, end, em, margin)
    val left = x + margin
    // Rows after the first start at the paragraph's left edge, not at the box's.
    val wrapLeft = flow.indent + margin
    if (state !is MathLayoutState.Ready) {
      val work = fallbackPaint(paint)
      val lines = sourceLines(work, flow)
      val width = boxWidth(lines.size > 1, work.measureText(lines.first()), flow)
      drawBox(canvas, x, top, bottom, width + margin * 2f, lines.size > 1, flow, y + work.fontMetrics.descent)
      work.color = if (state is MathLayoutState.Invalid) colors.error else colors.muted
      val lineHeight = sourceLineHeight(work)
      lines.forEachIndexed { index, line ->
        canvas.drawText(line, if (index == 0) left else wrapLeft, y.toFloat() + index * lineHeight, work)
      }
      return
    }
    val work = workPaint(paint)
    val layout = state.layout
    val rows = mathRows(layout, flow, em)
    val width = boxWidth(rows.size > 1, (rows.first().end - rows.first().start) * em, flow)
    drawBox(canvas, x, top, bottom, width + margin * 2f, rows.size > 1, flow, y + layout.depth * em)
    val rowHeight = mathRowHeight(layout, em)
    rows.forEachIndexed { index, row ->
      val rowLeft = (if (index == 0) left else wrapLeft) - row.start * em
      drawItems(canvas, row.items, rowLeft, y + index * rowHeight - layout.height * em, em, paint)
    }
  }

  /** Record where the span is drawn for hit-testing, and paint its background. */
  private fun drawBox(
    canvas: Canvas,
    x: Float,
    top: Int,
    bottom: Int,
    width: Float,
    wrapped: Boolean,
    flow: Flow,
    firstRowBottom: Float
  ) {
    bounds.set(x, top.toFloat(), x + ceil(width), bottom.toFloat())
    if (wrapped) {
      wrapBounds.set(flow.indent.toFloat(), firstRowBottom, x, bottom.toFloat())
    } else {
      wrapBounds.setEmpty()
    }
    colors.background?.let {
      work.color = it
      canvas.drawRect(bounds, work)
      if (wrapped) canvas.drawRect(wrapBounds, work)
    }
  }

  /** Draw layout items with the layout's origin at ([left], [boxTop]). */
  private fun drawItems(canvas: Canvas, items: List<MathItem>, left: Float, boxTop: Float, em: Float, paint: Paint) {
    items.forEach { item ->
      when (item) {
        is MathItem.Glyph -> {
          work.style = Paint.Style.FILL
          work.color = item.color ?: colors.foreground
          work.typeface = MathTypefaces.get(assets, item.font) ?: paint.typeface
          work.textSize = item.scale * em
          canvas.drawText(item.text, left + item.x * em, boxTop + item.y * em, work)
        }
        is MathItem.Line -> {
          work.style = Paint.Style.FILL
          work.color = item.color ?: colors.foreground
          val lineTop = boxTop + (item.y - item.thickness / 2f) * em
          canvas.drawRect(
            left + item.x * em,
            lineTop,
            left + (item.x + item.width) * em,
            lineTop + item.thickness * em,
            work
          )
        }
        is MathItem.Rect -> {
          work.style = Paint.Style.FILL
          work.color = item.color ?: colors.foreground
          canvas.drawRect(
            left + item.x * em,
            boxTop + item.y * em,
            left + (item.x + item.width) * em,
            boxTop + (item.y + item.height) * em,
            work
          )
        }
        is MathItem.Outline -> {
          work.color = item.color ?: colors.foreground
          if (item.fill) {
            work.style = Paint.Style.FILL
          } else {
            work.style = Paint.Style.STROKE
            work.strokeWidth = MATH_STROKE_EM
            work.strokeCap = Paint.Cap.ROUND
            work.strokeJoin = Paint.Join.ROUND
          }
          // The outline is stored in em, so the canvas is scaled rather than the path rebuilt.
          val saved = canvas.save()
          canvas.translate(left + item.x * em, boxTop + item.y * em)
          canvas.scale(em, em)
          canvas.drawPath(item.path, work)
          canvas.restoreToCount(saved)
        }
      }
    }
  }
}
