/**
 * @module react-native-notion-markdown/prototype
 *
 * @file      prototype.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * A block in the milestone-one transport model. This is not the public Notion AST.
 *
 * @since 1.0.0
 */
export interface ProofBlock
{
    readonly id: string;
    readonly type: "paragraph" | "heading_1";
    readonly text: string;
};

/**
 * A UTF-16 selection point within a proof block.
 *
 * @since 1.0.0
 */
export interface ProofPoint
{
    readonly blockId: string;
    readonly field: "rich_text";
    readonly offset: number ;
}

/**
 * A revisioned document snapshot exchanged with the native editor.
 *
 * @since 1.0.0
 */
export interface ProofSnapshot
{
    readonly blocks: Array<ProofBlock>;
    readonly epoch: number;
    readonly revision: number;
}

/**
 * A native editor event containing the latest document and selection state.
 *
 * @since 1.0.0
 */
export interface ProofEvent extends ProofSnapshot
{
    readonly anchor: ProofPoint;
    readonly focus: ProofPoint;
    readonly composingStart: number;
    readonly composingEnd: number;
    readonly source: string;
};

/**
 * Actions understood by the milestone-one native editor coordinator.
 *
 * @since 1.0.0
 */
export type Action =
    | "focus"
    | "dismiss"
    | "selectAll"
    | "copy"
    | "cut"
    | "paste"
    | "split"
    | "backspace"
    | "softBreak"
    | "heading"
    | "compose"
    | "commit";

/**
 * A uniquely identified command sent to the native editor coordinator.
 *
 * @since 1.0.0
 */
export interface ProofCommand
{
    readonly id: number;
    readonly epoch: number;
    readonly action: Action;
};

/**
 * Create the default three-block proof document for the requested epoch.
 *
 * @since 1.0.0
 */
export function CreateProofDocument(epoch: number = 1): ProofSnapshot
{
    return {
        blocks:
        [
            {
                id: "proof:first",
                text: "First block. Try autocorrection, composing text, and emoji here.",
                type: "paragraph"
            },
            {
                id: "proof:heading",
                text: "Second block heading",
                type: "heading_1"
            },
            {
                id: "proof:last",
                text: "Third block. Drag selection handles across the block boundaries.",
                type: "paragraph"
            }
        ],
        epoch,
        revision: 0
    };
}

export/**
       * Backwards-compatible camel-case alias for the document factory.
       *
       * @since 1.0.0
       */
const createProofDocument = CreateProofDocument;

/**
 * Acknowledgements never replace the native composing buffer. Replacement changes epoch.
 *
 * @since 1.0.0
 */
export function AcceptProofEvent(current: ProofSnapshot, event: ProofEvent): ProofSnapshot
{
    if (event.epoch !== current.epoch || event.revision <= current.revision)
    {
        return current;
    }

    const ids = new Set(event.blocks.map((block: ProofBlock) => block.id));

    if (!event.blocks.length || ids.size !== event.blocks.length)
    {
        return current;
    }

    /**
     * Validate a block before accepting it into the document snapshot.
     *
     * @since 1.0.0
     */
    const IsBlockValid = (Block: ProofBlock) => !(
        !Block.id ||
        Block.text.includes("\n") ||
        ![ "paragraph", "heading_1" ].includes(Block.type)
    );

    /**
     * Validate the complete event payload before accepting the revision.
     *
     * @since 1.0.0
     */
    const IsValid = event.blocks.every(IsBlockValid);

    if (!IsValid)
    {
        return current;
    }

    return {
        blocks: event.blocks.map((block: ProofBlock) =>
        {
            const previous = current.blocks.find((item: ProofBlock) => item.id === block.id);
            return previous?.text === block.text && previous.type === block.type
                ? previous
                : block;
        }),
        epoch: current.epoch,
        revision: event.revision
    };
}

export/**
       * Backwards-compatible camel-case alias for the event reducer.
       *
       * @since 1.0.0
       */
const acceptProofEvent = AcceptProofEvent;

/**
 * Native buffer uses newline boundaries and U+2028 for within-block soft breaks.
 *
 * @throws {Error} When the document has no blocks.
 *
 * @since 1.0.0
 */
export function proofPointAt(blocks: ReadonlyArray<ProofBlock>, position: number): ProofPoint
{
    if (!blocks.length)
    {
        throw new Error("A proof document needs at least one block.");
    }

    let remaining: number = Math.max(0, position);

    for (const block of blocks)
    {
        if (remaining <= block.text.length)
        {
            return {
                blockId: block.id,
                field: "rich_text",
                offset: remaining
            };
        }

        remaining -= block.text.length + 1;
    }

    const last = blocks[blocks.length - 1]!;

    return {
        blockId: last.id,
        field: "rich_text",
        offset: last.text.length
    };
}
