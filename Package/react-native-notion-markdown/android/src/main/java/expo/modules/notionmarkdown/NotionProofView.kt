package expo.modules.notionmarkdown

import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.text.Editable
import android.text.InputType
import android.text.Spanned
import android.text.TextWatcher
import android.text.style.RelativeSizeSpan
import android.text.style.StyleSpan
import android.view.Gravity
import android.view.KeyEvent
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

private const val FRAGMENT_MIME = "application/vnd.react-native-notion-markdown.proof+json"

private data class ProofBlock(val id: String, var type: String, var text: String) {
  fun payload() = mapOf("id" to id, "type" to type, "text" to text)
}

/**
 * Milestone-one coordinator: block boundaries share a single Editable and InputConnection.
 * This deliberately proves Android's continuous handles/IME path before separate mounted
 * fields, atomic spans, and heterogeneous blocks are introduced in later milestones.
 */
class NotionProofView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true
  private val onEdit by EventDispatcher()
  private var epoch = -1
  private var revision = 0
  private var lastCommand = -1
  private var applying = false
  private var emissionPending = false
  private var source = "selection"
  private val blocks = mutableListOf<ProofBlock>()
  private val input = ProofInput(context)
  private var removed = ""
  private var editBlock = 0
  private var probeConnection: InputConnection? = null

  init {
    input.gravity = Gravity.TOP or Gravity.START
    input.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or
      InputType.TYPE_TEXT_FLAG_CAP_SENTENCES or InputType.TYPE_TEXT_FLAG_AUTO_CORRECT
    input.imeOptions = EditorInfo.IME_FLAG_NO_EXTRACT_UI
    input.setTextSize(18f)
    val padding = (16 * resources.displayMetrics.density).toInt()
    input.setPadding(padding, padding, padding, padding)
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
        // Retain IDs on both sides of the edited range; split nodes get new editor IDs.
        repeat(removed.count { it == '\n' }) {
          if (editBlock + 1 < blocks.size) blocks.removeAt(editBlock + 1)
        }
        val inserted = s?.subSequence(start, start + count)?.count { it == '\n' } ?: 0
        repeat(inserted) { index ->
          blocks.add(editBlock + index + 1, ProofBlock(newId(), "paragraph", ""))
        }
        val lines = s?.toString()?.split('\n') ?: listOf("")
        lines.forEachIndexed { index, text -> blocks[index].text = text }
        scheduleEvent("text")
      }

      override fun afterTextChanged(s: Editable?) {
        if (!applying) styleBlocks()
      }
    })
    setDark(false)
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
      if (text.contains('\n') || type !in listOf("paragraph", "heading_1")) null
      else ProofBlock(id, type, text)
    }
    if (nextBlocks.isEmpty() || nextBlocks.size != supplied.size || nextBlocks.map { it.id }.distinct().size != nextBlocks.size) return
    applying = true
    epoch = nextEpoch
    revision = (value["revision"] as? Number)?.toInt() ?: 0
    blocks.clear()
    blocks.addAll(nextBlocks)
    BaseInputConnection.removeComposingSpans(input.text)
    input.setText(blocks.joinToString("\n") { it.text })
    input.setSelection(0)
    styleBlocks()
    applying = false
    // Replacing the document invalidates the old connection's composition and surrounding text.
    if (input.hasFocus()) inputMethodManager().restartInput(input)
    scheduleEvent("replacement")
  }

  fun setDark(dark: Boolean) {
    input.setTextColor(if (dark) Color.rgb(238, 238, 238) else Color.rgb(38, 38, 38))
    input.setHintTextColor(if (dark) Color.LTGRAY else Color.DKGRAY)
  }

  fun command(value: Map<String, Any?>) {
    val commandEpoch = (value["epoch"] as? Number)?.toInt() ?: return
    val id = (value["id"] as? Number)?.toInt() ?: return
    if (commandEpoch != epoch || id <= lastCommand) return
    lastCommand = id
    when (value["action"]) {
      "focus" -> {
        input.requestFocus()
        inputMethodManager().showSoftInput(input, InputMethodManager.SHOW_IMPLICIT)
      }
      "dismiss" -> inputMethodManager().hideSoftInputFromWindow(input.windowToken, 0)
      "selectAll" -> input.selectAll()
      "copy" -> copy(false)
      "cut" -> copy(true)
      "paste" -> paste()
      "split" -> replaceSelection("\n")
      "heading" -> {
        replaceSelection("\n")
        val index = input.text.take(input.selectionStart).count { it == '\n' }
        blocks[index].type = "heading_1"
        styleBlocks()
        scheduleEvent("insert-heading")
      }
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
        val start = minOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
        val end = maxOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
        if (start != end) replaceSelection("")
        else if (start > 0) {
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
    val start = minOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    val end = maxOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    input.text.replace(start, end, text)
    input.setSelection(start + text.length)
  }

  private fun copy(cut: Boolean): Boolean {
    val start = minOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    val end = maxOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
    if (start == end) return true
    val fragment = JSONArray()
    var offset = 0
    blocks.forEach { block ->
      val blockEnd = offset + block.text.length
      if (offset <= end && blockEnd >= start) {
        fragment.put(JSONObject().put("type", block.type).put("text", block.text.substring(
          (start - offset).coerceIn(0, block.text.length), (end - offset).coerceIn(0, block.text.length))))
      }
      offset = blockEnd + 1
    }
    val json = JSONObject().put("version", 1).put("blocks", fragment).toString()
    val intent = Intent().putExtra(FRAGMENT_MIME, json)
    val plain = input.text.subSequence(start, end).toString().replace('\u2028', '\n')
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
          require(type in listOf("paragraph", "heading_1") && !text.contains('\n'))
          type to text
        }
        val start = minOf(input.selectionStart, input.selectionEnd).coerceAtLeast(0)
        val firstBlock = input.text.take(start).count { it == '\n' }
        val startsAtBoundary = pointAt(start)["offset"] == 0
        replaceSelection(parts.joinToString("\n") { it.second })
        parts.forEachIndexed { index, part ->
          if (index > 0 || startsAtBoundary) blocks[firstBlock + index].type = part.first
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

  private fun pointAt(position: Int): Map<String, Any> {
    var remaining = position.coerceAtLeast(0)
    blocks.forEach { block ->
      if (remaining <= block.text.length) return mapOf("blockId" to block.id, "field" to "rich_text", "offset" to remaining)
      remaining -= block.text.length + 1
    }
    val last = blocks.last()
    return mapOf("blockId" to last.id, "field" to "rich_text", "offset" to last.text.length)
  }

  private fun styleBlocks() {
    val editable = input.text
    editable.getSpans(0, editable.length, RelativeSizeSpan::class.java).forEach { editable.removeSpan(it) }
    editable.getSpans(0, editable.length, StyleSpan::class.java).forEach { editable.removeSpan(it) }
    var start = 0
    blocks.forEach { block ->
      if (block.type == "heading_1" && block.text.isNotEmpty()) {
        editable.setSpan(RelativeSizeSpan(1.35f), start, start + block.text.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        editable.setSpan(StyleSpan(Typeface.BOLD), start, start + block.text.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
      }
      start += block.text.length + 1
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
      if (keyCode == KeyEvent.KEYCODE_ENTER && event.isShiftPressed) {
        replaceSelection("\u2028")
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
          val result = super.setComposingText(text, newCursorPosition)
          scheduleEvent("ime-composing")
          return result
        }
        override fun commitText(text: CharSequence?, newCursorPosition: Int): Boolean {
          if (epoch != connectionEpoch) return false
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
          val result = super.commitText(text, newCursorPosition, textAttribute)
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
        override fun performEditorAction(editorAction: Int): Boolean =
          epoch == connectionEpoch && super.performEditorAction(editorAction)
        override fun beginBatchEdit(): Boolean = epoch == connectionEpoch && super.beginBatchEdit()
        override fun endBatchEdit(): Boolean = epoch == connectionEpoch && super.endBatchEdit()
        override fun deleteSurroundingText(beforeLength: Int, afterLength: Int): Boolean =
          epoch == connectionEpoch && super.deleteSurroundingText(beforeLength, afterLength)
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
