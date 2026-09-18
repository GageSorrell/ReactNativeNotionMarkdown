package expo.modules.notionmarkdown

import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Rect
import android.graphics.Typeface
import android.text.Editable
import android.text.InputType
import android.text.Spanned
import android.text.TextWatcher
import android.text.style.ForegroundColorSpan
import android.text.style.StrikethroughSpan
import android.text.style.StyleSpan
import android.text.style.TypefaceSpan
import android.text.style.UnderlineSpan
import android.view.Gravity
import android.view.KeyEvent
import android.view.inputmethod.BaseInputConnection
import android.view.inputmethod.CompletionInfo
import android.view.inputmethod.CorrectionInfo
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.view.inputmethod.InputConnectionWrapper
import android.view.inputmethod.InputMethodManager
import android.view.inputmethod.TextAttribute
import android.widget.EditText
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import org.json.JSONArray
import org.json.JSONObject

private const val FIELD_FRAGMENT_MIME = "application/vnd.react-native-notion-markdown.field+json"

private val markColors: Map<String, Int> = mapOf(
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

/**
 * One editable rich-text field: a single block's `rich_text`, `caption`, or table `cell`,
 * never a whole document. This supersedes the milestone-one [NotionProofView] shared buffer
 * with the multi-field architecture described for milestone four: many of these mount
 * simultaneously (one per editable field currently on screen), and [NotionEditorCoordinator]
 * tracks them by session for cross-field navigation and selection.
 *
 * Structural operations this field cannot resolve alone -- Enter, Backspace at the start,
 * Delete at the end, and vertical arrows at an edge line -- are reported as boundary events
 * instead of handled locally, so the real command layer decides list continuation, merges,
 * and cross-block navigation. Atomic inline elements (mentions, citations, custom emoji,
 * equations) occupy exactly one `NOTION_ATOM_PLACEHOLDER` character, so Android's ordinary
 * per-codepoint caret and delete behavior is already atomic for them.
 *
 * IME safety reuses the epoch-guarded [InputConnectionWrapper] pattern proven in
 * [NotionProofView]: every connection method rejects once its captured epoch is stale, so an
 * in-flight composition from a replaced document can never leak back into the new one.
 */
class NotionTextFieldView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true
  private val onEdit by EventDispatcher()
  private val onBoundary by EventDispatcher()
  private val onFieldFocus by EventDispatcher()
  private val onFieldBlur by EventDispatcher()

  private val input = FieldInput(context)
  private var sessionId = ""
  private var registered = false
  var fieldOrder = 0
    private set
  private var blockId = ""
  private var fieldName = "rich_text"
  private var fieldIndex: Int? = null
  private var dark = false
  private var epoch = -1
  private var revision = 0
  private var lastCommandId = -1
  private var applying = false
  private var emissionPending = false
  private var source = "selection"
  private var keyboardRequestPending = false
  private var keyboardShowAttempts = 0
  private val showKeyboardRunnable = Runnable { showKeyboardWhenReady() }

  init {
    input.gravity = Gravity.TOP or Gravity.START
    input.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES or InputType.TYPE_TEXT_FLAG_AUTO_CORRECT
    input.imeOptions = EditorInfo.IME_FLAG_NO_EXTRACT_UI or EditorInfo.IME_ACTION_NEXT
    input.setTextSize(16f)
    // Added as `extra` (px), not a `multiplier`, so the extra room is excluded from the caret's
    // height the way Android excludes lineSpacingExtra but not lineSpacingMultiplier -- a
    // multiplier scales the line's real ascent/descent, which the caret is drawn from too.
    val naturalLineHeight = input.paint.fontMetrics.let { it.descent - it.ascent }
    input.setLineSpacing(naturalLineHeight * 0.125f, 1f)
    input.setPadding(0, 0, 0, 0)
    input.setBackgroundColor(Color.TRANSPARENT)
    addView(input, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
    input.addTextChangedListener(object : TextWatcher {
      override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) { }

      override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
        if (applying) return
        val inserted = s?.subSequence(start, start + count) ?: ""
        val newlineOffset = inserted.indexOf('\n')
        if (newlineOffset >= 0) {
          val at = start + newlineOffset
          applying = true
          input.text.delete(at, at + 1)
          input.setSelection(at)
          applying = false
          emitBoundary("enter", at)
          return
        }
        scheduleEvent("text")
      }

      override fun afterTextChanged(s: Editable?) { }
    })
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (sessionId.isNotEmpty() && !registered) {
      NotionEditorCoordinator.register(sessionId, this)
      registered = true
    }
    if (keyboardRequestPending) input.post(showKeyboardRunnable)
  }

  override fun onDetachedFromWindow() {
    keyboardRequestPending = false
    keyboardShowAttempts = 0
    input.removeCallbacks(showKeyboardRunnable)
    if (registered) {
      NotionEditorCoordinator.unregister(sessionId, this)
      registered = false
    }
    super.onDetachedFromWindow()
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

  fun blockIdValue() = blockId
  fun fieldNameValue() = fieldName
  fun fieldIndexValue() = fieldIndex

  /** The on-screen point (screen coordinates) for a UTF-16 offset within this field's text. */
  fun screenPointForOffset(offset: Int): FloatArray {
    val clamped = offset.coerceIn(0, input.text.length)
    val layout = input.layout
    val origin = IntArray(2)
    input.getLocationOnScreen(origin)
    if (layout == null) return floatArrayOf(origin[0].toFloat(), origin[1].toFloat())
    val line = layout.getLineForOffset(clamped)
    val x = layout.getPrimaryHorizontal(clamped)
    val y = layout.getLineBaseline(line).toFloat()
    return floatArrayOf(origin[0] + x, origin[1] + y)
  }

  /** The UTF-16 offset within this field's text nearest a screen point. */
  fun offsetForScreenPoint(screenX: Float, screenY: Float): Int {
    val layout = input.layout ?: return input.text.length
    val origin = IntArray(2)
    input.getLocationOnScreen(origin)
    val localX = screenX - origin[0]
    val localY = screenY - origin[1]
    val line = layout.getLineForVertical(localY.toInt()).coerceIn(0, layout.lineCount - 1)
    return layout.getOffsetForHorizontal(line, localX).coerceIn(0, input.text.length)
  }

  fun setField(value: Map<String, Any?>) {
    val nextSession = value["sessionId"] as? String ?: return
    val nextBlockId = value["blockId"] as? String ?: return
    val nextEpoch = (value["epoch"] as? Number)?.toInt() ?: return
    fieldOrder = (value["order"] as? Number)?.toInt() ?: 0
    blockId = nextBlockId
    fieldName = value["field"] as? String ?: "rich_text"
    fieldIndex = (value["index"] as? Number)?.toInt()

    if (nextSession != sessionId) {
      if (registered) NotionEditorCoordinator.unregister(sessionId, this)
      sessionId = nextSession
      registered = false
      if (isAttachedToWindow) {
        NotionEditorCoordinator.register(sessionId, this)
        registered = true
      }
    }

    // Same-epoch props are acknowledgements; never reset the buffer, especially mid-composition.
    if (nextEpoch <= epoch) return
    val text = value["text"] as? String ?: ""
    val marks = value["marks"] as? List<*> ?: emptyList<Any?>()
    applying = true
    epoch = nextEpoch
    revision = (value["revision"] as? Number)?.toInt() ?: 0
    BaseInputConnection.removeComposingSpans(input.text)
    input.setText(text)
    applyMarks(marks)
    input.setSelection(text.length)
    applying = false
    if (input.hasFocus()) inputMethodManager().restartInput(input)
  }

  fun setDark(value: Boolean) {
    dark = value
    input.setTextColor(if (dark) Color.rgb(238, 238, 238) else Color.rgb(44, 44, 43))
    input.setHintTextColor(if (dark) Color.LTGRAY else Color.DKGRAY)
  }

  fun command(value: Map<String, Any?>) {
    val commandEpoch = (value["epoch"] as? Number)?.toInt() ?: return
    val id = (value["id"] as? Number)?.toInt() ?: return
    if (commandEpoch != epoch || id <= lastCommandId) return
    lastCommandId = id
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
      "setSelection" -> {
        val selection = value["selection"] as? Map<*, *> ?: return
        val start = (selection["start"] as? Number)?.toInt() ?: return
        val end = (selection["end"] as? Number)?.toInt() ?: start
        input.setSelection(start.coerceIn(0, input.text.length), end.coerceIn(0, input.text.length))
      }
      "copy" -> copy(false)
      "cut" -> copy(true)
      "paste" -> paste()
    }
  }

  private fun inputMethodManager() = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
  private fun clipboard() = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager

  private fun clearMarkSpans() {
    val editable = input.text
    editable.getSpans(0, editable.length, StyleSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, UnderlineSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, StrikethroughSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, TypefaceSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, ForegroundColorSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, InlineCodeSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, NotionAtomSpan::class.java).forEach { editable.removeSpan(it) }
  }

  private fun applyMarks(marks: List<*>) {
    clearMarkSpans()
    val editable = input.text
    marks.forEach { raw ->
      val mark = raw as? Map<*, *> ?: return@forEach
      val start = (mark["start"] as? Number)?.toInt() ?: return@forEach
      val end = (mark["end"] as? Number)?.toInt() ?: return@forEach
      if (start < 0 || end > editable.length || start >= end) return@forEach
      when (mark["kind"]) {
        "bold" -> editable.setSpan(StyleSpan(Typeface.BOLD), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        "italic" -> editable.setSpan(StyleSpan(Typeface.ITALIC), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        "underline" -> editable.setSpan(UnderlineSpan(), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        "strikethrough" -> editable.setSpan(StrikethroughSpan(), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        "code" -> {
          editable.setSpan(TypefaceSpan("monospace"), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
          editable.setSpan(ForegroundColorSpan(INLINE_CODE_FOREGROUND), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
          editable.setSpan(inlineCodeSpan(context), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
        "color" -> markColors[mark["color"] as? String]?.let {
          editable.setSpan(ForegroundColorSpan(it), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
        "atom" -> {
          val atomKind = mark["atomKind"] as? String ?: "mention"
          val label = mark["label"] as? String ?: ""
          @Suppress("UNCHECKED_CAST")
          val item = mark["item"] as? Map<String, Any?>
          editable.setSpan(NotionAtomSpan(atomKind, label, item, dark), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
      }
    }
  }

  private fun serializeMarks(): List<Map<String, Any?>> {
    val editable = input.text
    val result = mutableListOf<Map<String, Any?>>()
    editable.getSpans(0, editable.length, StyleSpan::class.java).forEach {
      val kind = if (it.style == Typeface.BOLD) "bold" else "italic"
      result.add(mapOf("kind" to kind, "start" to editable.getSpanStart(it), "end" to editable.getSpanEnd(it)))
    }
    editable.getSpans(0, editable.length, UnderlineSpan::class.java).forEach {
      result.add(mapOf("kind" to "underline", "start" to editable.getSpanStart(it), "end" to editable.getSpanEnd(it)))
    }
    editable.getSpans(0, editable.length, StrikethroughSpan::class.java).forEach {
      result.add(mapOf("kind" to "strikethrough", "start" to editable.getSpanStart(it), "end" to editable.getSpanEnd(it)))
    }
    editable.getSpans(0, editable.length, TypefaceSpan::class.java).forEach {
      result.add(mapOf("kind" to "code", "start" to editable.getSpanStart(it), "end" to editable.getSpanEnd(it)))
    }
    editable.getSpans(0, editable.length, ForegroundColorSpan::class.java).forEach { span ->
      if (span.foregroundColor == INLINE_CODE_FOREGROUND) return@forEach
      val name = markColors.entries.firstOrNull { it.value == span.foregroundColor }?.key
      result.add(mapOf("kind" to "color", "start" to editable.getSpanStart(span), "end" to editable.getSpanEnd(span), "color" to name))
    }
    editable.getSpans(0, editable.length, NotionAtomSpan::class.java).forEach { span ->
      result.add(
        mapOf(
          "kind" to "atom",
          "start" to editable.getSpanStart(span),
          "end" to editable.getSpanEnd(span),
          "atomKind" to span.atomKind,
          "label" to span.label,
          "item" to span.item
        )
      )
    }
    return result
  }

  private fun emitBoundary(kind: String, offset: Int) {
    if (epoch < 0) return
    val payload = mutableMapOf<String, Any>(
      "blockId" to blockId,
      "field" to fieldName,
      "kind" to kind,
      "offset" to offset,
      "hasSelection" to (input.selectionStart != input.selectionEnd),
      "epoch" to epoch
    )
    fieldIndex?.let { payload["index"] = it }
    onBoundary(payload)
  }

  private fun scheduleEvent(reason: String) {
    if (applying || epoch < 0) return
    if (reason != "selection" || !emissionPending) source = reason
    if (emissionPending) return
    emissionPending = true
    val scheduledEpoch = epoch
    post {
      emissionPending = false
      if (epoch != scheduledEpoch) return@post
      revision += 1
      val payload = mutableMapOf<String, Any>(
        "blockId" to blockId,
        "field" to fieldName,
        "text" to input.text.toString(),
        "marks" to serializeMarks(),
        "selectionStart" to input.selectionStart,
        "selectionEnd" to input.selectionEnd,
        "composingStart" to BaseInputConnection.getComposingSpanStart(input.text),
        "composingEnd" to BaseInputConnection.getComposingSpanEnd(input.text),
        "epoch" to epoch,
        "revision" to revision,
        "source" to source
      )
      fieldIndex?.let { payload["index"] = it }
      onEdit(payload)
    }
  }

  private fun copy(cut: Boolean): Boolean {
    val start = minOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    val end = maxOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    if (start == end) return true
    val marks = serializeMarks()
      .filter { (it["start"] as Int) < end && (it["end"] as Int) > start }
      .map { mark ->
        val markStart = maxOf(0, (mark["start"] as Int) - start)
        val markEnd = minOf(end - start, (mark["end"] as Int) - start)
        mark + mapOf("start" to markStart, "end" to markEnd)
      }
    val fragment = JSONObject()
      .put("version", 1)
      .put("kind", "field")
      .put("text", input.text.subSequence(start, end).toString())
      .put("marks", JSONArray(marks.map { JSONObject(it as Map<*, *>) }))
    val json = fragment.toString()
    val intent = Intent().putExtra(FIELD_FRAGMENT_MIME, json)
    val plain = input.text.subSequence(start, end).toString()
    clipboard().setPrimaryClip(
      ClipData(
        ClipDescription("Notion field fragment", arrayOf("text/plain", FIELD_FRAGMENT_MIME)),
        ClipData.Item(plain, null, intent, null)
      )
    )
    if (cut) input.text.replace(start, end, "")
    scheduleEvent(if (cut) "structured-cut" else "structured-copy")
    return true
  }

  private fun paste(): Boolean {
    val clip = clipboard().primaryClip ?: return true
    if (clip.itemCount == 0) return true
    val item = clip.getItemAt(0)
    val json = item.intent?.getStringExtra(FIELD_FRAGMENT_MIME)
    if (json != null && json.length <= 1_000_000 && clip.description.hasMimeType(FIELD_FRAGMENT_MIME)) {
      try {
        val fragment = JSONObject(json)
        require(fragment.getInt("version") == 1 && fragment.getString("kind") == "field")
        val text = fragment.getString("text")
        require(!text.contains('\n'))
        val marksJson = fragment.getJSONArray("marks")
        val start = minOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
        input.text.replace(start, maxOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0), text)
        val editable = input.text
        for (i in 0 until marksJson.length()) {
          val mark = marksJson.getJSONObject(i)
          val markStart = start + mark.getInt("start")
          val markEnd = start + mark.getInt("end")
          if (markStart < 0 || markEnd > editable.length || markStart >= markEnd) continue
          when (mark.optString("kind")) {
            "bold" -> editable.setSpan(StyleSpan(Typeface.BOLD), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            "italic" -> editable.setSpan(StyleSpan(Typeface.ITALIC), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            "underline" -> editable.setSpan(UnderlineSpan(), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            "strikethrough" -> editable.setSpan(StrikethroughSpan(), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            "code" -> {
              editable.setSpan(TypefaceSpan("monospace"), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
              editable.setSpan(ForegroundColorSpan(INLINE_CODE_FOREGROUND), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
              editable.setSpan(inlineCodeSpan(context), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
            "color" -> markColors[mark.optString("color")]?.let {
              editable.setSpan(ForegroundColorSpan(it), markStart, markEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
            "atom" -> editable.setSpan(
              NotionAtomSpan(mark.optString("atomKind"), mark.optString("label"), jsonToMap(mark.optJSONObject("item")), dark),
              markStart,
              markEnd,
              Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
            )
          }
        }
        input.setSelection(start + text.length)
        scheduleEvent("structured-paste")
        return true
      } catch (_: Exception) {
        // Untrusted/malformed private data falls back to the interoperable plain item.
      }
    }
    val plain = item.coerceToText(context).toString().replace("\r\n", " ").replace('\r', ' ').replace('\n', ' ')
    val start = minOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    val end = maxOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    input.text.replace(start, end, plain)
    input.setSelection(start + plain.length)
    scheduleEvent("plain-paste")
    return true
  }

  private fun jsonToMap(json: JSONObject?): Map<String, Any?>? {
    if (json == null) return null
    val map = mutableMapOf<String, Any?>()
    json.keys().forEach { key -> map[key] = jsonToAny(json.get(key)) }
    return map
  }

  private fun jsonToAny(value: Any?): Any? = when (value) {
    is JSONObject -> jsonToMap(value)
    is JSONArray -> (0 until value.length()).map { jsonToAny(value.get(it)) }
    JSONObject.NULL -> null
    else -> value
  }

  private inner class FieldInput(context: Context) : EditText(context) {
    override fun onSelectionChanged(start: Int, end: Int) {
      super.onSelectionChanged(start, end)
      scheduleEvent("selection")
    }

    override fun onFocusChanged(focused: Boolean, direction: Int, previouslyFocusedRect: Rect?) {
      super.onFocusChanged(focused, direction, previouslyFocusedRect)
      val payload = mutableMapOf<String, Any>("blockId" to blockId, "field" to fieldName)
      fieldIndex?.let { payload["index"] = it }
      if (focused) onFieldFocus(payload) else onFieldBlur(payload)
    }

    override fun onTextContextMenuItem(id: Int): Boolean = when (id) {
      android.R.id.copy -> copy(false)
      android.R.id.cut -> copy(true)
      android.R.id.paste -> paste()
      android.R.id.pasteAsPlainText -> {
        val clip = clipboard().primaryClip
        if (clip != null && clip.itemCount > 0) {
          val plain = clip.getItemAt(0).coerceToText(context).toString().replace('\n', ' ')
          val start = minOf(selectionStart, selectionEnd).coerceAtLeast(0)
          val end = maxOf(selectionStart, selectionEnd).coerceAtLeast(0)
          text.replace(start, end, plain)
        }
        true
      }
      else -> super.onTextContextMenuItem(id)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
      when (keyCode) {
        KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER -> {
          if (event.isShiftPressed) {
            val start = minOf(selectionStart, selectionEnd).coerceAtLeast(0)
            val end = maxOf(selectionStart, selectionEnd).coerceAtLeast(0)
            text.replace(start, end, "\u2028")
            setSelection(start + 1)
          } else {
            emitBoundary("enter", minOf(selectionStart, selectionEnd).coerceAtLeast(0))
          }
          return true
        }
        KeyEvent.KEYCODE_DEL -> if (selectionStart == 0 && selectionEnd == 0) {
          emitBoundary("backspace-at-start", 0)
          return true
        }
        KeyEvent.KEYCODE_FORWARD_DEL -> if (selectionStart == text.length && selectionEnd == text.length) {
          emitBoundary("delete-at-end", text.length)
          return true
        }
        KeyEvent.KEYCODE_DPAD_UP -> {
          val line = layout?.getLineForOffset(selectionStart) ?: 0
          if (line == 0) {
            emitBoundary("arrow-up-at-top", selectionStart)
            return true
          }
        }
        KeyEvent.KEYCODE_DPAD_DOWN -> {
          val lastLine = (layout?.lineCount ?: 1) - 1
          val line = layout?.getLineForOffset(selectionStart) ?: 0
          if (line == lastLine) {
            emitBoundary("arrow-down-at-bottom", selectionStart)
            return true
          }
        }
      }
      return super.onKeyDown(keyCode, event)
    }

    override fun onCreateInputConnection(outAttrs: EditorInfo): InputConnection? {
      val connection = super.onCreateInputConnection(outAttrs) ?: return null
      val connectionEpoch = epoch
      return object : InputConnectionWrapper(connection, false) {
        private fun commitOrBoundary(value: String): Boolean {
          if (value == "\n") {
            emitBoundary("enter", minOf(selectionStart, selectionEnd).coerceAtLeast(0))
            return true
          }
          return false
        }

        override fun setComposingText(text: CharSequence?, newCursorPosition: Int): Boolean {
          if (epoch != connectionEpoch) return false
          val result = super.setComposingText(text, newCursorPosition)
          scheduleEvent("ime-composing")
          return result
        }

        override fun commitText(text: CharSequence?, newCursorPosition: Int): Boolean {
          if (epoch != connectionEpoch) return false
          val value = text?.toString() ?: ""
          if (commitOrBoundary(value)) return true
          val result = super.commitText(value.replace('\n', ' '), newCursorPosition)
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
          val value = text.toString()
          if (commitOrBoundary(value)) return true
          val result = super.commitText(value.replace('\n', ' '), newCursorPosition, textAttribute)
          scheduleEvent("ime-commit")
          return result
        }

        override fun setComposingText(text: CharSequence, newCursorPosition: Int, textAttribute: TextAttribute?): Boolean {
          if (epoch != connectionEpoch) return false
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
          epoch == connectionEpoch && super.replaceText(start, end, text, newCursorPosition, textAttribute)

        override fun commitCompletion(text: CompletionInfo?): Boolean =
          epoch == connectionEpoch && super.commitCompletion(text)

        override fun commitCorrection(correctionInfo: CorrectionInfo?): Boolean =
          epoch == connectionEpoch && super.commitCorrection(correctionInfo)

        override fun performContextMenuAction(id: Int): Boolean =
          epoch == connectionEpoch && super.performContextMenuAction(id)

        override fun performEditorAction(editorAction: Int): Boolean {
          if (epoch != connectionEpoch) return false
          if (editorAction == EditorInfo.IME_ACTION_NEXT || editorAction == EditorInfo.IME_ACTION_DONE) {
            emitBoundary("enter", minOf(selectionStart, selectionEnd).coerceAtLeast(0))
            return true
          }
          return super.performEditorAction(editorAction)
        }

        override fun beginBatchEdit(): Boolean = epoch == connectionEpoch && super.beginBatchEdit()
        override fun endBatchEdit(): Boolean = epoch == connectionEpoch && super.endBatchEdit()

        override fun deleteSurroundingText(beforeLength: Int, afterLength: Int): Boolean {
          if (epoch != connectionEpoch) return false
          if (beforeLength > 0 && afterLength == 0 && selectionStart == 0 && selectionEnd == 0) {
            emitBoundary("backspace-at-start", 0)
            return true
          }
          if (afterLength > 0 && beforeLength == 0 && selectionStart == text.length && selectionEnd == text.length) {
            emitBoundary("delete-at-end", text.length)
            return true
          }
          return super.deleteSurroundingText(beforeLength, afterLength)
        }

        override fun deleteSurroundingTextInCodePoints(beforeLength: Int, afterLength: Int): Boolean =
          epoch == connectionEpoch && super.deleteSurroundingTextInCodePoints(beforeLength, afterLength)

        override fun setSelection(start: Int, end: Int): Boolean =
          epoch == connectionEpoch && super.setSelection(start, end)

        override fun sendKeyEvent(event: KeyEvent): Boolean =
          epoch == connectionEpoch && super.sendKeyEvent(event)
      }
    }
  }
}
