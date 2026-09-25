package expo.modules.markdown

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MarkdownModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Markdown")

    Function("hello") {
      "Hello from Markdown Kotlin!"
    }

    // Milestone-one editor coordinator: kept for regression. Superseded below by the
    // multi-field architecture (TextField/SelectionOverlay) for milestone four.
    View(MarkdownEditorView::class) {
      Events("onEdit", "onPageReferencePress", "onBlockActionsPress", "onContentSize")
      Prop("snapshot") { view: MarkdownEditorView, value: Map<String, Any?> -> view.setSnapshot(value) }
      Prop("command") { view: MarkdownEditorView, value: Map<String, Any?>? -> value?.let { view.command(it) } }
      Prop("theme") { view: MarkdownEditorView, value: Map<String, Any?>? -> view.setTheme(value) }
      Prop("labels") { view: MarkdownEditorView, value: Map<String, Any?>? -> view.setLabels(value) }
      Prop("pageReferenceFallbackIcon") { view: MarkdownEditorView, value: String? -> view.setPageReferenceFallbackIcon(value) }
      Prop("imageMaxWidth") { view: MarkdownEditorView, value: Int? -> view.setImageMaxWidth(value) }
    }

    // One editable native field per block's rich_text/caption/cell. Many mount at once; a
    // shared MarkdownEditorCoordinator tracks them by session for cross-field navigation.
    View(MarkdownTextFieldView::class) {
      Name("TextField")
      Events("onEdit", "onBoundary", "onFieldFocus", "onFieldBlur")
      Prop("field") { view: MarkdownTextFieldView, value: Map<String, Any?> -> view.setField(value) }
      Prop("command") { view: MarkdownTextFieldView, value: Map<String, Any?>? -> value?.let { view.command(it) } }
      Prop("dark") { view: MarkdownTextFieldView, value: Boolean -> view.setDark(value) }
    }

    // Coordinator-owned overlay for cross-field selection handles and drag auto-scroll.
    View(MarkdownSelectionOverlayView::class) {
      Name("SelectionOverlay")
      Events("onSelectionChange", "onAutoScroll")
      Prop("sessionId") { view: MarkdownSelectionOverlayView, value: String -> view.setSessionId(value) }
      Prop("selection") { view: MarkdownSelectionOverlayView, value: Map<String, Any?>? -> view.setSelection(value) }
      Prop("dark") { view: MarkdownSelectionOverlayView, value: Boolean -> view.setDark(value) }
    }
  }
}
