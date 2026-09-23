package expo.modules.markdown

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.view.MotionEvent
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import kotlin.math.abs

private const val HANDLE_RADIUS_DP = 6f
private const val HIT_SLOP_DP = 24f
private const val AUTO_SCROLL_ZONE_DP = 48f

/**
 * Draws and drags the cross-field selection handles once the active selection spans more
 * than one [MarkdownTextFieldView]. Selection confined to one field keeps using that field's
 * own native handles; this overlay only takes over for the multi-field case, matching "native
 * text handles within one field and coordinator-owned handles/highlights when selection
 * crosses fields" from the editing architecture.
 *
 * This view is a transparent, non-clickable sibling positioned by the host over the scrollable
 * list of fields. Actual scrolling stays with the RN-owned list: this view only requests it via
 * [onAutoScroll] while a handle is dragged near its top or bottom edge.
 */
class MarkdownSelectionOverlayView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true
  private val onSelectionChange by EventDispatcher()
  private val onAutoScroll by EventDispatcher()

  private var sessionId = ""
  private var anchor: Map<String, Any?>? = null
  private var focus: Map<String, Any?>? = null
  private var dragging: String? = null
  private var dark = false
  private val density = resources.displayMetrics.density
  private val handlePaint = Paint(Paint.ANTI_ALIAS_FLAG)

  init {
    setWillNotDraw(false)
    isClickable = false
  }

  fun setSessionId(value: String) {
    sessionId = value
  }

  @Suppress("UNCHECKED_CAST")
  fun setSelection(value: Map<String, Any?>?) {
    anchor = value?.get("anchor") as? Map<String, Any?>
    focus = value?.get("focus") as? Map<String, Any?>
    invalidate()
  }

  fun setDark(value: Boolean) {
    dark = value
    invalidate()
  }

  private fun fieldFor(point: Map<String, Any?>?): MarkdownTextFieldView? {
    val blockId = point?.get("blockId") as? String ?: return null
    val fieldName = point["field"] as? String ?: return null
    val index = (point["index"] as? Number)?.toInt()
    return MarkdownEditorCoordinator.find(sessionId, blockId, fieldName, index)
  }

  private fun screenPointFor(point: Map<String, Any?>?): FloatArray? {
    val field = fieldFor(point) ?: return null
    val offset = (point?.get("offset") as? Number)?.toInt() ?: return null
    return field.screenPointForOffset(offset)
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val currentAnchor = anchor
    val currentFocus = focus
    if (currentAnchor == null || currentFocus == null) return
    val origin = IntArray(2)
    getLocationOnScreen(origin)
    handlePaint.color = if (dark) Color.rgb(90, 160, 250) else Color.rgb(24, 119, 242)
    for (point in listOf(currentAnchor, currentFocus)) {
      val screen = screenPointFor(point) ?: continue
      canvas.drawCircle(screen[0] - origin[0], screen[1] - origin[1], HANDLE_RADIUS_DP * density, handlePaint)
    }
  }

  private fun nearestHandle(localX: Float, localY: Float, origin: IntArray): String? {
    val slop = HIT_SLOP_DP * density
    for ((name, point) in listOf("anchor" to anchor, "focus" to focus)) {
      val screen = screenPointFor(point) ?: continue
      val x = screen[0] - origin[0]
      val y = screen[1] - origin[1]
      if (abs(localX - x) <= slop && abs(localY - y) <= slop) return name
    }
    return null
  }

  private fun requestAutoScrollIfNeeded(localY: Float) {
    val zone = AUTO_SCROLL_ZONE_DP * density
    val payload: Map<String, Any>? = when {
      localY < zone -> mapOf("direction" to "up", "proximity" to (1f - localY / zone).coerceIn(0f, 1f))
      localY > height - zone -> mapOf(
        "direction" to "down",
        "proximity" to ((localY - (height - zone)) / zone).coerceIn(0f, 1f)
      )
      else -> null
    }
    payload?.let { onAutoScroll(it) }
  }

  override fun onTouchEvent(event: MotionEvent): Boolean {
    val origin = IntArray(2)
    getLocationOnScreen(origin)
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        dragging = nearestHandle(event.x, event.y, origin)
        return dragging != null
      }
      MotionEvent.ACTION_MOVE -> {
        val handle = dragging ?: return false
        val screenX = event.x + origin[0]
        val screenY = event.y + origin[1]
        val field = MarkdownEditorCoordinator.hitTest(sessionId, screenX, screenY) ?: return true
        val offset = field.offsetForScreenPoint(screenX, screenY)
        val point = mutableMapOf<String, Any?>(
          "blockId" to field.blockIdValue(),
          "field" to field.fieldNameValue(),
          "offset" to offset
        )
        field.fieldIndexValue()?.let { point["index"] = it }
        if (handle == "anchor") anchor = point else focus = point
        invalidate()
        requestAutoScrollIfNeeded(event.y)
        val currentAnchor = anchor
        val currentFocus = focus
        if (currentAnchor != null && currentFocus != null) {
          onSelectionChange(mapOf("anchor" to currentAnchor, "focus" to currentFocus))
        }
        return true
      }
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
        val wasDragging = dragging != null
        dragging = null
        return wasDragging
      }
    }
    return false
  }
}
