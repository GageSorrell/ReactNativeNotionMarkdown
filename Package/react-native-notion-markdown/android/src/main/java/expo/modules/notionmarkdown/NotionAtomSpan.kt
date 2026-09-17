package expo.modules.notionmarkdown

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.text.style.ReplacementSpan

/**
 * Renders one atomic inline element (mention, citation, custom emoji, or equation) as a
 * single-unit pill. The underlying character is always the single U+FFFC placeholder that
 * `document/fields.ts` writes into the field's text, so caret movement, selection, and
 * deletion are atomic by construction: Android already treats one UTF-16 code unit as one
 * step, with no custom boundary-guarding logic required here.
 *
 * [item] is the opaque rich-text payload the field received this atom with (a decoded JSON
 * object), carried verbatim so an untouched atom round-trips back to JS unchanged.
 */
class NotionAtomSpan(
  val atomKind: String,
  val label: String,
  val item: Map<String, Any?>?,
  private val dark: Boolean
) : ReplacementSpan() {
  companion object {
    private const val HORIZONTAL_PADDING_PX = 10f
    private const val CORNER_RADIUS_PX = 8f
  }

  private fun displayLabel(): String = label.ifEmpty {
    when (atomKind) {
      "equation" -> "∑"
      "emoji" -> ":emoji:"
      else -> atomKind
    }
  }

  override fun getSize(paint: Paint, text: CharSequence?, start: Int, end: Int, fm: Paint.FontMetricsInt?): Int {
    val width = paint.measureText(displayLabel()) + HORIZONTAL_PADDING_PX * 2
    if (fm != null) {
      val original = paint.fontMetricsInt
      fm.ascent = original.ascent
      fm.descent = original.descent
      fm.top = original.top
      fm.bottom = original.bottom
    }
    return width.toInt()
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
    val display = displayLabel()
    val width = paint.measureText(display) + HORIZONTAL_PADDING_PX * 2
    val background = Paint(paint)
    background.style = Paint.Style.FILL
    background.color = if (dark) 0x33FFFFFF.toInt() else 0x1F000000
    val rect = RectF(x, top.toFloat(), x + width, bottom.toFloat())
    canvas.drawRoundRect(rect, CORNER_RADIUS_PX, CORNER_RADIUS_PX, background)
    val textPaint = Paint(paint)
    textPaint.color = if (dark) 0xFFEEEEEE.toInt() else 0xFF262626.toInt()
    canvas.drawText(display, x + HORIZONTAL_PADDING_PX, y.toFloat(), textPaint)
  }
}
