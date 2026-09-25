package expo.modules.markdown

import android.content.res.AssetManager
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.text.TextPaint
import android.text.style.MetricAffectingSpan
import com.facebook.react.common.assets.ReactFontManager

/** The enhanced Markdown spec's nine named hues; each also has a `_bg` background variant. */
internal val editorColorNames = listOf("gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red")
internal val editorTextColorNames: Set<String> = editorColorNames.toSet()
internal val editorBackgroundColorNames: Set<String> = editorColorNames.map { "${it}_bg" }.toSet()
internal val editorValidColors: Set<String> = editorTextColorNames + editorBackgroundColorNames

/**
 * Every color, font, and size the native editor draws with. JS flattens the resolved
 * `MarkdownTheme` into this shape (see `nativeEditorTheme` in NativeEditor.tsx); [DEFAULT] matches
 * the package's built-in light theme so the view renders sensibly before the first `theme` prop.
 */
internal data class EditorTheme(
  val accent: Int,
  val attachmentAccent: Int,
  val attachmentForeground: Int,
  val attachmentIconSurface: Int,
  val attachmentMuted: Int,
  val attachmentSurface: Int,
  val audioAccent: Int,
  val audioOnAccent: Int,
  val audioSurface: Int,
  val audioWaveformInactive: Int,
  val background: Int,
  val border: Int,
  val calloutBorder: Int,
  val foreground: Int,
  val inlineCodeBackground: Int,
  val inlineCodeForeground: Int,
  val mediaOverlay: Int,
  val mediaOverlayIcon: Int,
  val mediaPlaceholder: Int,
  val mediaPlaceholderError: Int,
  val muted: Int,
  val onAccent: Int,
  val placeholder: Int,
  val shadow: Int,
  val surface: Int,
  val switchThumb: Int,
  val switchTrackOff: Int,
  val switchTrackOn: Int,
  val tableBorder: Int,
  val tableControl: Int,
  val tableHeaderBackground: Int,
  val paletteText: Map<String, Int>,
  val paletteBackground: Map<String, Int>,
  val fontFamily: String,
  val fontSize: Float,
  val monospaceFontFamily: String,
  val titleFontFamily: String
) {
  /** A plain palette color by name (e.g. `"blue"`), or null for anything else. */
  fun textColor(name: String?): Int? = name?.let { paletteText[it] }

  /** A `_bg` palette color by name (e.g. `"blue_bg"`), or null for anything else. */
  fun backgroundColor(name: String?): Int? =
    name?.takeIf { it.endsWith("_bg") }?.let { paletteBackground[it.removeSuffix("_bg")] }

  /** Either kind of palette color by name. */
  fun namedColor(name: String?): Int? = textColor(name) ?: backgroundColor(name)

  /** [shadow] at the given alpha (0-255). */
  fun shadowWithAlpha(alpha: Int): Int = (shadow and 0x00FFFFFF) or (alpha.coerceIn(0, 255) shl 24)

  companion object {
    val DEFAULT = EditorTheme(
      accent = Color.rgb(0x2F, 0x6E, 0xAB),
      attachmentAccent = Color.rgb(0x33, 0x7E, 0xA9),
      attachmentForeground = Color.rgb(0x2C, 0x2C, 0x2B),
      attachmentIconSurface = Color.WHITE,
      attachmentMuted = Color.rgb(0x78, 0x77, 0x74),
      attachmentSurface = Color.rgb(0xF7, 0xF7, 0xF5),
      audioAccent = Color.rgb(0x33, 0x7E, 0xA9),
      audioOnAccent = Color.WHITE,
      audioSurface = Color.rgb(0xF0, 0xF6, 0xF8),
      audioWaveformInactive = Color.rgb(0xA9, 0xC9, 0xD8),
      background = Color.WHITE,
      border = Color.rgb(0xDE, 0xDE, 0xDB),
      calloutBorder = Color.rgb(0xE6, 0xE5, 0xE2),
      foreground = Color.rgb(0x2C, 0x2C, 0x2B),
      inlineCodeBackground = Color.argb(13, 33, 27, 23),
      inlineCodeForeground = Color.rgb(0xCF, 0x51, 0x48),
      mediaOverlay = Color.argb(110, 0, 0, 0),
      mediaOverlayIcon = Color.WHITE,
      mediaPlaceholder = Color.LTGRAY,
      mediaPlaceholderError = Color.DKGRAY,
      muted = Color.rgb(0x73, 0x73, 0x73),
      onAccent = Color.WHITE,
      placeholder = Color.DKGRAY,
      shadow = Color.BLACK,
      surface = Color.rgb(0xF7, 0xF7, 0xF5),
      switchThumb = Color.WHITE,
      switchTrackOff = Color.rgb(0xD0, 0xD0, 0xCC),
      switchTrackOn = Color.rgb(0x33, 0x7E, 0xA9),
      tableBorder = Color.rgb(0xDE, 0xDE, 0xDB),
      tableControl = Color.rgb(0x37, 0x35, 0x2F),
      tableHeaderBackground = Color.rgb(0xF7, 0xF7, 0xF5),
      paletteText = mapOf(
        "gray" to Color.rgb(0x6B, 0x6B, 0x6B),
        "brown" to Color.rgb(0x9F, 0x6B, 0x53),
        "orange" to Color.rgb(0xD9, 0x73, 0x0D),
        "yellow" to Color.rgb(0xC2, 0x92, 0x00),
        "green" to Color.rgb(0x44, 0x83, 0x61),
        "blue" to Color.rgb(0x33, 0x7E, 0xA9),
        "purple" to Color.rgb(0x90, 0x65, 0xB0),
        "pink" to Color.rgb(0xC1, 0x4C, 0x8A),
        "red" to Color.rgb(0xD4, 0x4C, 0x47)
      ),
      paletteBackground = mapOf(
        "gray" to Color.rgb(0xE9, 0xE9, 0xE7),
        "brown" to Color.rgb(0xEE, 0xE0, 0xD6),
        "orange" to Color.rgb(0xF9, 0xE1, 0xCC),
        "yellow" to Color.rgb(0xF9, 0xED, 0xC5),
        "green" to Color.rgb(0xDA, 0xEC, 0xDF),
        "blue" to Color.rgb(0xD9, 0xEA, 0xFA),
        "purple" to Color.rgb(0xE9, 0xDF, 0xF1),
        "pink" to Color.rgb(0xF4, 0xDC, 0xE8),
        "red" to Color.rgb(0xF8, 0xDE, 0xDD)
      ),
      fontFamily = "Inter",
      fontSize = 16f,
      monospaceFontFamily = "monospace",
      titleFontFamily = "Inter-Black"
    )

    /** An ARGB color from a JS number (signed or unsigned 32-bit), or null. */
    private fun color(value: Any?): Int? = (value as? Number)?.toLong()?.toInt()

    private fun palette(value: Any?, fallback: Map<String, Int>): Map<String, Int> {
      val source = value as? Map<*, *> ?: return fallback
      return editorColorNames.associateWith { name -> color(source[name]) ?: fallback.getValue(name) }
    }

    /** Parse the `theme` prop, falling back to [DEFAULT] for anything missing or malformed. */
    fun from(value: Map<String, Any?>?): EditorTheme {
      if (value == null) return DEFAULT
      val colors = value["colors"] as? Map<*, *> ?: emptyMap<String, Any?>()
      fun c(name: String, fallback: Int): Int = color(colors[name]) ?: fallback
      val d = DEFAULT
      return EditorTheme(
        accent = c("accent", d.accent),
        attachmentAccent = c("attachmentAccent", d.attachmentAccent),
        attachmentForeground = c("attachmentForeground", d.attachmentForeground),
        attachmentIconSurface = c("attachmentIconSurface", d.attachmentIconSurface),
        attachmentMuted = c("attachmentMuted", d.attachmentMuted),
        attachmentSurface = c("attachmentSurface", d.attachmentSurface),
        audioAccent = c("audioAccent", d.audioAccent),
        audioOnAccent = c("audioOnAccent", d.audioOnAccent),
        audioSurface = c("audioSurface", d.audioSurface),
        audioWaveformInactive = c("audioWaveformInactive", d.audioWaveformInactive),
        background = c("background", d.background),
        border = c("border", d.border),
        calloutBorder = c("calloutBorder", d.calloutBorder),
        foreground = c("foreground", d.foreground),
        inlineCodeBackground = c("inlineCodeBackground", d.inlineCodeBackground),
        inlineCodeForeground = c("inlineCodeForeground", d.inlineCodeForeground),
        mediaOverlay = c("mediaOverlay", d.mediaOverlay),
        mediaOverlayIcon = c("mediaOverlayIcon", d.mediaOverlayIcon),
        mediaPlaceholder = c("mediaPlaceholder", d.mediaPlaceholder),
        mediaPlaceholderError = c("mediaPlaceholderError", d.mediaPlaceholderError),
        muted = c("muted", d.muted),
        onAccent = c("onAccent", d.onAccent),
        placeholder = c("placeholder", d.placeholder),
        shadow = c("shadow", d.shadow),
        surface = c("surface", d.surface),
        switchThumb = c("switchThumb", d.switchThumb),
        switchTrackOff = c("switchTrackOff", d.switchTrackOff),
        switchTrackOn = c("switchTrackOn", d.switchTrackOn),
        tableBorder = c("tableBorder", d.tableBorder),
        tableControl = c("tableControl", d.tableControl),
        tableHeaderBackground = c("tableHeaderBackground", d.tableHeaderBackground),
        paletteText = palette(value["paletteText"], d.paletteText),
        paletteBackground = palette(value["paletteBackground"], d.paletteBackground),
        fontFamily = (value["fontFamily"] as? String)?.takeIf { it.isNotEmpty() } ?: d.fontFamily,
        fontSize = (value["fontSize"] as? Number)?.toFloat()?.takeIf { it > 0f } ?: d.fontSize,
        monospaceFontFamily = (value["monospaceFontFamily"] as? String)?.takeIf { it.isNotEmpty() }
          ?: d.monospaceFontFamily,
        titleFontFamily = (value["titleFontFamily"] as? String)?.takeIf { it.isNotEmpty() } ?: d.titleFontFamily
      )
    }
  }
}

/** The strings the native editor draws or announces; see `NativeEditorLabels` in NativeEditor.tsx. */
internal data class EditorLabels(
  val audio: String,
  val editableTableCells: String,
  val emptyToDoPlaceholder: String,
  val emptyTogglePlaceholder: String,
  val file: String,
  val fitTableWidth: String,
  val selectTableColumn: String,
  val selectTableRow: String,
  val tableActions: String,
  val tableCell: String,
  val tableOfContents: String,
  val tableSelectionEnd: String,
  val tableSelectionStart: String,
  val unknownFileSize: String
) {
  /** The accessibility label of the table cell at a 0-based position. */
  fun tableCell(row: Int, column: Int): String =
    tableCell.replace("{row}", (row + 1).toString()).replace("{column}", (column + 1).toString())

  companion object {
    val DEFAULT = EditorLabels(
      audio = "Audio",
      editableTableCells = "Editable table cells",
      emptyToDoPlaceholder = "To do",
      emptyTogglePlaceholder = "Empty toggle.  Tap to add text or create a new block.",
      file = "File",
      fitTableWidth = "Fit table to page width",
      selectTableColumn = "Select table column",
      selectTableRow = "Select table row",
      tableActions = "Table actions",
      tableCell = "Table cell row {row}, column {column}",
      tableOfContents = "Table of contents",
      tableSelectionEnd = "Table selection end",
      tableSelectionStart = "Table selection start",
      unknownFileSize = "Unknown size"
    )

    /** Parse the `labels` prop, falling back to [DEFAULT] for anything missing. */
    fun from(value: Map<String, Any?>?): EditorLabels {
      if (value == null) return DEFAULT
      val d = DEFAULT
      fun s(name: String, fallback: String): String = (value[name] as? String) ?: fallback
      return EditorLabels(
        audio = s("audio", d.audio),
        editableTableCells = s("editableTableCells", d.editableTableCells),
        emptyToDoPlaceholder = s("emptyToDoPlaceholder", d.emptyToDoPlaceholder),
        emptyTogglePlaceholder = s("emptyTogglePlaceholder", d.emptyTogglePlaceholder),
        file = s("file", d.file),
        fitTableWidth = s("fitTableWidth", d.fitTableWidth),
        selectTableColumn = s("selectTableColumn", d.selectTableColumn),
        selectTableRow = s("selectTableRow", d.selectTableRow),
        tableActions = s("tableActions", d.tableActions),
        tableCell = s("tableCell", d.tableCell),
        tableOfContents = s("tableOfContents", d.tableOfContents),
        tableSelectionEnd = s("tableSelectionEnd", d.tableSelectionEnd),
        tableSelectionStart = s("tableSelectionStart", d.tableSelectionStart),
        unknownFileSize = s("unknownFileSize", d.unknownFileSize)
      )
    }
  }
}

/**
 * Resolve a font family the way React Native `Text` does: fonts registered by `expo-font` (or bundled
 * under `assets/fonts`) first, then platform families such as `"monospace"`, then the default.
 */
internal fun editorTypeface(family: String, style: Int, assets: AssetManager): Typeface =
  runCatching { ReactFontManager.getInstance().getTypeface(family, style, assets) }
    .getOrElse { Typeface.create(family, style) }

/** Applies a specific [Typeface] to a text range, keeping any bold/italic the range already has. */
internal class EditorTypefaceSpan(private val typeface: Typeface) : MetricAffectingSpan() {
  override fun updateDrawState(paint: TextPaint) = apply(paint)

  override fun updateMeasureState(paint: TextPaint) = apply(paint)

  private fun apply(paint: Paint) {
    val style = paint.typeface?.style ?: Typeface.NORMAL
    paint.typeface = Typeface.create(typeface, style)
  }
}
