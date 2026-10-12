package expo.modules.markdown

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.os.Handler
import android.os.Looper
import android.text.Spanned
import android.text.TextPaint
import android.text.style.CharacterStyle
import android.text.style.MetricAffectingSpan
import android.text.style.ReplacementSpan
import java.net.HttpURLConnection
import java.net.URL
import java.text.BreakIterator
import java.util.concurrent.Executors
import kotlin.math.ceil

private const val LINK_ICON_GAP_EM = 0.3f
private const val LINK_ICON_FALLBACK = "↗"
private const val LINK_ICON_TIMEOUT_MS = 5000
private const val LINK_ICON_MAX_PAGE_BYTES = 256 * 1024
private const val LINK_ICON_MAX_CLUSTER_LENGTH = 32

/**
 * Downloads and remembers the favicon of each linked page, the way the React Native renderer's
 * `resolveFaviconUrl` finds it: the first icon the page declares, else its origin's `/favicon.ico`.
 * A page with no usable favicon is remembered as such. Everything but [fetch] runs on the main thread.
 */
internal object LinkFavicons {
  private val executor = Executors.newFixedThreadPool(2)
  private val main = Handler(Looper.getMainLooper())
  private val resolved = HashMap<String, Bitmap?>()
  private val waiting = HashMap<String, MutableList<(Bitmap?) -> Unit>>()
  private val linkTag = Regex("<link\\b[^>]*>", RegexOption.IGNORE_CASE)
  private val relAttribute = Regex("\\brel\\s*=\\s*[\"']([^\"']+)[\"']", RegexOption.IGNORE_CASE)
  private val hrefAttribute = Regex("\\bhref\\s*=\\s*[\"']([^\"']+)[\"']", RegexOption.IGNORE_CASE)
  private val iconRelations = setOf("icon", "shortcut", "apple-touch-icon")

  /** The favicon of [url]; null while it is loading or when the page has none. */
  fun get(url: String): Bitmap? = resolved[url]

  /**
   * Start loading the favicon of [url] unless that already finished, in which case this returns
   * false. Otherwise [onLoaded] is later called once with the favicon, or null when there is none.
   */
  fun load(url: String, onLoaded: (Bitmap?) -> Unit): Boolean {
    if (resolved.containsKey(url)) return false
    waiting[url]?.let {
      it.add(onLoaded)
      return true
    }
    waiting[url] = mutableListOf(onLoaded)
    executor.execute {
      val bitmap = runCatching { fetch(url) }.getOrNull()
      main.post {
        resolved[url] = bitmap
        waiting.remove(url)?.forEach { it(bitmap) }
      }
    }
    return true
  }

  private fun open(url: URL): HttpURLConnection = (url.openConnection() as HttpURLConnection).apply {
    connectTimeout = LINK_ICON_TIMEOUT_MS
    readTimeout = LINK_ICON_TIMEOUT_MS
  }

  /** The first favicon the page at [page] declares in a `<link>` element. */
  private fun declaredIcon(page: URL): URL? {
    val connection = open(page)
    try {
      if (connection.responseCode !in 200..299) return null
      val buffer = ByteArray(LINK_ICON_MAX_PAGE_BYTES)
      var length = 0
      connection.inputStream.use { stream ->
        while (length < buffer.size) {
          val read = stream.read(buffer, length, buffer.size - length)
          if (read < 0) break
          length += read
        }
      }
      // Relative hrefs resolve against the page that answered, which a redirect may have changed.
      val base = connection.url
      return linkTag.findAll(String(buffer, 0, length, Charsets.UTF_8)).firstNotNullOfOrNull { tag ->
        val rel = relAttribute.find(tag.value)?.groupValues?.get(1).orEmpty()
        if (rel.split(Regex("\\s+")).none { it.lowercase() in iconRelations }) return@firstNotNullOfOrNull null
        val href = hrefAttribute.find(tag.value)?.groupValues?.get(1) ?: return@firstNotNullOfOrNull null
        runCatching { URL(base, href) }.getOrNull()?.takeIf { it.protocol == "http" || it.protocol == "https" }
      }
    } finally {
      connection.disconnect()
    }
  }

  private fun bitmap(url: URL): Bitmap? {
    val connection = open(url)
    try {
      if (connection.responseCode !in 200..299) return null
      return connection.inputStream.use { BitmapFactory.decodeStream(it) }
    } finally {
      connection.disconnect()
    }
  }

  private fun fetch(pageUrl: String): Bitmap? {
    val page = URL(pageUrl)
    if (page.protocol != "http" && page.protocol != "https") return null
    val declared = runCatching { declaredIcon(page) }.getOrNull()
    return bitmap(declared ?: URL(page.protocol, page.host, page.port, "/favicon.ico"))
  }
}

/** The end of the grapheme at [start]: the part of a link's text its [LinkIconSpan] is set on. */
internal fun linkIconEnd(text: CharSequence, start: Int, end: Int): Int {
  val head = text.subSequence(start, minOf(end, start + LINK_ICON_MAX_CLUSTER_LENGTH)).toString()
  val clusters = BreakIterator.getCharacterInstance()
  clusters.setText(head)
  val length = clusters.next()
  return if (length == BreakIterator.DONE) end else start + length
}

/**
 * Prepends a link's icon to its text, as the React Native renderer does: the linked page's favicon
 * at the size of the text, or the renderer's `↗` text fallback in [color] while there is none.
 *
 * Nothing but a replacement can make room inside a line of text, so the span is set on the link's
 * first grapheme and draws the icon followed by that grapheme. A replacement is drawn without the
 * run's appearance spans (color, underline, strikethrough, background), so they are applied here.
 * The icon's box is the same size with or without a favicon, so one arriving never moves text.
 */
internal class LinkIconSpan(
  val url: String,
  private val color: Int
) : ReplacementSpan() {
  private val work = TextPaint()
  private val bitmapPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
  private val rect = RectF()

  override fun getSize(
    paint: Paint,
    text: CharSequence,
    start: Int,
    end: Int,
    fm: Paint.FontMetricsInt?
  ): Int {
    fm?.let { paint.getFontMetricsInt(it) }
    return ceil(paint.textSize * (1f + LINK_ICON_GAP_EM) + paint.measureText(text, start, end)).toInt()
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
    val size = paint.textSize
    val textX = x + size * (1f + LINK_ICON_GAP_EM)
    work.set(paint)
    work.bgColor = 0
    // The metric-affecting spans (size, weight, typeface) are already part of `paint`.
    (text as? Spanned)?.getSpans(start, end, CharacterStyle::class.java)?.forEach {
      if (it !is MetricAffectingSpan) it.updateDrawState(work)
    }
    if (work.bgColor != 0) {
      val textColor = work.color
      work.color = work.bgColor
      work.style = Paint.Style.FILL
      canvas.drawRect(x, top.toFloat(), textX + work.measureText(text, start, end), bottom.toFloat(), work)
      work.color = textColor
    }
    canvas.drawText(text, start, end, textX, y.toFloat(), work)

    val metrics = paint.fontMetrics
    val centerY = y + (metrics.ascent + metrics.descent) / 2f
    val favicon = LinkFavicons.get(url)
    if (favicon != null) {
      rect.set(x, centerY - size / 2f, x + size, centerY + size / 2f)
      canvas.drawBitmap(favicon, null, rect, bitmapPaint)
      return
    }
    work.set(paint)
    work.color = color
    work.isFakeBoldText = false
    work.textSkewX = 0f
    work.isUnderlineText = false
    work.isStrikeThruText = false
    canvas.drawText(LINK_ICON_FALLBACK, x + (size - work.measureText(LINK_ICON_FALLBACK)) / 2f, y.toFloat(), work)
  }
}
