/**
 *
 *
 * @module @react-native-notion-markdown/api-reference/model
 *
 * @file      model.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

export interface ReferenceSource {
  readonly file: string
  readonly line?: number
  readonly character?: number
  readonly revision: string
  readonly url: string
}

export interface ReferenceDeclaration {
  readonly id: string
  readonly name: string
  readonly kind: string
  readonly category: "Classes" | "Functions" | "Interfaces" | "Types" | "Variables" | "Enums" | "Other"
  readonly anchor: string
  readonly signature: string
  readonly description: string
  readonly examples: readonly string[]
  readonly since?: string
  readonly see: readonly string[]
  readonly source?: ReferenceSource
  readonly children: readonly ReferenceDeclaration[]
}

export interface ReferenceModule {
  readonly id: string
  readonly slug: string
  readonly label: string
  readonly exportPath: string
  readonly title: string
  readonly description: string
  readonly sourceFile: string
  readonly sourceRevision: string
  readonly declarations: readonly ReferenceDeclaration[]
}

export interface ReferencePackage {
  readonly id: string
  readonly version: string
  readonly name: string
  readonly group: string
  readonly description: string
  readonly repository: string
  readonly npm: string
  readonly sourceRevision: string
  readonly snapshotId: string
  readonly modules: readonly ReferenceModule[]
}

export interface ReferenceManifest {
  readonly schemaVersion: number
  readonly version: string
  readonly snapshotId: string
  readonly generatorDigest: string
  readonly package: {
    readonly id: string
    readonly name: string
    readonly group: string
    readonly description: string
    readonly repository: string
    readonly npm: string
    readonly sourceRevision: string
  }
  readonly modules: readonly {
    readonly id: string
    readonly slug: string
    readonly label: string
    readonly exportPath: string
    readonly file: string
    readonly sourceRevision: string
  }[]
}
