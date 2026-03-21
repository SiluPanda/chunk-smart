# chunk-smart

Structure-aware text chunker for RAG pipelines. Detects content type (markdown, code, JSON, HTML, YAML, plain text) and splits at natural boundaries — headings, functions, top-level keys, paragraphs, sentences — rather than blindly by character count.

## Install

```bash
npm install chunk-smart
```

## Quick Start

```typescript
import { chunk } from 'chunk-smart'

const chunks = chunk(myText)
// Auto-detects content type and splits at natural boundaries

chunks.forEach(c => {
  console.log(c.metadata.contentType, c.metadata.tokenCount, c.content.slice(0, 80))
})
```

## createChunker

```typescript
import { createChunker } from 'chunk-smart'

const chunker = createChunker({ maxTokens: 256, overlap: 20 })

const mdChunks = chunker.chunkMarkdown(markdownText)
const codeChunks = chunker.chunkCode(sourceCode)
const jsonChunks = chunker.chunkJSON(jsonString)
const detected = chunker.detectContentType(someText)
```

## Content Types

| Type       | Splits at                                      |
|------------|------------------------------------------------|
| `markdown` | `#` heading boundaries, then paragraphs        |
| `code`     | `function`/`class`/`def` boundaries, then blank lines |
| `json`     | top-level object keys or array element groups  |
| `html`     | paragraph/sentence boundaries                  |
| `yaml`     | paragraph/sentence boundaries                  |
| `text`     | paragraph boundaries (`\n\n`), then sentences  |

## ChunkOptions

| Option             | Type          | Default | Description                          |
|--------------------|---------------|---------|--------------------------------------|
| `maxTokens`        | `number`      | `512`   | Max tokens per chunk (1 token ≈ 4 chars) |
| `minTokens`        | `number`      | `50`    | Min tokens (informational)           |
| `overlap`          | `number`      | `0`     | Overlap in tokens between chunks     |
| `contentType`      | `ContentType` | `'auto'`| Force a specific content type        |
| `preserveStructure`| `boolean`     | `true`  | Use boundary-aware splitting         |

## ChunkMetadata

```typescript
interface ChunkMetadata {
  index: number          // position in result array
  startOffset: number    // char offset in original text
  endOffset: number      // char offset in original text
  tokenCount: number     // Math.ceil(content.length / 4)
  charCount: number      // content.length
  contentType: ContentType
  headings: string[]     // ancestor headings (markdown only)
  codeLanguage?: string  // detected from ``` fence or shebang
  overlapBefore: number  // overlap chars with previous chunk
  overlapAfter: number   // overlap chars with next chunk
}
```

## License

MIT
