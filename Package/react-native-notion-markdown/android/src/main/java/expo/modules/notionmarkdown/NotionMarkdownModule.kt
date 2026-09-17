package expo.modules.notionmarkdown

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NotionMarkdownModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NotionMarkdown")

    Function("hello") {
      "Hello from NotionMarkdown Kotlin!"
    }

    // Milestone-one proof coordinator: kept for regression. Superseded below by the
    // multi-field architecture (TextField/SelectionOverlay) for milestone four.
    View(NotionProofView::class) {
      Events("onEdit")
      Prop("snapshot") { view: NotionProofView, value: Map<String, Any?> -> view.setSnapshot(value) }
      Prop("command") { view: NotionProofView, value: Map<String, Any?>? -> value?.let { view.command(it) } }
      Prop("dark") { view: NotionProofView, value: Boolean -> view.setDark(value) }
    }

    // One editable native field per block's rich_text/caption/cell. Many mount at once; a
    // shared NotionEditorCoordinator tracks them by session for cross-field navigation.
    View(NotionTextFieldView::class) {
      Name("TextField")
      Events("onEdit", "onBoundary", "onFieldFocus", "onFieldBlur")
      Prop("field") { view: NotionTextFieldView, value: Map<String, Any?> -> view.setField(value) }
      Prop("command") { view: NotionTextFieldView, value: Map<String, Any?>? -> value?.let { view.command(it) } }
      Prop("dark") { view: NotionTextFieldView, value: Boolean -> view.setDark(value) }
    }

    // Coordinator-owned overlay for cross-field selection handles and drag auto-scroll.
    View(NotionSelectionOverlayView::class) {
      Name("SelectionOverlay")
      Events("onSelectionChange", "onAutoScroll")
      Prop("sessionId") { view: NotionSelectionOverlayView, value: String -> view.setSessionId(value) }
      Prop("selection") { view: NotionSelectionOverlayView, value: Map<String, Any?>? -> view.setSelection(value) }
      Prop("dark") { view: NotionSelectionOverlayView, value: Boolean -> view.setDark(value) }
    }
  }
}
