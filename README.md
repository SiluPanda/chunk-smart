# chunk-smart

Structure-aware text chunker for RAG pipelines.

[![npm version](https://img.shields.io/npm/v/chunk-smart.svg)](https://www.npmjs.com/package/chunk-smart)
[![license](https://img.shields.io/npm/l/chunk-smart.svg)](https://github.com/SiluPanda/chunk-smart/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/chunk-smart.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

`chunk-smart` detects the content type of input text -- markdown, code, JSON, HTML, YAML, or plain text -- and splits it at natural structural boundaries rather than blindly by character count. Markdown is split at heading boundaries, code at function and class boundaries, JSON at top-level keys or array element groups, and plain text at paragraph and sentence boundaries. Every chunk carries rich metadata including positional offsets, token counts, heading context, and overlap indicators.

The package has zero runtime dependencies. All detection and splitting logic uses hand-written scanners and regex patterns. Token counting uses an approximate heuristic (1 token per 4 characters) suitable for most LLM tokenizers. The same input with the same options always produces the same output -- no LLM calls, no network access, fully deterministic.

## Installation

```bash
npm install chunk-smart
```

## Quick Start

```typescript
import { chunk } from 'chunk-smart';

const text = `# Introduction

This is the first section with some content.

## Details

Here are the details of the implementation.

## Conclusion

Final thoughts on the topic.`;

const chunks = chunk(text);

for (const c of chunks) {
  console.log(
    c.metadata.index,
    c.metadata.contentType,
    c.metadata.tokenCount,
    c.content.slice(0, 60)
  );
}
```

Output:

```
0 markdown 15 # Introduction\n\nThis is the first section with some c
1 markdown 14 ## Details\n\nHere are the details of the implementatio
2 markdown 10 ## Conclusion\n\nFinal thoughts on the topic.
```

## Features

- **Auto-detection** -- Identifies content type (markdown, code, JSON, HTML, YAML, plain text) from structural markers with a confidence score.
- **Structure-aware splitting** -- Splits at headings, function/class boundaries, JSON keys, paragraph breaks, and sentence endings instead of arbitrary character positions.
- **Rich metadata** -- Every chunk includes its sequential index, character offsets in the original text, token count, character count, content type, heading context (markdown), detected code language, and overlap indicators.
- **Configurable chunk sizing** -- Control maximum and minimum token counts per chunk, with an approximate tokenizer (1 token = 4 characters).
- **Overlap support** -- Configurable token-based overlap between adjacent chunks for continuity in retrieval pipelines.
- **Factory pattern** -- `createChunker` produces a reusable chunker instance with preset defaults, avoiding repeated option parsing.
- **Type-specific methods** -- Dedicated `chunkMarkdown`, `chunkCode`, and `chunkJSON` methods bypass auto-detection when you know the input format.
- **Zero dependencies** -- No runtime dependencies. Ships as compiled CommonJS with TypeScript declarations.
- **Deterministic** -- Same input and options always produce the same output. No LLM calls, no network access.

## API Reference

### `chunk(text, options?)`

Splits a text string into an array of `Chunk` objects. Auto-detects content type unless `contentType` is specified in options.

**Signature:**

```typescript
function chunk(text: string, options?: ChunkOptions): Chunk[]
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string` | The text to split into chunks. |
| `options` | `ChunkOptions` | Optional configuration for chunking behavior. |

**Returns:** `Chunk[]` -- An array of chunk objects, each containing `content` and `metadata`.

**Example:**

```typescript
import { chunk } from 'chunk-smart';

// Auto-detect content type
const chunks = chunk('# Hello\n\nWorld.\n\n## Section\n\nDetails.');

// Force content type and limit chunk size
const smallChunks = chunk(longText, {
  maxTokens: 256,
  contentType: 'markdown',
});

// Enable overlap between chunks
const overlapping = chunk(document, {
  maxTokens: 512,
  overlap: 50,
});
```

---

### `createChunker(defaultOptions?)`

Creates a reusable chunker instance with preset default options. All methods on the returned `Chunker` accept optional overrides that are merged with the defaults.

**Signature:**

```typescript
function createChunker(defaultOptions?: ChunkOptions): Chunker
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `defaultOptions` | `ChunkOptions` | Default options applied to every call on the returned chunker. |

**Returns:** `Chunker` -- An object with `chunk`, `chunkMarkdown`, `chunkCode`, `chunkJSON`, and `detectContentType` methods.

**Example:**

```typescript
import { createChunker } from 'chunk-smart';

const chunker = createChunker({ maxTokens: 256, overlap: 20 });

const mdChunks = chunker.chunkMarkdown(markdownText);
const codeChunks = chunker.chunkCode(sourceCode);
const jsonChunks = chunker.chunkJSON(jsonString);
const autoChunks = chunker.chunk(unknownText);
```

---

### `Chunker` Interface

The object returned by `createChunker`.

```typescript
interface Chunker {
  chunk(text: string, overrides?: Partial<ChunkOptions>): Chunk[];
  chunkMarkdown(text: string, options?: Partial<ChunkOptions>): Chunk[];
  chunkCode(text: string, options?: Partial<ChunkOptions>): Chunk[];
  chunkJSON(text: string, options?: Partial<ChunkOptions>): Chunk[];
  detectContentType(text: string): DetectResult;
}
```

| Method | Description |
|--------|-------------|
| `chunk` | Auto-detects content type and splits accordingly. |
| `chunkMarkdown` | Forces `contentType: 'markdown'` and splits at heading boundaries, then paragraphs, then sentences. |
| `chunkCode` | Forces `contentType: 'code'` and splits at `function`, `class`, `def`, `const`, `let`, `var` boundaries, then blank lines. |
| `chunkJSON` | Forces `contentType: 'json'` and splits at top-level object keys or array element groups. Falls back to token-based splitting for invalid JSON. |
| `detectContentType` | Returns the detected content type and confidence score without chunking. |

---

### `detectContentType(text)`

Analyzes text and returns the detected content type with a confidence score.

**Signature:**

```typescript
function detectContentType(text: string): DetectResult
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string` | The text to analyze. |

**Returns:** `DetectResult` -- An object with `type` and `confidence`.

**Detection heuristics:**

| Content Type | Signals | Confidence |
|--------------|---------|------------|
| `json` | Starts with `{` or `[`; valid `JSON.parse` | 0.95 |
| `json` | Starts with `{` or `[`; invalid parse | 0.70 |
| `html` | `<!DOCTYPE html>`, `<html>`, or common block tags (`div`, `p`, `span`, `body`, etc.) | 0.90 |
| `yaml` | `---` marker or 2+ `key: value` lines; no `<` characters | 0.80 |
| `markdown` | `#` headings, triple backtick fences, `**bold**`, list items, `[link](url)` (score >= 2) | 0.80 |
| `code` | `function`, `class`, `def`, `import`, `const`/`let`/`var` assignments, indented `{};` lines (score >= 2) | 0.70 |
| `text` | No structural markers detected | 0.50 |

**Example:**

```typescript
import { detectContentType } from 'chunk-smart';

detectContentType('{"key": "value"}');
// { type: 'json', confidence: 0.95 }

detectContentType('# Title\n\nParagraph text.');
// { type: 'markdown', confidence: 0.8 }

detectContentType('function greet() { return "hi"; }');
// { type: 'code', confidence: 0.7 }

detectContentType('Just plain text with no markers.');
// { type: 'text', confidence: 0.5 }
```

## Configuration

### `ChunkOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxTokens` | `number` | `512` | Maximum tokens per chunk. 1 token is approximately 4 characters. |
| `minTokens` | `number` | `50` | Minimum tokens per chunk (informational). |
| `overlap` | `number` | `0` | Number of tokens of overlap between adjacent chunks. |
| `contentType` | `ContentType` | auto-detected | Force a specific content type instead of auto-detecting. One of `'markdown'`, `'code'`, `'html'`, `'json'`, `'yaml'`, `'text'`. |
| `preserveStructure` | `boolean` | `true` | When `true`, uses boundary-aware splitting (paragraphs, sentences). When `false`, falls back to fixed-size token splitting for `html`, `yaml`, and `text` types. |

### `ContentType`

```typescript
type ContentType = 'markdown' | 'code' | 'html' | 'json' | 'yaml' | 'text'
```

### Content Type Splitting Strategies

| Type | Primary Boundary | Secondary Boundary | Tertiary Boundary |
|------|-----------------|-------------------|-------------------|
| `markdown` | `#` headings | Double newlines (paragraphs) | Sentence endings |
| `code` | `function`/`class`/`def`/`const`/`let`/`var` declarations | Blank lines | Character-level hard split |
| `json` | Top-level object keys or array element groups | Token-based fallback (invalid JSON) | -- |
| `html` | Paragraphs | Sentences | Word boundaries |
| `yaml` | Paragraphs | Sentences | Word boundaries |
| `text` | Double newlines (paragraphs) | Sentence endings (`.` `!` `?`) | Word boundaries |

## Types

### `Chunk`

```typescript
interface Chunk {
  content: string;
  metadata: ChunkMetadata;
}
```

### `ChunkMetadata`

```typescript
interface ChunkMetadata {
  index: number;          // Sequential position in the result array (0-based)
  startOffset: number;    // Character offset of chunk start in the original text
  endOffset: number;      // Character offset of chunk end in the original text
  tokenCount: number;     // Approximate token count: Math.ceil(content.length / 4)
  charCount: number;      // Character count: content.length
  contentType: ContentType; // Detected or specified content type
  headings: string[];     // Headings found within the chunk (markdown only)
  codeLanguage?: string;  // Language detected from ``` fence or #! shebang (code only)
  overlapBefore: number;  // Characters of overlap with the previous chunk
  overlapAfter: number;   // Characters of overlap with the next chunk
}
```

### `DetectResult`

```typescript
interface DetectResult {
  type: ContentType;
  confidence: number;     // 0.0 to 1.0
}
```

## Error Handling

`chunk-smart` handles edge cases gracefully without throwing exceptions:

- **Empty string** -- Returns an empty array `[]`.
- **Whitespace-only input** -- Returns an empty array `[]`.
- **Invalid JSON with `contentType: 'json'`** -- Falls back to token-based splitting.
- **Single word exceeding `maxTokens`** -- Hard-splits at the character limit to guarantee every chunk respects the size constraint.
- **No structural boundaries found** -- Falls back to the next finer boundary level (paragraphs to sentences to words to characters).

## Advanced Usage

### Chunking a Codebase for Retrieval

```typescript
import { createChunker } from 'chunk-smart';
import { readFileSync } from 'node:fs';

const chunker = createChunker({ maxTokens: 512, overlap: 30 });

const source = readFileSync('src/parser.ts', 'utf-8');
const chunks = chunker.chunkCode(source);

for (const c of chunks) {
  console.log(`Chunk ${c.metadata.index}: ${c.metadata.tokenCount} tokens`);
  if (c.metadata.codeLanguage) {
    console.log(`  Language: ${c.metadata.codeLanguage}`);
  }
}
```

### Processing Large JSON API Responses

```typescript
import { chunk } from 'chunk-smart';

const apiResponse = JSON.stringify(largeDataset, null, 2);
const chunks = chunk(apiResponse, {
  maxTokens: 1024,
  contentType: 'json',
});

// Each chunk is valid JSON (subset of top-level keys or array elements)
for (const c of chunks) {
  const parsed = JSON.parse(c.content);
  console.log(`Chunk ${c.metadata.index}: ${Object.keys(parsed).length} keys`);
}
```

### Markdown Documentation with Heading Context

```typescript
import { chunk } from 'chunk-smart';

const docs = readFileSync('API.md', 'utf-8');
const chunks = chunk(docs, { maxTokens: 256, contentType: 'markdown' });

for (const c of chunks) {
  if (c.metadata.headings.length > 0) {
    console.log(`Section: ${c.metadata.headings.join(' > ')}`);
  }
  console.log(`  Offset: ${c.metadata.startOffset}-${c.metadata.endOffset}`);
  console.log(`  Tokens: ${c.metadata.tokenCount}`);
}
```

### Disabling Structure-Aware Splitting

```typescript
import { chunk } from 'chunk-smart';

// Fixed-size token splitting without boundary awareness
const chunks = chunk(text, {
  maxTokens: 128,
  overlap: 20,
  preserveStructure: false,
  contentType: 'text',
});
```

### Using Per-Call Overrides with a Chunker Instance

```typescript
import { createChunker } from 'chunk-smart';

const chunker = createChunker({ maxTokens: 512 });

// Override maxTokens for a single call
const small = chunker.chunk(text, { maxTokens: 128 });

// Detect content type without chunking
const detected = chunker.detectContentType(unknownInput);
console.log(detected.type, detected.confidence);
```

## TypeScript

`chunk-smart` is written in TypeScript with strict mode enabled. Type declarations are shipped alongside the compiled JavaScript in the `dist/` directory.

All public types are exported from the package entry point:

```typescript
import {
  chunk,
  createChunker,
  detectContentType,
} from 'chunk-smart';

import type {
  ContentType,
  DetectResult,
  ChunkMetadata,
  Chunk,
  ChunkOptions,
  Chunker,
} from 'chunk-smart';
```

## License

MIT
