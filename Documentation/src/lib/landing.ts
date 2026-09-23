/**
 *
 *
 * @module @react-native-notion-markdown/documentation/lib/landing
 *
 * @file      landing.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * @module @react-native-notion-markdown/documentation/lib/landing
 * @file landing.ts
 * @author Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license MIT
 */

export interface LandingNavItem {
  readonly label: string
  readonly href: string
  readonly external?: boolean
}

export interface LandingInstallOption {
  readonly id: string
  readonly label: string
  readonly command: string
}

export interface LandingCapabilityItem {
  readonly value: string
  readonly label: string
}

export interface LandingComparisonFeature {
  readonly id: string
  readonly label: string
  readonly title: string
  readonly description: string
  readonly without: string
  readonly with: string
}

export interface LandingComparisonTier {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly features: readonly LandingComparisonFeature[]
}

export interface LandingCapability {
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly href: string
  readonly linkLabel: string
}

export interface LandingStatement {
  readonly label: string
  readonly title: string
  readonly description: string
}

export interface LandingFaq {
  readonly question: string
  readonly answer: string
}

export interface LandingPipelineStep {
  readonly value: string
  readonly title: string
  readonly description: string
}

export interface LandingSectionContent {
  readonly capabilityLabel: string
  readonly examplesCaption: string
  readonly examplesLabel: string
  readonly problemLabel: string
  readonly problemTitle: string
  readonly modelLabel: string
  readonly modelTitle: string
  readonly modelDescription: string
  readonly modelChecks: readonly string[]
  readonly codingLabel: string
  readonly codingTitle: string
  readonly codingDescription: string
  readonly codingLinkLabel: string
  readonly quotesLabel: string
  readonly quotesTitle: string
  readonly faqLabel: string
  readonly faqTitle: string
  readonly faqDescription: string
  readonly ctaTitle: string
  readonly pipelineSteps: readonly LandingPipelineStep[]
}

export interface LandingPageConfig {
  readonly name: string
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly content: LandingSectionContent
  readonly navItems: readonly LandingNavItem[]
  readonly installOptions: readonly LandingInstallOption[]
  readonly primaryCta: LandingNavItem
  readonly secondaryCta: LandingNavItem
  readonly capabilityItems: readonly LandingCapabilityItem[]
  readonly comparisonTiers: readonly LandingComparisonTier[]
  readonly modelRows: readonly LandingCapabilityItem[]
  readonly capabilities: readonly LandingCapability[]
  readonly statements: readonly LandingStatement[]
  readonly faqs: readonly LandingFaq[]
}

export const LANDING_CONFIG: LandingPageConfig = {
  name: "react-native-notion-markdown",
  eyebrow: "React Native document infrastructure",
  title: "Bring structured Markdown-flavored content to every React Native surface.",
  description: "Parse, render, edit, and serialize Markdown-formatted content with a typed document model designed for React Native applications.",
  content: {
    capabilityLabel: "// Built for content-heavy apps",
    examplesCaption: "A static preview of the package flow; the source visual effects are intentionally omitted.",
    examplesLabel: "// Choose a starting point",
    problemLabel: "// What the package solves",
    problemTitle: "Hard content problems, explicit boundaries.",
    modelLabel: "// The document model",
    modelTitle: "Keep input, structure, and presentation in one clear flow.",
    modelDescription: "The model tells you what content entered the app, how it is represented, and which surface owns the next decision.",
    modelChecks: ["Parse once and reuse the same document across screens.", "Keep edits and serialization explicit.", "Leave native behavior at the platform edge."],
    codingLabel: "// Predictable for humans and tools",
    codingTitle: "Make structured content easier to work with.",
    codingDescription: "Clear models, small entry points, and typed boundaries make the package easier to adopt, extend, and explain to teammates or coding assistants.",
    codingLinkLabel: "Read the quick start",
    quotesLabel: "// Project value",
    quotesTitle: "Designed to stay useful as the app grows.",
    faqLabel: "// FAQ",
    faqTitle: "Questions teams ask before they adopt a document layer.",
    faqDescription: "Start with the smallest boundary that solves the problem in front of you, then expand when the product needs it.",
    ctaTitle: "Give every content surface a structure it can keep.",
    pipelineSteps: [
      { value: "01", title: "Parse", description: "Markdown-formatted content" },
      { value: "02", title: "Model", description: "Typed blocks and rich text" },
      { value: "03", title: "Render", description: "Native UI and custom themes" }
    ]
  },
  navItems: [
    { label: "Docs", href: "/docs/v1/onboarding/introduction" },
    { label: "Guides", href: "/docs/v1/guides/entry-points" },
    { label: "References", href: "/docs/v1/api" },
    { label: "GitHub", href: "https://github.com/GageSorrell/ReactNativeNotionMarkdown", external: true }
  ],
  installOptions: [
    { id: "npm", label: "npm", command: "npm install react-native-notion-markdown" },
    { id: "pnpm", label: "pnpm", command: "pnpm add react-native-notion-markdown" },
    { id: "yarn", label: "yarn", command: "yarn add react-native-notion-markdown" },
    { id: "bun", label: "bun", command: "bun add react-native-notion-markdown" },
    { id: "deno", label: "deno", command: "deno add npm:react-native-notion-markdown" }
  ],
  primaryCta: { label: "Read the docs", href: "/docs/v1/onboarding/introduction" },
  secondaryCta: { label: "Explore the API", href: "/docs/v1/api" },
  capabilityItems: [
    { value: "01", label: "Typed document model" },
    { value: "02", label: "React Native renderer" },
    { value: "03", label: "Composable editor" },
    { value: "04", label: "Native adapters" }
  ],
  comparisonTiers: [
    {
      id: "start",
      label: "Start",
      description: "Keep a first screen small without throwing away the document structure underneath it.",
      features: [
        {
          id: "content",
          label: "Content",
          title: "One model for parsed and authored content.",
          description: "Move from markdown input to inspectable blocks and rich text without coupling content to a single screen.",
          without: "Raw strings are passed between screens and interpreted again at every boundary.",
          with: "Parse once, then render or transform the same typed document wherever it is needed."
        },
        {
          id: "rendering",
          label: "Rendering",
          title: "A renderer that fits the application around it.",
          description: "Start with the built-in renderer and replace individual block views as the product develops its own language.",
          without: "A markdown view owns the presentation decisions and becomes difficult to extend.",
          with: "Use the renderer as a composed surface with theme and component overrides."
        }
      ]
    },
    {
      id: "scale",
      label: "Scale",
      description: "Keep editing, platform behavior, and application styling explicit as the product grows.",
      features: [
        {
          id: "editing",
          label: "Editing",
          title: "Add authoring without replacing the document layer.",
          description: "Use editor commands, selection state, and field operations as focused boundaries for authoring experiences.",
          without: "Editor state, serialization, and UI events become one large component contract.",
          with: "Keep document operations separate from controls so custom editor surfaces stay manageable."
        },
        {
          id: "platforms",
          label: "Platforms",
          title: "Native behavior where it belongs.",
          description: "Use native entry points for platform capabilities while keeping parsing, modeling, and serialization portable.",
          without: "Platform-specific behavior leaks into content transformations and makes testing harder.",
          with: "Keep native adapters at the edge and reuse the same document boundaries across platforms."
        }
      ]
    }
  ],
  modelRows: [
    { value: "Input", label: "Markdown-formatted content or Markdown blocks" },
    { value: "Model", label: "Typed blocks, rich text, fields, selections, and commands" },
    { value: "Surface", label: "Renderer, editor, custom UI, or native adapter" }
  ],
  capabilities: [
    {
      eyebrow: "Document",
      title: "A stable content boundary",
      description: "Parse, inspect, transform, and serialize documents without tying the data model to a particular screen.",
      href: "/docs/v1/guides/document-model",
      linkLabel: "Learn the model"
    },
    {
      eyebrow: "Renderer",
      title: "UI you can actually compose",
      description: "Render rich content with built-in block support, theming, media previews, diagrams, and focused overrides.",
      href: "/docs/v1/guides/renderer",
      linkLabel: "Read the renderer guide"
    },
    {
      eyebrow: "Editor",
      title: "Authoring as a set of boundaries",
      description: "Build editing surfaces around commands, selection state, fields, and configurable controls instead of a monolith.",
      href: "/docs/v1/guides/editor",
      linkLabel: "Read the editor guide"
    },
    {
      eyebrow: "Theme",
      title: "Your design system stays yours",
      description: "Adapt typography, colors, controls, and block components to the application that owns the content.",
      href: "/docs/v1/guides/theming",
      linkLabel: "Customize the theme"
    }
  ],
  statements: [
    {
      label: "For product teams",
      title: "Make content a capability, not a one-off screen.",
      description: "Share the same document representation across onboarding, notes, knowledge bases, editors, and previews."
    },
    {
      label: "For library authors",
      title: "Keep the public surface explicit.",
      description: "Separate platform-independent transformations from React Native UI and native integrations so each boundary can evolve independently."
    },
    {
      label: "For future packages",
      title: "Extend the system without rewriting the site.",
      description: "The documentation and landing-page components are designed around package configuration, versioned guides, and generated references."
    }
  ],
  faqs: [
    {
      question: "What does the package render?",
      answer: "It works with Markdown-formatted content and the package document model, including rich text, blocks, links, media, code, diagrams, and tables."
    },
    {
      question: "Can I use only the document layer?",
      answer: "Yes. The package exposes separate document, renderer, editor, native, and UI entry points so applications can choose the boundary they need."
    },
    {
      question: "Can the renderer use my application theme?",
      answer: "Yes. Renderer UI types support theme and component overrides, and the theming guide covers a practical path for adapting the highest-visibility pieces first."
    },
    {
      question: "Where should I start?",
      answer: "Install the package, follow the quick start, then read the entry-points guide to choose the document, renderer, editor, or native boundary that fits your app."
    }
  ]
}
