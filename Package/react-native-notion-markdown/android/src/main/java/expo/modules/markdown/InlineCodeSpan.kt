package expo.modules.markdown

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.text.style.ReplacementSpan
import kotlin.math.ceil

private const val INLINE_CODE_PADDING_DP = 4f
private const val INLINE_CODE_MARGIN_DP = 4f
private const val INLINE_CODE_RADIUS_DP = 4f
private const val INLINE_CODE_BACKGROUND_VERTICAL_EXTENSION_DP = 2f
private const val INLINE_CODE_FONT_SIZE_REDUCTION = 3f

/**
 * Draws inline code with the same colors, font-size reduction, padding, and corner radius as the
 * React Native renderer. A ReplacementSpan is used so the background can extend visually beyond
 * the glyphs without contributing its padding or vertical extension to line metrics. The external
 * horizontal margin is reserved in the span width so adjacent text has the requested separation.
 */
internal class InlineCodeSpan(
  private val backgroundColor: Int,
  private val foregroundColor: Int,
  private val padding: Float,
  private val margin: Float,
  private val fontSizeReduction: Float,
  private val cornerRadius: Float,
  private val backgroundVerticalExtension: Float
) : ReplacementSpan() {
  override fun getSize(
    paint: Paint,
    text: CharSequence,
    start: Int,
    end: Int,
    fm: Paint.FontMetricsInt?
  ): Int {
    val previousTextSize = paint.textSize
    paint.textSize = (previousTextSize - fontSizeReduction).coerceAtLeast(1f)
    val textWidth = paint.measureText(text, start, end)
    paint.textSize = previousTextSize
    return ceil(textWidth + margin * 2f).toInt()
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
    val previousTextSize = paint.textSize
    paint.textSize = (previousTextSize - fontSizeReduction).coerceAtLeast(1f)
    val textWidth = paint.measureText(text, start, end)
    val previousColor = paint.color
    val previousStyle = paint.style
    val textX = x + margin
    paint.color = backgroundColor
    paint.style = Paint.Style.FILL
    canvas.drawRoundRect(
      textX - padding,
      top.toFloat() - backgroundVerticalExtension,
      textX + textWidth + padding,
      bottom.toFloat() + backgroundVerticalExtension,
      cornerRadius,
      cornerRadius,
      paint
    )
    paint.color = previousColor
    paint.style = previousStyle
    paint.color = foregroundColor
    canvas.drawText(text, start, end, textX, y.toFloat(), paint)
    paint.color = previousColor
    paint.textSize = previousTextSize
  }
}

/** Creates the inline-code span from the theme's inline-code colors, matching the renderer. */
internal fun inlineCodeSpan(context: Context, theme: EditorTheme): InlineCodeSpan {
  val density = context.resources.displayMetrics.density
  return InlineCodeSpan(
    backgroundColor = theme.inlineCodeBackground,
    foregroundColor = theme.inlineCodeForeground,
    padding = INLINE_CODE_PADDING_DP * density,
    margin = INLINE_CODE_MARGIN_DP * density,
    fontSizeReduction = INLINE_CODE_FONT_SIZE_REDUCTION,
    cornerRadius = INLINE_CODE_RADIUS_DP * density,
    backgroundVerticalExtension = INLINE_CODE_BACKGROUND_VERTICAL_EXTENSION_DP * density
  )
}

/** The default inline-code foreground, used by `MarkdownTextFieldView`, which is not themed. */
internal val INLINE_CODE_FOREGROUND: Int = EditorTheme.DEFAULT.inlineCodeForeground

/** Creates the inline-code span with the default theme's colors, for `MarkdownTextFieldView`. */
internal fun inlineCodeSpan(context: Context): InlineCodeSpan = inlineCodeSpan(context, EditorTheme.DEFAULT)
