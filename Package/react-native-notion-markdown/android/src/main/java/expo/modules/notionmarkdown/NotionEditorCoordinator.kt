package expo.modules.notionmarkdown

import java.lang.ref.WeakReference

/**
 * Cross-field registry, keyed by the editor session id supplied from JS. Each attached
 * [NotionTextFieldView] registers itself on attach and unregisters on detach so the
 * coordinator can look up document-order neighbors for boundary navigation and hit-test
 * screen coordinates for cross-field drag selection.
 *
 * The TypeScript document store remains authoritative; this object only tracks which native
 * field views currently exist for a session and where they are on screen. It holds weak
 * references only, so a leaked registration cannot keep a detached view alive.
 */
internal object NotionEditorCoordinator {
  private val sessions = mutableMapOf<String, MutableList<WeakReference<NotionTextFieldView>>>()

  fun register(sessionId: String, view: NotionTextFieldView) {
    if (sessionId.isEmpty()) return
    val fields = sessions.getOrPut(sessionId) { mutableListOf() }
    fields.removeAll { it.get() == null || it.get() === view }
    fields.add(WeakReference(view))
  }

  fun unregister(sessionId: String, view: NotionTextFieldView) {
    if (sessionId.isEmpty()) return
    val fields = sessions[sessionId] ?: return
    fields.removeAll { it.get() == null || it.get() === view }
    if (fields.isEmpty()) sessions.remove(sessionId)
  }

  private fun orderedFields(sessionId: String): List<NotionTextFieldView> =
    sessions[sessionId]
      ?.mapNotNull { it.get() }
      ?.sortedBy { it.fieldOrder }
      ?: emptyList()

  /** The field immediately before or after [view] in document order, if any. */
  fun neighbor(sessionId: String, view: NotionTextFieldView, forward: Boolean): NotionTextFieldView? {
    val fields = orderedFields(sessionId)
    val index = fields.indexOf(view)
    if (index < 0) return null
    return fields.getOrNull(if (forward) index + 1 else index - 1)
  }

  /** The registered field, if any, whose identity matches the given field endpoint. */
  fun find(sessionId: String, blockId: String, field: String, index: Int?): NotionTextFieldView? =
    orderedFields(sessionId).firstOrNull {
      it.blockIdValue() == blockId && it.fieldNameValue() == field && it.fieldIndexValue() == index
    }

  /** The registered field, if any, whose on-screen bounds contain the given screen point. */
  fun hitTest(sessionId: String, screenX: Float, screenY: Float): NotionTextFieldView? {
    val origin = IntArray(2)
    return orderedFields(sessionId).firstOrNull { field ->
      field.getLocationOnScreen(origin)
      screenX >= origin[0] && screenX <= origin[0] + field.width &&
        screenY >= origin[1] && screenY <= origin[1] + field.height
    }
  }
}
