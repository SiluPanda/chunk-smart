# chunk-smart -- Specification

## 1. Overview

`chunk-smart` is a structure-aware text chunking library that splits documents into chunks for RAG (Retrieval-Augmented Generation) pipelines while preserving the integrity of structural elements -- code blocks, markdown tables, HTML elements, JSON objects, YAML frontmatter, math blocks, and list groups. It accepts a text string, auto-detects the content type (markdown, code, HTML, JSON, YAML, or plain text), selects the appropriate chunking strategy for that content type, splits the text into chunks that respect structural boundaries, and returns an array of `Chunk` objects carrying the chunk text, sequential index, source offsets, token count, content type, heading context, and overlap indicators.

The gap this package fills is specific and well-defined. Existing JavaScript chunking tools split text on characters, words, sentences, or paragraphs, with no awareness of the structural semantics within the document. LangChain's `@langchain/textsplitters` package provides `RecursiveCharacterTextSplitter`, `MarkdownTextSplitter`, `HTMLSectionSplitter`, and `RecursiveCharacterTextSplitter.fromLanguage()` -- but these are tightly coupled to the LangChain framework, require `@langchain/core` as a peer dependency, and operate as subclasses of a text splitter base class designed for LangChain's document abstraction (`Document` objects with `pageContent` and `metadata`). Developers who are not using LangChain must either adopt its entire document model or write their own chunking logic. The standalone npm packages -- `chunk-text` (splits by character length without word awareness), `split-text-to-chunks` (splits by token count but ignores structure), `textchunk` (fixed-size chunking only), and `@orama/chunker` (sentence-based NLP chunking) -- all treat text as a flat character sequence. None of them detect content type. None of them know that a markdown code fence (` ``` `) delimits an atomic block that must not be split across chunks. None of them know that a markdown table's header row must stay with its data rows. None of them know that a JSON object's closing brace belongs with its opening brace. `llm-splitter` on npm advertises paragraph-aware chunking but does not handle code fences, tables, or nested structures.

The consequences of naive chunking in RAG pipelines are well-documented. When a code block is split mid-function, the resulting chunk is syntactically incomplete -- an embedding model encodes a meaningless fragment, the vector search returns it as a "match," and the LLM receives a broken code snippet that it cannot interpret or reference correctly. When a table is split between its header row and its data rows, the data rows lose their column semantics entirely. When a JSON object is split mid-value, neither half is parseable. These chunking failures cascade through the entire RAG pipeline: bad chunks produce bad embeddings, bad embeddings produce bad retrieval, and bad retrieval produces bad answers.

`chunk-smart` solves this by treating structural elements as atomic units. A code fence is never split unless it exceeds the maximum chunk size, in which case it is force-split at line boundaries with a warning in the chunk metadata. A markdown table (header + separator + all data rows) is kept as a single unit. A JSON object or array is kept whole. A list group (all consecutive list items under the same context) is kept together. The chunker auto-detects the content type of the input, selects the strategy that understands that content type's structural boundaries, splits at the highest-level boundaries first (sections, then paragraphs, then sentences, then words), and falls back to finer boundaries only when a chunk would otherwise exceed the configured maximum size. The result is chunks that are structurally coherent, semantically meaningful, and optimally sized for embedding and retrieval.

The package provides both a TypeScript/JavaScript API for programmatic use and a CLI for chunking files from the terminal. The API returns typed `Chunk` objects with rich metadata. The CLI reads from stdin or a file and outputs JSON. Both interfaces support configurable chunk sizes (in tokens or characters), overlap, content type override, and custom token counters. The package has zero runtime dependencies -- all parsing, detection, and splitting logic is implemented with hand-written scanners and regex patterns using Node.js built-in modules.

---

## 2. Goals and Non-Goals

### Goals

- Provide a single function (`chunk`) that accepts a text string, auto-detects its content type, and returns an array of `Chunk` objects split at structure-aware boundaries.
- Provide content-type-specific functions (`chunkMarkdown`, `chunkCode`, `chunkHTML`, `chunkJSON`) for callers who know the input type.
- Provide a factory function (`createChunker`) that creates a configured chunker instance with preset options, avoiding repeated option parsing across multiple calls.
- Detect and preserve atomic structural units: markdown code fences, markdown tables, HTML block-level elements, JSON objects and arrays, YAML frontmatter, math blocks (`$$...$$`), and list groups.
- Auto-detect content type from the input text using heuristic analysis of structural markers (markdown headers, HTML tags, JSON braces, YAML indicators, code syntax patterns).
- Split at the highest-level boundary first (document sections, then paragraphs, then sentences, then words), recursively falling back to finer boundaries only when chunks would exceed the configured maximum size.
- Support configurable chunk sizing: maximum chunk size, minimum chunk size (merge small chunks), and target chunk size, measured in tokens or characters with a pluggable token counter.
- Support configurable overlap: token-based or character-based overlap at boundary-aware points (never mid-word, never mid-atomic-unit).
- Attach rich metadata to every chunk: sequential index, start and end byte offsets in the original text, token count, detected content type, heading hierarchy context, code language (if applicable), overlap indicators, and custom metadata passthrough.
- Provide a CLI (`chunk-smart`) that reads text from stdin or a file and writes chunks as JSON to stdout.
- Apply only deterministic, rule-based chunking. No LLM calls, no embedding-based semantic splitting, no network access. The same input with the same options always produces the same output.
- Keep dependencies minimal: zero runtime dependencies. All parsing is implemented using hand-written scanners and Node.js built-in APIs.
- Work with text from any source: LLM output, documentation files, source code, configuration files, web scrapes, and database exports.

### Non-Goals

- **Not a semantic chunker.** This package does not use embedding models to find semantic boundaries. Semantic chunking (as implemented by LlamaIndex's `SemanticSplitterNodeParser`) requires an embedding model, adds latency and cost, and introduces non-determinism. `chunk-smart` uses structural and syntactic heuristics only. For semantic chunking, use a dedicated semantic splitter on top of `chunk-smart`'s output.
- **Not a full markdown parser.** This package detects markdown structural elements (headers, fences, tables, lists) for the purpose of finding chunk boundaries. It does not parse markdown into a full AST or render it to HTML. For full markdown parsing, use `remark`, `marked`, or `markdown-it`.
- **Not a code parser.** This package uses heuristic patterns (braces, indentation, function/class keywords) to find code boundaries. It does not build a full AST or understand language semantics. For language-specific AST parsing, use tree-sitter or language-specific parsers.
- **Not an HTML parser.** This package detects block-level HTML elements and tag boundaries using regex-based scanning. It does not implement a full HTML5 parser. For compliant HTML parsing, use `htmlparser2` or `parse5`.
- **Not a tokenizer.** This package counts tokens for chunk sizing using a pluggable token counter. It ships with an approximate counter (characters divided by 4) as the default. For exact token counts, the caller provides a token counting function (e.g., wrapping `tiktoken` or `@anthropic-ai/tokenizer`).
- **Not an embedding generator.** This package produces chunks; it does not generate embeddings from them. For embedding generation, use `embed-cache` or a provider SDK.
- **Not a document converter.** This package operates on text strings. It does not read PDF, DOCX, PPTX, or other binary formats. For document conversion to text, use `pdf-parse`, `mammoth`, or `unstructured` before passing the text to `chunk-smart`.
- **Not a LangChain integration.** This package is framework-independent. It does not produce LangChain `Document` objects or depend on `@langchain/core`. Wrapping `Chunk` objects into LangChain `Document` objects is trivial and left to the caller.

---

## 3. Target Users and Use Cases

### RAG Pipeline Builders

Developers building retrieval-augmented generation pipelines who ingest documents, chunk them, generate embeddings, store vectors, and retrieve relevant chunks at query time. They need chunks that are structurally coherent and sized appropriately for their embedding model (typically 256-1024 tokens). A typical integration is: `const chunks = chunk(documentText, { maxChunkSize: 512, overlap: 50 })`.

### Documentation Ingestion Systems

Teams building knowledge bases that ingest technical documentation -- README files, API docs, tutorials, wikis -- written in markdown. The documentation contains code examples, tables, and nested header hierarchies. Naive chunking breaks code examples mid-function and separates table headers from data rows, producing useless chunks. `chunk-smart` preserves these structures, and the heading context metadata enables hierarchical retrieval ("this chunk is under ## Authentication > ### OAuth2 Flow").

### Code Repository Indexing

Developers building code search and code Q&A systems that index entire repositories. Source code files must be chunked without breaking functions, classes, or import blocks. `chunkCode(sourceCode, { language: 'typescript' })` produces chunks aligned to function and class boundaries, with metadata indicating the detected language.

### Search Index Construction

Teams building full-text or vector search indexes over heterogeneous document collections. Documents arrive in mixed formats: some are markdown, some are HTML, some are JSON API responses, some are plain text. `chunk-smart`'s auto-detection identifies the content type of each document and applies the appropriate chunking strategy without manual format tagging.

### LLM Context Preparation

Developers who need to split long documents into chunks that fit within an LLM's context window for multi-pass processing (summarization, extraction, analysis). The chunks must be self-contained enough that the LLM can process each one independently, with overlap providing continuity between chunks.

### CLI and Shell Script Authors

Engineers who chunk documents in shell pipelines. `cat document.md | chunk-smart --max-size 512 --overlap 50 --format json | jq '.[].content'` -- the CLI bridges document processing and standard Unix JSON tools.

### Integration with npm-master Ecosystem

Developers using other packages in the npm-master monorepo: `embed-cache` for caching embeddings of chunks, `context-packer` for optimally packing chunks into LLM context windows, `rag-prompt-builder` for composing RAG prompts from retrieved chunks, `table-chunk` for specialized table handling, and `chunk-overlap-optimizer` for tuning overlap parameters. `chunk-smart` is the first stage in this pipeline -- it produces the chunks that all downstream packages consume.

---

## 4. Core Concepts

### Chunk

A chunk is a contiguous substring of the original text, paired with metadata describing its position, size, content type, and structural context. Chunks are the fundamental unit of output from `chunk-smart`. Every chunk is a plain JavaScript object with a `content` string and a `metadata` object. Chunks are immediately serializable with `JSON.stringify` and immediately usable in embedding pipelines.

### Content Type

The content type is the detected or specified format of the input text. `chunk-smart` recognizes six content types: `markdown`, `code`, `html`, `json`, `yaml`, and `text` (plain text fallback). The content type determines which chunking strategy is applied. Content type can be auto-detected from the input or explicitly specified by the caller.

### Atomic Unit

An atomic unit is a structural element that must not be split across chunk boundaries under normal circumstances. Code fences, markdown tables, HTML block elements, JSON objects, YAML documents, math blocks, and frontmatter blocks are all atomic units. When an atomic unit fits within the maximum chunk size, it is kept whole. When an atomic unit exceeds the maximum chunk size (an unusually large code block, a table with hundreds of rows), it is force-split at internal boundaries (line boundaries for code, row boundaries for tables) and a `forceSplit: true` flag is set in the chunk metadata to alert the caller.

### Boundary

A boundary is a position in the text where a chunk break is permissible. Boundaries form a hierarchy from coarsest to finest:

| Level | Boundary Type | Description |
|-------|--------------|-------------|
| 1 | Section | Markdown headers (`#`, `##`, etc.), HTML heading elements (`<h1>`-`<h6>`), horizontal rules |
| 2 | Block | Paragraph breaks (double newlines), block-level HTML elements, JSON top-level properties |
| 3 | Paragraph | Single blank lines between text blocks |
| 4 | Sentence | Sentence-ending punctuation (`.`, `!`, `?`) followed by whitespace |
| 5 | Word | Whitespace between words |
| 6 | Character | Individual characters (last resort) |

The chunker always attempts to split at the coarsest boundary level first. If the resulting chunk would exceed the maximum size, it recursively tries finer boundary levels within the oversized segment. This recursive approach, inspired by LangChain's `RecursiveCharacterTextSplitter`, ensures that chunks are as large and semantically coherent as possible while staying within size limits.

### Overlap

Overlap is the intentional duplication of text at chunk boundaries. When overlap is configured, the end of one chunk is repeated at the beginning of the next chunk. Overlap provides context continuity: when a retrieval system returns chunk N, the LLM also has partial context from the end of chunk N-1 and the beginning of chunk N+1 embedded within chunk N's boundaries. Overlap is measured in tokens or characters (matching the chunk size unit) and is applied at boundary-aware positions -- the overlap region always starts and ends at a word boundary, never mid-word. Overlap is not applied to atomic units (a code fence at the end of one chunk is not partially duplicated into the next chunk).

### Heading Context

Heading context is the hierarchy of headings under which a chunk falls in the original document. For a chunk that appears under `## Authentication` > `### OAuth2 Flow`, the heading context is `["Authentication", "OAuth2 Flow"]`. This metadata enables hierarchical retrieval and gives the LLM structural context about where the chunk fits in the document. Heading context is tracked for markdown documents (via `#` headers) and HTML documents (via `<h1>`-`<h6>` elements).

### Token Counting

Token counting is the measurement of chunk size in tokens rather than characters. Tokens are the native unit of LLM processing -- embeddings are generated per token, context windows are measured in tokens, and chunk quality for retrieval is best when chunk size is expressed in tokens. `chunk-smart` supports pluggable token counters: the caller can provide any function with the signature `(text: string) => number`. The default counter uses the approximation of 1 token per 4 characters (a widely used heuristic for English text with GPT-family tokenizers). For exact counting, the caller wraps `tiktoken`, `gpt-tokenizer`, `@anthropic-ai/tokenizer`, or any provider-specific tokenizer.

---

## 5. Content Type Detection

When the caller does not specify a content type, `chunk-smart` auto-detects the input format by scanning for structural markers. Detection runs a set of heuristic checks in priority order and assigns a confidence score to each candidate type. The type with the highest confidence wins. If no type exceeds the minimum confidence threshold (0.3), the input falls back to `text`.

### Detection Heuristics

Detection analyzes the first 2000 characters of the input (for performance on large documents) plus a sampling of markers throughout the text.

#### Markdown Detection (confidence 0.0 - 1.0)

Markers that increase confidence:

| Marker | Confidence Boost | Pattern |
|--------|-----------------|---------|
| ATX headers | +0.3 per occurrence (max 0.6) | `/^#{1,6}\s+\S/m` |
| Fenced code blocks | +0.3 | Opening ` ``` ` or `~~~` |
| Pipe tables | +0.3 | `\|.*\|.*\|` with separator row |
| Markdown links | +0.1 per occurrence (max 0.3) | `[text](url)` |
| Emphasis/bold | +0.1 per occurrence (max 0.2) | `*text*`, `**text**`, `_text_` |
| Unordered lists | +0.1 per occurrence (max 0.2) | `/^[\s]*[-*+]\s+/m` |
| Blockquotes | +0.1 per occurrence (max 0.2) | `/^>\s+/m` |
| Frontmatter delimiters | +0.2 | `---` at start of document |
| Horizontal rules | +0.1 | `/^[-*_]{3,}\s*$/m` |

Markdown is the most common content type for RAG document ingestion. The detector is biased toward markdown when ambiguous signals are present (e.g., a document with both `#` headers and `<div>` tags is classified as markdown because markdown frequently contains inline HTML).

#### HTML Detection (confidence 0.0 - 1.0)

| Marker | Confidence Boost | Pattern |
|--------|-----------------|---------|
| DOCTYPE declaration | +0.5 | `<!DOCTYPE` (case-insensitive) |
| HTML/HEAD/BODY tags | +0.4 | `<html`, `<head`, `<body` |
| Block-level tags | +0.2 per unique tag (max 0.6) | `<div`, `<section`, `<article`, `<p>`, `<table` |
| Closing tags | +0.1 per occurrence (max 0.3) | `</div>`, `</p>`, `</section>` |
| Self-closing tags | +0.1 | `<br/>`, `<img/>`, `<hr/>` |
| HTML attributes | +0.1 per occurrence (max 0.2) | `class="..."`, `id="..."`, `style="..."` |

HTML detection requires the presence of actual HTML tags, not just angle brackets (which could be mathematical comparisons or template literals).

#### JSON Detection (confidence 0.0 - 1.0)

| Marker | Confidence Boost | Pattern |
|--------|-----------------|---------|
| Starts with `{` or `[` | +0.4 | After trimming whitespace |
| Valid JSON parse | +0.6 | `JSON.parse` succeeds on trimmed input |
| Key-value patterns | +0.2 per occurrence (max 0.4) | `"key": value` patterns |
| Nested braces/brackets | +0.1 | Multiple levels of `{` / `[` |

If the entire input is valid JSON, confidence is 1.0. If the input starts with `{` or `[` but is not valid JSON, confidence is lower (it might be JavaScript or malformed JSON).

#### YAML Detection (confidence 0.0 - 1.0)

| Marker | Confidence Boost | Pattern |
|--------|-----------------|---------|
| YAML document start | +0.4 | `---` at first line followed by key-value pairs |
| Key-value pairs | +0.2 per occurrence (max 0.4) | `/^\w[\w\s]*:\s+\S/m` (not inside code fences) |
| YAML-specific types | +0.2 | `!!str`, `!!int`, `!!map`, `&anchor`, `*alias` |
| Indentation-based nesting | +0.1 | Consistent 2-space indent hierarchy |
| No markdown headers | +0.1 | Absence of `#` as header (avoids YAML comment confusion) |

YAML detection avoids false positives from markdown frontmatter (which is YAML between `---` delimiters). If `---` appears at the document start and end, and the content between them looks like YAML but there is significant non-YAML content after the closing `---`, the content type is markdown (with frontmatter), not YAML.

#### Code Detection (confidence 0.0 - 1.0)

| Marker | Confidence Boost | Pattern |
|--------|-----------------|---------|
| Function declarations | +0.3 per occurrence (max 0.6) | `function`, `def`, `fn`, `func`, `sub`, `proc` |
| Class declarations | +0.3 | `class`, `struct`, `interface`, `enum`, `trait` |
| Import/require statements | +0.2 per occurrence (max 0.4) | `import`, `require`, `use`, `using`, `include`, `from` |
| Variable declarations | +0.1 per occurrence (max 0.2) | `const`, `let`, `var`, `val`, `mut` |
| Curly brace blocks | +0.1 | `{` and `}` without JSON key-value patterns |
| Semicolons at line endings | +0.1 per occurrence (max 0.2) | `/;\s*$/m` |
| Comment patterns | +0.1 per occurrence (max 0.2) | `//`, `/* */`, `#` (in Python/Ruby context) |
| Shebang line | +0.3 | `#!/usr/bin/env` or `#!/bin/` at start |

Code detection distinguishes between code and JSON by checking for function/class keywords and statement structure. A file full of `"key": value` pairs is JSON; a file with `function foo() { ... }` is code.

#### Plain Text Fallback

If no content type reaches the 0.3 confidence threshold, the input is classified as `text`. Plain text uses the recursive paragraph-sentence-word splitting strategy without any structure-aware atomic unit detection.

### Mixed Content Handling

Documents frequently contain mixed content types: a markdown file with embedded code blocks, an HTML page with embedded JSON-LD, a README with both markdown tables and code examples. `chunk-smart` handles mixed content through its atomic unit detection within the primary content type strategy. A markdown document is chunked using the markdown strategy, which recognizes code fences and tables as atomic units within the markdown structure. The code inside a fence is not re-chunked using the code strategy -- it is preserved as an atomic unit within the markdown chunk. This approach is simpler and more predictable than attempting to recursively switch strategies for embedded content.

---

## 6. Chunking Strategies

Each content type has a dedicated chunking strategy that understands its structural boundaries. All strategies share a common recursive fallback mechanism: when a segment exceeds the maximum chunk size and cannot be split at the strategy's native boundaries, the segment is recursively split using finer boundaries (paragraph, sentence, word, character).

### 6.1 Markdown Chunking Strategy

The markdown strategy is the most complex because markdown documents are the most common input for RAG pipelines and contain the widest variety of structural elements.

**Boundary hierarchy** (coarsest to finest):

1. **Header sections**: Split on `#` headers at a configurable depth. By default, every header (`#` through `######`) is a split point. The `headerDepth` option limits splitting to headers of depth N or less (e.g., `headerDepth: 2` splits only on `#` and `##`, keeping `###` and below within the same chunk).

2. **Horizontal rules**: `---`, `***`, or `___` lines are split points.

3. **Block-level boundaries**: Double newlines (paragraph breaks) between non-structural text.

4. **Sentence boundaries**: Period, exclamation mark, or question mark followed by whitespace or end of text.

5. **Word boundaries**: Whitespace between words.

**Atomic units preserved**:

| Unit | Detection | Handling |
|------|-----------|----------|
| Fenced code blocks | Opening ` ``` ` or `~~~` to matching closing fence | Entire fence (including markers and language tag) kept as one unit |
| Indented code blocks | 4+ spaces or tab at line start, consecutive lines | Entire block kept together |
| Pipe tables | Header row + separator row (`\|---\|`) + data rows | Full table kept as one unit |
| List groups | Consecutive lines starting with `- `, `* `, `+ `, `1. `, or `1) ` | All items kept together (configurable: `splitLists: true` splits between items) |
| Blockquotes | Lines starting with `> ` | Consecutive blockquote lines kept together |
| Frontmatter | `---` at document start to closing `---` | Kept as first chunk or excluded (configurable) |
| Math blocks | `$$` to closing `$$` | Kept as one unit |
| Admonition blocks | `:::` to closing `:::` | Kept as one unit |

**Heading context tracking**: As the chunker scans through headers, it maintains a heading stack. When a `##` header is encountered, it replaces the previous `##` entry and clears all deeper entries (`###`, `####`, etc.). Each chunk's metadata receives the current heading context as a string array: `["Getting Started", "Installation", "From npm"]`.

**Frontmatter handling**: YAML frontmatter (content between `---` delimiters at the document start) is detected and handled according to the `frontmatter` option:
- `'preserve'` (default): frontmatter is the first chunk or merged into the first content chunk.
- `'exclude'`: frontmatter is stripped from the output entirely.
- `'metadata'`: frontmatter is parsed and attached to every chunk's metadata as `frontmatter: Record<string, unknown>`, but not included in any chunk's content.

### 6.2 Code Chunking Strategy

The code strategy splits source code at function, class, and module-level boundaries without requiring a full AST.

**Boundary hierarchy**:

1. **Module-level declarations**: Function declarations, class declarations, top-level variable declarations (separated by blank lines).
2. **Import blocks**: Consecutive `import`/`require`/`use`/`include` statements are kept as a single unit.
3. **Function/class boundaries**: Detected by keyword patterns (`function`, `class`, `def`, `fn`, `pub fn`, `func`, `sub`, `proc`, `method`) combined with brace matching or indentation tracking.
4. **Blank line boundaries**: Double blank lines within top-level scope.
5. **Single line boundaries**: Any line break (last resort before word/character splitting).

**Language-aware heuristics**: The `language` option (or auto-detected language from file extension or shebang) selects language-specific boundary patterns:

| Language Family | Function Pattern | Block Delimiters | Import Pattern |
|----------------|-----------------|------------------|----------------|
| C-style (JS, TS, Java, C#, Go, Rust) | `function`, `const ... =`, `class`, `interface` | `{ }` brace matching | `import`, `require` |
| Python | `def`, `class`, `async def` | Indentation-based (4-space or tab) | `import`, `from ... import` |
| Ruby | `def`, `class`, `module` | `def`/`end`, `class`/`end`, `do`/`end` | `require`, `require_relative` |
| Shell (Bash, Zsh) | Function definition patterns | `{ }` or indentation | `source`, `.` |
| Generic fallback | Blank-line separated blocks | Brace matching with fallback to blank lines | N/A |

**Brace matching**: For C-style languages, the chunker uses a state machine to track brace depth. A function or class declaration starts at depth 0 and extends until the matching closing brace at depth 0. Braces inside string literals and comments are excluded from depth tracking.

**Comment preservation**: Comments immediately preceding a function or class declaration (JSDoc blocks, docstrings, `#` comment blocks) are kept with the declaration, not split into a separate chunk.

### 6.3 HTML Chunking Strategy

The HTML strategy splits on block-level element boundaries while preserving complete tag structures.

**Boundary hierarchy**:

1. **Heading elements**: `<h1>` through `<h6>` start new sections.
2. **Sectioning elements**: `<section>`, `<article>`, `<aside>`, `<nav>`, `<header>`, `<footer>`, `<main>` boundaries.
3. **Block-level elements**: `<div>`, `<p>`, `<blockquote>`, `<pre>`, `<ul>`, `<ol>`, `<table>`, `<form>`, `<figure>`, `<details>`.
4. **Line breaks**: `<br>` and `<hr>` elements.
5. **Text content boundaries**: Whitespace between text nodes.

**Tag balancing**: The chunker ensures that every chunk contains balanced opening and closing tags. When splitting within a nested structure (e.g., between two `<p>` elements inside a `<div>`), the chunker does not insert synthetic closing/opening tags -- it finds split points where the tag stack is empty or at a level that produces self-contained HTML fragments. The `preserveTagHierarchy` option (default: `false`) wraps each chunk in the ancestor tags if set to `true`, producing chunks like `<div><section>chunk content</section></div>`.

**Atomic units**: `<pre>` blocks (preformatted text/code), `<table>` elements (complete table with all rows), `<svg>` elements, and `<script>`/`<style>` blocks are treated as atomic.

**Tag stripping**: The `stripTags` option (default: `false`) removes HTML tags from chunk content, producing plain text chunks from HTML input. Tag boundaries are still used for splitting decisions, but the output is clean text.

### 6.4 JSON Chunking Strategy

The JSON strategy splits JSON documents at object and array boundaries.

**Splitting rules**:

1. **Top-level array**: Each element of a top-level array becomes a separate chunk (or multiple elements are grouped to reach the target chunk size).
2. **Top-level object**: Properties are grouped into chunks. Related properties (determined by key name proximity or explicit configuration) are kept together.
3. **Nested structures**: Objects and arrays below the top level are treated as atomic units. A nested object is never split across chunks unless it exceeds the maximum chunk size.
4. **Large nested values**: When a single value (a deeply nested object or a very long string) exceeds the maximum chunk size, it is force-split. For nested objects/arrays, splitting occurs at the first level of internal structure. For strings, splitting occurs at sentence or word boundaries.

**JSON path metadata**: Each chunk's metadata includes the JSON path(s) of the properties it contains: `["$.users[0]", "$.users[1]", "$.users[2]"]`. This enables downstream systems to locate the chunk's data within the original JSON structure.

**Pretty-printing**: JSON chunks are always pretty-printed (indented) for readability, regardless of the input formatting. The `compact` option (default: `false`) outputs minified JSON.

### 6.5 YAML Chunking Strategy

The YAML strategy splits YAML documents at document and top-level key boundaries.

**Splitting rules**:

1. **Multi-document YAML**: Documents separated by `---` are split into individual chunks.
2. **Top-level keys**: Each top-level key-value pair is a candidate split point.
3. **Nested blocks**: Indented blocks under a key are kept as atomic units.
4. **Comment preservation**: Comments preceding a key are kept with that key.

### 6.6 Plain Text Chunking Strategy

The plain text strategy uses recursive splitting with no structure-specific awareness.

**Boundary hierarchy** (following the same approach as LangChain's `RecursiveCharacterTextSplitter`):

1. **Double newlines** (`\n\n`): Paragraph boundaries.
2. **Single newlines** (`\n`): Line boundaries.
3. **Sentence endings** (`.`, `!`, `?` followed by space): Sentence boundaries.
4. **Spaces** (` `): Word boundaries.
5. **Empty string** (``): Character-level splitting (last resort).

The algorithm tries the coarsest separator first. If the resulting segments fit within the maximum chunk size, they are returned as chunks. If any segment is too large, it is recursively split using the next finer separator. This continues until all segments are within the size limit.

### 6.7 Recursive Fallback

All content-type-specific strategies share a common fallback mechanism. When any strategy produces a segment that exceeds the maximum chunk size and cannot be further split at its native boundaries, the segment enters the recursive fallback:

1. Split on double newlines. Check sizes.
2. Split on single newlines. Check sizes.
3. Split on sentence boundaries. Check sizes.
4. Split on word boundaries. Check sizes.
5. Split on characters (hard split at `maxChunkSize`).

The fallback ensures that `chunk-smart` always produces chunks within the configured size limits, even for pathological input (a single 100KB paragraph with no sentence boundaries).

---

## 7. Atomic Units

Atomic units are structural elements that the chunker preserves as indivisible blocks. This section specifies the detection, handling, and edge cases for each atomic unit type.

### 7.1 Fenced Code Blocks

**Detection**: Opening fence marker (` ``` ` or `~~~`, optionally followed by a language identifier) at the start of a line, extending to the matching closing fence marker at the start of a subsequent line. The closing marker must use the same character (backtick or tilde) and at least the same count as the opening marker.

**Preservation**: The entire code block -- opening fence, language tag, all content lines, and closing fence -- is kept in a single chunk. The chunk metadata includes `codeLanguage` set to the detected language tag (e.g., `"python"`, `"typescript"`, `"sql"`).

**Oversized handling**: If a code block exceeds the maximum chunk size, it is force-split at line boundaries within the code content. Each resulting chunk retains the fence markers (the opening fence on the first sub-chunk, the closing fence on the last sub-chunk, and the metadata `forceSplit: true` on all sub-chunks). The language tag is preserved on all sub-chunks.

**Nested fences**: A code block may contain text that looks like fence markers (e.g., a markdown tutorial showing how to write code fences). The chunker handles this by matching fence depth: if the opening fence uses three backticks, only a line with three or more backticks at the start closes it. Fences delimited by four backticks (``````) can contain three-backtick fences without ambiguity.

### 7.2 Markdown Tables

**Detection**: A line containing at least two pipe characters (`|`), followed by a separator line matching `/^\|?[\s:-]+(\|[\s:-]+)+\|?\s*$/`, followed by one or more data rows with consistent pipe structure.

**Preservation**: The header row, separator row, and all data rows are kept together as a single atomic unit. If the table is preceded by a caption or heading, the heading becomes part of the heading context, not part of the table chunk.

**Oversized handling**: If a table exceeds the maximum chunk size, it is split by rows. The header row and separator row are duplicated in each sub-chunk (so every sub-chunk is a valid, self-contained table). Metadata includes `forceSplit: true` and `tableRowRange: [startRow, endRow]` (zero-indexed data rows, excluding the header).

### 7.3 HTML Block Elements

**Detection**: Opening tags for block-level elements (`<div>`, `<section>`, `<article>`, `<pre>`, `<table>`, `<ul>`, `<ol>`, `<blockquote>`, `<figure>`, `<details>`, `<aside>`, `<nav>`, `<main>`, `<header>`, `<footer>`, `<form>`) extending to their matching closing tags. Tag matching handles nesting: a `<div>` inside a `<div>` is matched correctly by tracking depth.

**Preservation**: The complete element from opening tag to closing tag (inclusive) is kept as one unit.

**Oversized handling**: For oversized block elements, the chunker splits at child element boundaries within the block. A large `<div>` containing multiple `<p>` elements is split between the `<p>` elements.

### 7.4 JSON Objects and Arrays

**Detection**: Matching `{`/`}` and `[`/`]` pairs, tracked by a bracket-matching state machine that respects string literals (content between unescaped double quotes).

**Preservation**: A complete JSON object or array is kept whole. In the JSON chunking strategy, top-level array elements are the natural split points. In other strategies (e.g., markdown with embedded JSON), any JSON structure is treated as an atomic unit.

**Oversized handling**: Oversized JSON objects are split at the first level of internal structure (top-level properties for objects, elements for arrays). Each sub-chunk is valid JSON.

### 7.5 Frontmatter (YAML)

**Detection**: The document starts with `---` on its own line, followed by content, followed by `---` on its own line. The content between the delimiters is YAML frontmatter.

**Handling**: Controlled by the `frontmatter` option. When preserved, frontmatter is included in the first chunk. When excluded, it is removed. When set to `'metadata'`, the YAML is parsed and attached to every chunk's metadata without appearing in any chunk's content.

### 7.6 Math Blocks

**Detection**: Opening `$$` on its own line (or inline `$$`), extending to the matching closing `$$`.

**Preservation**: The entire math block (including `$$` delimiters) is kept as one unit. Inline math (`$...$`) is not treated as an atomic unit but is never split mid-expression (it is treated as a word-level unit).

### 7.7 List Groups

**Detection**: Consecutive lines starting with list markers (`- `, `* `, `+ `, `1. `, `1) `) at the same or deeper indentation level.

**Preservation**: By default, all consecutive list items are kept together as a single group. The `splitLists` option (default: `false`) allows splitting between list items when the group exceeds the maximum chunk size. When `splitLists` is true, the list is split at the boundary between top-level items (nested sub-items stay with their parent item).

---

## 8. Overlap

### How Overlap Works

When `overlap` is greater than zero, the chunker duplicates content from the end of one chunk at the beginning of the next chunk. This provides context continuity for embedding models and retrieval systems.

**Overlap measurement**: Overlap is measured in the same unit as `maxChunkSize` -- tokens (default) or characters. An overlap of 50 tokens means that the last 50 tokens of chunk N appear at the beginning of chunk N+1.

**Boundary-aware overlap**: The overlap region is adjusted to start and end at word boundaries. If the exact overlap size would land mid-word, the overlap is extended slightly to the next word boundary. This ensures that overlapped text is coherent and does not contain partial words.

**Overlap and atomic units**: Overlap is not applied across atomic unit boundaries. If chunk N ends with a code fence, the code fence is not partially duplicated into chunk N+1. Instead, the overlap draws from the text preceding the code fence (if any). If chunk N is entirely an atomic unit (e.g., a single large table), no overlap is applied to that boundary.

**Overlap indicators in metadata**: Each chunk's metadata includes `overlapBefore` and `overlapAfter` fields indicating how many tokens/characters of overlap exist at each end. The first chunk always has `overlapBefore: 0`. The last chunk always has `overlapAfter: 0`.

### Why Overlap Matters for RAG

Retrieval works by finding the chunks whose embeddings are most similar to the query embedding. If a relevant passage falls exactly at a chunk boundary, the passage is split between two chunks, and neither chunk alone contains the complete passage. Overlap ensures that boundary passages appear fully in at least one chunk. Research and practice recommend overlap of 10-20% of the chunk size for most use cases (e.g., 50-100 tokens for a 512-token chunk).

### Configuration

```typescript
chunk(text, {
  maxChunkSize: 512,   // tokens
  overlap: 50,          // tokens of overlap between consecutive chunks
});
```

---

## 9. API Surface

### Installation

```bash
npm install chunk-smart
```

### No Runtime Dependencies

`chunk-smart` has zero runtime dependencies. All chunking logic -- content type detection, boundary scanning, brace matching, recursive splitting, overlap application, metadata computation -- is implemented using Node.js built-in modules and hand-written code.

### Main Export: `chunk`

The primary API. Auto-detects content type and returns an array of chunks.

```typescript
import { chunk } from 'chunk-smart';

const chunks = chunk('# Hello\n\nThis is a paragraph.\n\n```js\nconsole.log("hi");\n```\n\nAnother paragraph.');

console.log(chunks.length);
// 3

console.log(chunks[0].content);
// '# Hello\n\nThis is a paragraph.'

console.log(chunks[1].content);
// '```js\nconsole.log("hi");\n```'

console.log(chunks[1].metadata.contentType);
// 'markdown'

console.log(chunks[1].metadata.codeLanguage);
// 'js'
```

### Content-Type-Specific Exports

```typescript
import { chunkMarkdown, chunkCode, chunkHTML, chunkJSON } from 'chunk-smart';

// Markdown-specific chunking
const mdChunks = chunkMarkdown(markdownText, { headerDepth: 2, maxChunkSize: 512 });

// Code-specific chunking
const codeChunks = chunkCode(sourceCode, { language: 'typescript', maxChunkSize: 256 });

// HTML-specific chunking
const htmlChunks = chunkHTML(htmlText, { stripTags: true, maxChunkSize: 512 });

// JSON-specific chunking
const jsonChunks = chunkJSON(jsonText, { maxChunkSize: 1024 });
```

### Factory Export: `createChunker`

Creates a configured chunker instance with preset options.

```typescript
import { createChunker } from 'chunk-smart';

const chunker = createChunker({
  maxChunkSize: 512,
  overlap: 50,
  sizeUnit: 'tokens',
  tokenCounter: myCustomTokenCounter,
});

const chunks1 = chunker.chunk(document1);
const chunks2 = chunker.chunk(document2);
const chunks3 = chunker.chunkMarkdown(markdownDoc);
```

### Detection Export: `detectContentType`

Detects the content type of text without chunking it. Useful when the caller wants to route text through different processing pipelines based on content type.

```typescript
import { detectContentType } from 'chunk-smart';

const result = detectContentType(someText);

console.log(result.type);
// 'markdown'

console.log(result.confidence);
// 0.85
```

### Type Definitions

```typescript
// ── Content Types ───────────────────────────────────────────────────

/** Recognized content types for chunking strategy selection. */
type ContentType = 'markdown' | 'code' | 'html' | 'json' | 'yaml' | 'text';

/** Unit of measurement for chunk sizes. */
type SizeUnit = 'tokens' | 'characters';

// ── Chunk Output ────────────────────────────────────────────────────

/** A single chunk produced by the chunker. */
interface Chunk {
  /** The text content of this chunk. */
  content: string;

  /** Metadata describing this chunk's position, size, and context. */
  metadata: ChunkMetadata;
}

/** Metadata attached to every chunk. */
interface ChunkMetadata {
  /** Zero-based sequential index of this chunk in the output array. */
  index: number;

  /** Byte offset in the original text where this chunk's content starts.
   *  Does not include overlap -- refers to the non-overlapped content. */
  startOffset: number;

  /** Byte offset in the original text where this chunk's content ends (exclusive). */
  endOffset: number;

  /** Number of tokens in this chunk's content.
   *  Computed using the configured token counter. */
  tokenCount: number;

  /** Number of characters in this chunk's content. */
  charCount: number;

  /** The content type that was used to chunk this text. */
  contentType: ContentType;

  /** The hierarchy of headings under which this chunk falls.
   *  Example: ["Getting Started", "Installation", "From npm"].
   *  Empty array if no heading context is available. */
  headings: string[];

  /** The language of a code block, if this chunk contains or is a code block.
   *  Undefined if not applicable. */
  codeLanguage?: string;

  /** Number of tokens/characters of overlap at the beginning of this chunk
   *  (duplicated from the end of the previous chunk). Zero for the first chunk. */
  overlapBefore: number;

  /** Number of tokens/characters of overlap at the end of this chunk
   *  (duplicated at the beginning of the next chunk). Zero for the last chunk. */
  overlapAfter: number;

  /** True if this chunk was produced by force-splitting an oversized atomic unit.
   *  Callers should be aware that the chunk may not be structurally complete. */
  forceSplit: boolean;

  /** For force-split tables: the range of data rows (zero-indexed) in this chunk. */
  tableRowRange?: [number, number];

  /** For JSON chunks: the JSON path(s) of properties in this chunk. */
  jsonPaths?: string[];

  /** Custom metadata passed through from the caller's options. */
  custom?: Record<string, unknown>;
}

// ── Options ─────────────────────────────────────────────────────────

/** Options for the chunk function. */
interface ChunkOptions {
  /**
   * Maximum chunk size. Chunks will not exceed this size (except when an
   * atomic unit larger than this is force-split, in which case each
   * sub-chunk is at most this size).
   * Default: 512.
   */
  maxChunkSize?: number;

  /**
   * Minimum chunk size. Chunks smaller than this are merged with adjacent
   * chunks (forward merge preferred, backward merge as fallback).
   * Default: 50.
   */
  minChunkSize?: number;

  /**
   * Target chunk size. The chunker aims for chunks near this size,
   * using boundaries to find natural split points within the range
   * [minChunkSize, maxChunkSize].
   * Default: equal to maxChunkSize.
   */
  targetChunkSize?: number;

  /**
   * Number of tokens/characters of overlap between consecutive chunks.
   * Default: 0 (no overlap).
   */
  overlap?: number;

  /**
   * Unit of measurement for maxChunkSize, minChunkSize, targetChunkSize,
   * and overlap.
   * Default: 'tokens'.
   */
  sizeUnit?: SizeUnit;

  /**
   * Custom token counting function. Receives a string and returns the
   * number of tokens. Overrides the default approximate counter (chars / 4).
   * Only used when sizeUnit is 'tokens'.
   */
  tokenCounter?: (text: string) => number;

  /**
   * Content type of the input. If not specified, the content type is
   * auto-detected from the input text.
   */
  contentType?: ContentType;

  /**
   * Whether to preserve structural elements as atomic units.
   * When false, all splitting is purely size-based with no structural awareness.
   * Default: true.
   */
  preserveStructure?: boolean;

  /**
   * Custom metadata to attach to every chunk's metadata.custom field.
   * Useful for passing through document IDs, source file paths, etc.
   */
  customMetadata?: Record<string, unknown>;
}

/** Additional options for chunkMarkdown. */
interface MarkdownChunkOptions extends ChunkOptions {
  /**
   * Maximum header depth to split on. Headers deeper than this are not
   * treated as split points.
   * 1 = split only on #. 2 = split on # and ##. 6 = split on all headers.
   * Default: 6 (split on all headers).
   */
  headerDepth?: number;

  /**
   * How to handle YAML frontmatter.
   * 'preserve': include as first chunk or merge into first content chunk.
   * 'exclude': strip from output.
   * 'metadata': parse and attach to all chunks' metadata, exclude from content.
   * Default: 'preserve'.
   */
  frontmatter?: 'preserve' | 'exclude' | 'metadata';

  /**
   * Whether to split between list items when a list group exceeds maxChunkSize.
   * Default: false (keep list groups together, force-split only as last resort).
   */
  splitLists?: boolean;
}

/** Additional options for chunkCode. */
interface CodeChunkOptions extends ChunkOptions {
  /**
   * Programming language of the input. Used to select language-specific
   * boundary patterns. If not specified, the language is auto-detected
   * from syntax patterns.
   */
  language?: string;
}

/** Additional options for chunkHTML. */
interface HTMLChunkOptions extends ChunkOptions {
  /**
   * Whether to strip HTML tags from chunk content, producing plain text.
   * Tag boundaries are still used for splitting decisions.
   * Default: false.
   */
  stripTags?: boolean;

  /**
   * Whether to wrap each chunk in its ancestor tags to preserve
   * the tag hierarchy.
   * Default: false.
   */
  preserveTagHierarchy?: boolean;
}

/** Additional options for chunkJSON. */
interface JSONChunkOptions extends ChunkOptions {
  /**
   * Whether to output minified JSON.
   * Default: false (pretty-printed).
   */
  compact?: boolean;
}

// ── Detection ───────────────────────────────────────────────────────

/** Result of content type detection. */
interface DetectResult {
  /** The detected content type. */
  type: ContentType;

  /** Confidence score (0.0 to 1.0). */
  confidence: number;
}

// ── Chunker Instance ────────────────────────────────────────────────

/** A configured chunker instance created by createChunker(). */
interface Chunker {
  /** Auto-detecting chunk function with preset options. */
  chunk(text: string, overrides?: Partial<ChunkOptions>): Chunk[];

  /** Markdown-specific chunking with preset options. */
  chunkMarkdown(text: string, overrides?: Partial<MarkdownChunkOptions>): Chunk[];

  /** Code-specific chunking with preset options. */
  chunkCode(text: string, overrides?: Partial<CodeChunkOptions>): Chunk[];

  /** HTML-specific chunking with preset options. */
  chunkHTML(text: string, overrides?: Partial<HTMLChunkOptions>): Chunk[];

  /** JSON-specific chunking with preset options. */
  chunkJSON(text: string, overrides?: Partial<JSONChunkOptions>): Chunk[];

  /** Detect content type with preset options. */
  detectContentType(text: string): DetectResult;
}
```

---

## 10. Chunk Metadata

Every chunk carries a `metadata` object that provides context beyond the chunk text itself. This metadata enables downstream systems (embedding generators, retrieval engines, prompt builders) to make informed decisions about how to process, store, and present each chunk.

### Sequential Index

`metadata.index` is a zero-based integer indicating this chunk's position in the output array. The first chunk has index 0, the last has index `chunks.length - 1`. Useful for ordering, pagination, and reconstructing the original document from chunks.

### Source Offsets

`metadata.startOffset` and `metadata.endOffset` are byte positions in the original input text that correspond to this chunk's content (excluding overlap). These offsets enable mapping a chunk back to its position in the source document, which is useful for highlighting, citation, and linking to the original.

### Token Count

`metadata.tokenCount` is the number of tokens in this chunk's content, computed using the configured token counter. This value is pre-computed to save downstream systems from re-counting tokens when deciding chunk batch sizes, embedding batch limits, or context window packing.

### Character Count

`metadata.charCount` is the number of characters in this chunk's content. Always available regardless of the `sizeUnit` setting.

### Content Type

`metadata.contentType` is the content type used to chunk this text. This is either the auto-detected type or the caller-specified type. Useful when processing heterogeneous document collections where different chunks may have different content types.

### Heading Context

`metadata.headings` is a string array representing the heading hierarchy under which this chunk falls. For a chunk under `## API Reference` > `### Authentication` > `#### OAuth2`, the value is `["API Reference", "Authentication", "OAuth2"]`. The heading context is tracked for markdown (ATX headers) and HTML (`<h1>`-`<h6>` elements). For other content types, this array is empty.

Heading context enables hierarchical retrieval: a search engine can boost chunks whose heading context matches the query topic, and a RAG prompt builder can include the heading context as structural context for the LLM.

### Code Language

`metadata.codeLanguage` is the language identifier from a code fence's language tag (e.g., `"python"`, `"typescript"`, `"sql"`). Present when the chunk contains or is a fenced code block. For `chunkCode`, this reflects the detected or specified language of the entire source file.

### Overlap Indicators

`metadata.overlapBefore` and `metadata.overlapAfter` indicate the number of tokens (or characters, matching `sizeUnit`) of overlap at each end of the chunk. These values enable downstream systems to de-duplicate overlapped content when reconstructing the original text or when computing unique token counts.

### Force Split Flag

`metadata.forceSplit` is `true` when this chunk was produced by force-splitting an oversized atomic unit. This flag warns downstream systems that the chunk may be structurally incomplete (e.g., a partial code block, a table without all its rows). Systems can handle force-split chunks differently: display a warning, skip embedding, or attempt to merge with adjacent chunks.

### Custom Metadata Passthrough

`metadata.custom` is a caller-provided `Record<string, unknown>` that is attached to every chunk unchanged. This enables passing through document-level metadata (file path, document ID, source URL, author, creation date) to every chunk without modifying the chunking logic.

```typescript
const chunks = chunk(text, {
  customMetadata: {
    documentId: 'doc-42',
    source: '/docs/api-reference.md',
    ingestionTimestamp: Date.now(),
  },
});

chunks[0].metadata.custom;
// { documentId: 'doc-42', source: '/docs/api-reference.md', ingestionTimestamp: 1710720000000 }
```

---

## 11. Size Control

### Maximum Chunk Size

`maxChunkSize` (default: 512) is the hard ceiling for chunk size. No chunk will exceed this size, measured in the configured `sizeUnit` (tokens or characters). When a segment from boundary-based splitting exceeds this size, it is recursively split at finer boundaries until all sub-segments fit.

The default of 512 tokens is chosen because it is a widely recommended chunk size for embedding models. OpenAI's `text-embedding-3-small` and `text-embedding-3-large` have a context window of 8191 tokens but produce best-quality embeddings on focused, coherent chunks of 256-1024 tokens. The 512-token default provides a good balance between embedding quality and chunk count.

### Minimum Chunk Size

`minChunkSize` (default: 50) is the soft floor for chunk size. After splitting, chunks smaller than this size are merged with adjacent chunks. Forward merge is preferred (merge the small chunk into the next chunk), with backward merge as fallback (merge into the previous chunk). The first and last chunks are exempt from the minimum size check (a document may naturally start or end with a short section).

The minimum size prevents the creation of tiny chunks that contain too little context for meaningful embedding. A chunk containing only "See below:" or "## Next Steps" produces a poor embedding and wastes a vector store entry.

### Target Chunk Size

`targetChunkSize` (default: equal to `maxChunkSize`) is the ideal chunk size. When choosing between split points that would produce chunks of different sizes, the chunker prefers the split that produces chunks closest to the target size. This provides tighter control than `maxChunkSize` alone: setting `maxChunkSize: 1024, targetChunkSize: 512` allows chunks to grow up to 1024 tokens when structural boundaries demand it, but aims for 512 tokens when multiple split points are available.

### Size Measurement

The `sizeUnit` option (default: `'tokens'`) determines how sizes are measured:

| Unit | Measurement Method | Use Case |
|------|-------------------|----------|
| `tokens` | Counted by the configured `tokenCounter` function. Default: `Math.ceil(text.length / 4)`. | RAG pipelines where embedding models and LLM context windows are measured in tokens. |
| `characters` | `text.length` (JavaScript string length, which counts UTF-16 code units). | Simple use cases where token counting overhead is undesirable, or when processing non-LLM text. |

### Pluggable Token Counter

The `tokenCounter` option accepts any function with the signature `(text: string) => number`. This enables exact token counting with any tokenizer:

```typescript
import { chunk } from 'chunk-smart';
import { encoding_for_model } from 'tiktoken';

const enc = encoding_for_model('gpt-4o');
const tokenCounter = (text: string) => enc.encode(text).length;

const chunks = chunk(document, {
  maxChunkSize: 512,
  tokenCounter,
});
```

The default approximate counter (`Math.ceil(text.length / 4)`) avoids a dependency on any tokenizer library and is sufficient for most use cases. The approximation of 4 characters per token is well-established for English text with GPT-family tokenizers. For multilingual text or exact token budgets, callers should provide a precise counter.

---

## 12. Configuration

### Default Values

| Option | Default | Description |
|--------|---------|-------------|
| `maxChunkSize` | `512` | Maximum chunk size in tokens. |
| `minChunkSize` | `50` | Minimum chunk size in tokens. |
| `targetChunkSize` | `512` (equals `maxChunkSize`) | Target chunk size in tokens. |
| `overlap` | `0` | No overlap between chunks. |
| `sizeUnit` | `'tokens'` | Size measurement unit. |
| `tokenCounter` | `(text) => Math.ceil(text.length / 4)` | Approximate token counter. |
| `contentType` | `undefined` (auto-detect) | Content type of input. |
| `preserveStructure` | `true` | Preserve atomic units. |
| `customMetadata` | `undefined` | No custom metadata. |
| `headerDepth` | `6` | Split on all header levels. |
| `frontmatter` | `'preserve'` | Include frontmatter in output. |
| `splitLists` | `false` | Keep list groups together. |
| `language` | `undefined` (auto-detect) | Code language. |
| `stripTags` | `false` | Keep HTML tags in output. |
| `preserveTagHierarchy` | `false` | Do not wrap chunks in ancestor tags. |
| `compact` | `false` | Pretty-print JSON chunks. |

### Configuration Precedence

When using `createChunker`, options are merged with the following precedence (highest first):

1. Per-call overrides passed to `chunker.chunk(text, overrides)`.
2. Factory-level options passed to `createChunker(options)`.
3. Built-in defaults.

---

## 13. CLI Interface

### Installation and Invocation

```bash
# Global install
npm install -g chunk-smart
chunk-smart document.md

# npx (no install)
npx chunk-smart --max-size 256 --overlap 50 < document.md

# Package script
# package.json: { "scripts": { "chunk": "chunk-smart --max-size 512" } }
```

### CLI Binary Name

`chunk-smart`

### Commands and Flags

```
chunk-smart [file] [options]

Input (reads from stdin if no file specified):
  [file]                     Path to the file to chunk.
  --stdin                    Explicitly read from stdin (default when no file).

Chunking options:
  --max-size <n>             Maximum chunk size. Default: 512.
  --min-size <n>             Minimum chunk size. Default: 50.
  --target-size <n>          Target chunk size. Default: equals max-size.
  --overlap <n>              Overlap between chunks. Default: 0.
  --unit <unit>              Size unit: tokens, characters. Default: tokens.
  --content-type <type>      Content type: markdown, code, html, json, yaml, text.
                             Default: auto-detect.
  --no-structure             Disable structure-aware chunking. Split by size only.

Markdown options:
  --header-depth <n>         Maximum header depth for splitting (1-6). Default: 6.
  --frontmatter <mode>       Frontmatter handling: preserve, exclude, metadata.
                             Default: preserve.
  --split-lists              Split between list items when oversized.

Code options:
  --language <lang>          Programming language for code chunking.

HTML options:
  --strip-tags               Strip HTML tags from output chunks.

Output options:
  --format <format>          Output format: json, jsonl, text.
                             json: array of Chunk objects (default).
                             jsonl: one Chunk JSON object per line.
                             text: chunk content only, separated by ----.
  --compact                  Compact JSON output (no pretty-printing).
  --content-only             Output only chunk content, not metadata.

General:
  --version                  Print version and exit.
  --help                     Print help and exit.
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success. Chunks written to stdout. |
| `1` | Input error. File not found, read failure, or empty input. |
| `2` | Configuration error. Invalid flags or incompatible options. |

### Usage Examples

```bash
# Chunk a markdown file with default settings
chunk-smart README.md

# Chunk code with language hint
chunk-smart src/index.ts --content-type code --language typescript --max-size 256

# Chunk from stdin with overlap, output as JSONL
cat document.md | chunk-smart --max-size 512 --overlap 50 --format jsonl

# Chunk and pipe through jq to extract content only
chunk-smart api-docs.md | jq '.[].content'

# Chunk HTML with tag stripping for plain text output
chunk-smart page.html --content-type html --strip-tags --format text

# Quick content-only output for inspection
chunk-smart --content-only --format text < notes.md
```

---

## 14. Integration

### With `embed-cache`

`embed-cache` provides a content-addressable embedding cache with deduplication and TTL. `chunk-smart` produces the chunks; `embed-cache` generates and caches their embeddings.

```typescript
import { chunk } from 'chunk-smart';
import { createEmbedCache } from 'embed-cache';

const cache = createEmbedCache({ provider: 'openai', model: 'text-embedding-3-small' });
const chunks = chunk(documentText, { maxChunkSize: 512 });

const embeddings = await Promise.all(
  chunks.map(c => cache.embed(c.content)),
);
```

### With `context-packer`

`context-packer` optimally packs retrieved chunks into an LLM context window. `chunk-smart` produces chunks with token counts in metadata; `context-packer` uses those counts to pack as many relevant chunks as possible without exceeding the context limit.

```typescript
import { chunk } from 'chunk-smart';
import { packContext } from 'context-packer';

const chunks = chunk(documentText, { maxChunkSize: 512 });
const retrieved = search(queryEmbedding, chunkEmbeddings, { topK: 20 });

const packed = packContext(
  retrieved.map(r => chunks[r.index]),
  { maxTokens: 4096 },
);
```

### With `rag-prompt-builder`

`rag-prompt-builder` composes RAG prompts from chunks with automatic metadata injection. `chunk-smart`'s heading context metadata enables `rag-prompt-builder` to include structural context in the prompt.

```typescript
import { chunk } from 'chunk-smart';
import { buildPrompt } from 'rag-prompt-builder';

const chunks = chunk(documentText, { maxChunkSize: 512 });
const retrieved = search(query, chunks);

const prompt = buildPrompt({
  query,
  chunks: retrieved,
  includeHeadings: true,  // uses chunk.metadata.headings
});
```

### With `table-chunk`

`table-chunk` provides specialized table extraction and chunking that preserves row/column structure. For documents heavy on tables, `chunk-smart`'s built-in table handling covers the common case (keep tables atomic, force-split with header duplication for oversized tables). For advanced table processing (column-aware splitting, row filtering, cell-level chunking), use `table-chunk` as a post-processor for chunks that contain tables.

### With `chunk-overlap-optimizer`

`chunk-overlap-optimizer` analyzes chunk boundaries and recommends optimal overlap size. Feed `chunk-smart`'s output (with overlap = 0) to `chunk-overlap-optimizer` to determine the best overlap setting, then re-chunk with the recommended overlap.

---

## 15. Testing Strategy

### Unit Tests

Unit tests verify individual components in isolation.

- **Content type detection tests**: Verify correct detection for each content type. Test pure markdown, pure HTML, pure JSON, pure YAML, pure code (multiple languages), and plain text. Test ambiguous inputs (markdown with inline HTML, JSON that looks like code). Test confidence scores.
- **Boundary detection tests**: Verify that each boundary type (header, paragraph, sentence, word) is correctly identified. Test edge cases: abbreviations in sentences ("Dr. Smith"), URLs containing periods, ellipses.
- **Atomic unit detection tests**: Verify detection of code fences (backtick and tilde, with and without language tags, nested fences), tables (with and without separator rows, with and without outer pipes), HTML block elements (nested, self-closing), JSON objects (nested, with strings containing braces), frontmatter, math blocks, list groups.
- **Size measurement tests**: Verify token counting with default and custom counters. Verify character counting. Verify that chunks respect maxChunkSize, minChunkSize, and targetChunkSize.
- **Overlap tests**: Verify overlap application at word boundaries. Verify overlap indicators in metadata. Verify no overlap across atomic unit boundaries. Verify first/last chunk overlap values.
- **Metadata tests**: Verify sequential index assignment, source offsets, token counts, content type, heading context tracking (header push/pop), code language extraction, force split flag, custom metadata passthrough.
- **Merge tests**: Verify that chunks below minChunkSize are merged with adjacent chunks. Verify forward merge preference. Verify backward merge fallback.

### Strategy Tests

Tests for each content-type-specific chunking strategy.

- **Markdown strategy tests**: Real markdown documents with headers, code fences, tables, lists, blockquotes, frontmatter, math blocks, mixed content. Verify heading context propagation across nested headers. Verify frontmatter handling in all three modes.
- **Code strategy tests**: Real source files in JavaScript, TypeScript, Python, and Go. Verify function/class boundary detection. Verify import block preservation. Verify comment attachment. Verify language auto-detection.
- **HTML strategy tests**: Real HTML documents with nested divs, tables, lists, pre blocks, script tags. Verify tag balancing. Verify stripTags option. Verify preserveTagHierarchy option.
- **JSON strategy tests**: Real JSON files with arrays of objects, nested structures, large string values. Verify JSON path metadata. Verify pretty-printing.
- **Plain text strategy tests**: Prose paragraphs, documents with no structure, single long paragraphs. Verify recursive fallback through all boundary levels.

### Integration Tests

End-to-end tests that verify the complete pipeline from input text to output chunks.

- **Roundtrip test**: Chunk a document, concatenate all chunks (removing overlap), verify the result matches the original input.
- **Size compliance test**: Chunk documents of various sizes and content types, verify that no chunk exceeds maxChunkSize (except documented force-split cases), and no chunk is below minChunkSize (except first/last chunk exemptions).
- **Overlap consistency test**: Chunk with overlap, verify that the overlap region of chunk N+1 matches the end of chunk N.
- **Determinism test**: Chunk the same input twice with the same options, verify identical output.
- **Large document test**: Chunk a 1MB document, verify completion within performance targets, verify correct chunk count and metadata.

### CLI Tests

- **File input**: Verify chunking a file by path.
- **Stdin input**: Verify chunking from stdin.
- **Output formats**: Verify json, jsonl, and text output formats.
- **Flag parsing**: Verify all flags are parsed correctly, invalid flags produce exit code 2.
- **Exit codes**: Verify correct exit codes for success, input error, and config error.

### Edge Cases to Test

- Empty input (produces zero chunks).
- Input containing only whitespace (produces zero chunks).
- Input with a single character (produces one chunk).
- A code fence with no closing marker (treats remainder as code block).
- A table with no data rows (header + separator only, kept atomic).
- Deeply nested JSON (50+ levels).
- A single line that exceeds maxChunkSize (force-split at word boundaries).
- Unicode text: CJK characters (where the 4-chars-per-token approximation is inaccurate), emoji, right-to-left text.
- Mixed line endings: `\r\n`, `\r`, `\n`.
- Document with every structural element type (stress test for all atomic unit detectors).

### Test Framework

Tests use Vitest, matching the project's existing configuration in `package.json`.

---

## 16. Performance

### Design Constraints

`chunk-smart` is designed to chunk documents in milliseconds, not seconds. Document ingestion pipelines process thousands of documents. Each document may be 10-100KB of text. The chunking step must be fast enough that it is not the bottleneck. Target: under 1ms for a typical document (10KB), under 50ms for a large document (1MB).

### Optimization Strategy

**Single-pass scanning where possible**: Content type detection scans the first 2000 characters once. Atomic unit detection (code fences, tables, HTML blocks) is performed in a single pass through the document, marking boundary positions. The chunking algorithm then operates on the pre-computed boundary map.

**Pre-computation of boundaries**: Before splitting, the chunker scans the entire document and builds an array of boundary positions with their types and levels. The splitting algorithm then operates on this array, finding optimal split points without re-scanning the text.

**Lazy size computation**: Token counts are computed only when needed for split decisions. For chunks that are obviously within size limits (determined by character count heuristic), exact token counting is deferred.

**No backtracking regex**: All regular expressions are designed to be linear-time. Complex patterns (code fence detection, table detection) use hand-written scanners instead of regex where backtracking risk exists.

**Minimal string copying**: The chunker operates on the original string using offset ranges and creates substring copies only in the final output step. During boundary analysis and split point selection, only integer offsets are manipulated.

### Performance Targets

| Input Size | Content Type | Expected Time |
|------------|-------------|---------------|
| 1KB | Markdown with code fence | < 0.1ms |
| 10KB | Markdown documentation | < 1ms |
| 50KB | Large markdown with tables and code | < 5ms |
| 100KB | Source code file | < 10ms |
| 500KB | Large HTML document | < 30ms |
| 1MB | Very large document (stress test) | < 50ms |

Benchmarks measured on a 2024 MacBook Pro, Node.js 22, using the default approximate token counter. Exact token counting with `tiktoken` adds approximately 2-5x overhead depending on input size.

### Memory Usage

The chunker's memory footprint is proportional to the input size: the boundary map is an array of integers (8 bytes per boundary), the output chunks are substrings of the original input (no duplication beyond the output itself), and temporary state (heading stack, brace depth counters) is O(nesting depth), which is negligible. For a 1MB document, peak memory usage beyond the input string is under 1MB.

---

## 17. Dependencies

### Runtime Dependencies

None. `chunk-smart` has zero runtime dependencies. All functionality -- content type detection, boundary scanning, brace/bracket matching, recursive splitting, overlap computation, metadata assembly, and token counting -- is implemented using Node.js built-in APIs (`String.prototype`, `RegExp`, `JSON.parse`, `Buffer.byteLength`).

### Development Dependencies

| Package | Purpose |
|---------|---------|
| `typescript` | TypeScript compiler |
| `vitest` | Test runner |
| `eslint` | Linting |
| `@types/node` | Node.js type definitions |

### Peer Dependencies

None.

### Why Zero Dependencies

The package processes arbitrary user-provided text through regex patterns and state machines. Keeping the dependency tree empty eliminates supply chain risk, ensures the package works in any Node.js 18+ environment without installation issues, and keeps the installed size minimal. The chunking algorithms are specific to `chunk-smart`'s requirements and simpler than general-purpose parsing libraries.

---

## 18. File Structure

```
chunk-smart/
  package.json
  tsconfig.json
  SPEC.md
  README.md
  src/
    index.ts                       -- Public API exports
    chunk.ts                       -- chunk() function, orchestration
    chunk-markdown.ts              -- chunkMarkdown() function
    chunk-code.ts                  -- chunkCode() function
    chunk-html.ts                  -- chunkHTML() function
    chunk-json.ts                  -- chunkJSON() function
    factory.ts                     -- createChunker() factory
    detect.ts                      -- detectContentType() function
    types.ts                       -- All TypeScript type definitions
    strategies/
      index.ts                     -- Strategy registry and dispatch
      markdown.ts                  -- Markdown chunking strategy
      code.ts                      -- Code chunking strategy
      html.ts                      -- HTML chunking strategy
      json.ts                      -- JSON chunking strategy
      yaml.ts                      -- YAML chunking strategy
      text.ts                      -- Plain text recursive strategy
    boundaries/
      index.ts                     -- Boundary detection orchestration
      section.ts                   -- Section boundary detection (headers, hr)
      paragraph.ts                 -- Paragraph boundary detection
      sentence.ts                  -- Sentence boundary detection
      word.ts                      -- Word boundary detection
    atomic/
      index.ts                     -- Atomic unit detection orchestration
      code-fence.ts                -- Fenced code block detection
      table.ts                     -- Markdown table detection
      html-block.ts                -- HTML block element detection
      json-block.ts                -- JSON object/array detection
      frontmatter.ts               -- YAML frontmatter detection
      math-block.ts                -- Math block detection
      list-group.ts                -- List group detection
    overlap.ts                     -- Overlap application logic
    merge.ts                       -- Small chunk merging logic
    size.ts                        -- Size measurement and token counting
    metadata.ts                    -- Chunk metadata construction
    heading-tracker.ts             -- Heading context tracking
    cli.ts                         -- CLI entry point
  src/__tests__/
    chunk.test.ts                  -- Main chunk() function tests
    chunk-markdown.test.ts         -- Markdown chunking tests
    chunk-code.test.ts             -- Code chunking tests
    chunk-html.test.ts             -- HTML chunking tests
    chunk-json.test.ts             -- JSON chunking tests
    detect.test.ts                 -- Content type detection tests
    overlap.test.ts                -- Overlap logic tests
    merge.test.ts                  -- Small chunk merge tests
    size.test.ts                   -- Size measurement tests
    metadata.test.ts               -- Metadata construction tests
    atomic/
      code-fence.test.ts           -- Code fence detection tests
      table.test.ts                -- Table detection tests
      html-block.test.ts           -- HTML block detection tests
      json-block.test.ts           -- JSON block detection tests
      frontmatter.test.ts          -- Frontmatter detection tests
    cli.test.ts                    -- CLI integration tests
    fixtures/
      markdown/                    -- Markdown test documents
      code/                        -- Source code test files
      html/                        -- HTML test documents
      json/                        -- JSON test files
      mixed/                       -- Mixed content test files
  dist/                            -- Compiled output (generated by tsc)
```

---

## 19. Implementation Roadmap

### Phase 1: Core Chunking Engine (v0.1.0)

Implement the foundation: types, content type detection, boundary detection, recursive splitting, and the plain text strategy.

1. **Types**: Define all TypeScript types in `types.ts` -- `Chunk`, `ChunkMetadata`, `ChunkOptions`, `ContentType`, `SizeUnit`, and all strategy-specific option interfaces.
2. **Size measurement**: Implement token counting (default approximate counter and pluggable interface) and character counting in `size.ts`.
3. **Boundary detection**: Implement section, paragraph, sentence, and word boundary detectors in the `boundaries/` directory.
4. **Recursive text splitting**: Implement the recursive fallback algorithm in `strategies/text.ts` -- the foundation that all other strategies fall back to.
5. **Small chunk merging**: Implement forward and backward merge logic in `merge.ts`.
6. **Metadata construction**: Implement chunk metadata assembly (index, offsets, token count, char count) in `metadata.ts`.
7. **Content type detection**: Implement the heuristic detection system in `detect.ts`.
8. **Public API**: Export `chunk()` and `detectContentType()` from `index.ts`.
9. **Tests**: Unit tests for size measurement, boundary detection, recursive splitting, merging, and detection.

### Phase 2: Markdown Strategy (v0.2.0)

Implement the markdown chunking strategy with all atomic unit detectors.

1. **Code fence detection**: Detect fenced code blocks (backtick and tilde, with nested fence handling) in `atomic/code-fence.ts`.
2. **Table detection**: Detect markdown tables (header + separator + data rows) in `atomic/table.ts`.
3. **Frontmatter detection**: Detect YAML frontmatter in `atomic/frontmatter.ts`.
4. **Math block detection**: Detect `$$...$$` blocks in `atomic/math-block.ts`.
5. **List group detection**: Detect consecutive list items in `atomic/list-group.ts`.
6. **Heading tracker**: Implement heading context tracking (push/pop heading stack) in `heading-tracker.ts`.
7. **Markdown strategy**: Implement the full markdown chunking strategy in `strategies/markdown.ts`, integrating all atomic unit detectors and the heading tracker.
8. **chunkMarkdown()**: Export the markdown-specific function.
9. **Overlap**: Implement overlap application logic in `overlap.ts`.
10. **Tests**: Markdown strategy tests with real documents, atomic unit detection tests, overlap tests.

### Phase 3: Code, HTML, and JSON Strategies (v0.3.0)

Implement the remaining content-type-specific strategies.

1. **HTML block detection**: Detect HTML block elements with tag balancing in `atomic/html-block.ts`.
2. **JSON block detection**: Detect JSON objects/arrays with bracket matching in `atomic/json-block.ts`.
3. **Code strategy**: Implement code chunking with language-aware heuristics in `strategies/code.ts`.
4. **HTML strategy**: Implement HTML chunking in `strategies/html.ts`.
5. **JSON strategy**: Implement JSON chunking with JSON path metadata in `strategies/json.ts`.
6. **YAML strategy**: Implement YAML chunking in `strategies/yaml.ts`.
7. **Content-specific exports**: Export `chunkCode()`, `chunkHTML()`, `chunkJSON()`.
8. **Tests**: Strategy tests for code, HTML, JSON, and YAML with real documents.

### Phase 4: Factory, CLI, and Polish (v1.0.0)

Production readiness.

1. **createChunker()**: Implement the factory function with option merging in `factory.ts`.
2. **CLI**: Implement CLI argument parsing, file reading, stdin handling, output formatting, and exit codes in `cli.ts`.
3. **CLI tests**: End-to-end CLI integration tests.
4. **Performance optimization**: Benchmark suite, pre-computed boundary maps, lazy token counting.
5. **Edge case hardening**: Unicode edge cases, pathological input testing, very large document testing.
6. **Documentation**: Comprehensive README with usage examples for every common scenario.

---

## 20. Example Use Cases

### 20.1 Chunking a Markdown Documentation File

A developer is building a documentation search engine. They ingest a 15KB markdown file containing headers, code examples, tables, and prose.

```typescript
import { chunk } from 'chunk-smart';
import { readFileSync } from 'node:fs';

const markdown = readFileSync('./docs/api-reference.md', 'utf-8');

const chunks = chunk(markdown, {
  maxChunkSize: 512,
  overlap: 50,
  customMetadata: { source: 'api-reference.md' },
});

console.log(`Produced ${chunks.length} chunks`);

// First chunk: the introduction under "# API Reference"
console.log(chunks[0].metadata.headings);
// ["API Reference"]

// A chunk containing a code example
const codeChunk = chunks.find(c => c.metadata.codeLanguage === 'typescript');
console.log(codeChunk?.content);
// '```typescript\nimport { createClient } from "my-sdk";\n\nconst client = createClient({ apiKey: "sk-..." });\n```'
console.log(codeChunk?.metadata.headings);
// ["API Reference", "Authentication", "Quick Start"]

// A chunk containing a table
const tableChunk = chunks.find(c => c.content.includes('|---'));
console.log(tableChunk?.metadata.forceSplit);
// false (table fits within maxChunkSize)
```

### 20.2 Indexing a Code Repository

A team is building a code Q&A system that indexes an entire TypeScript project.

```typescript
import { chunkCode } from 'chunk-smart';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

const files = globSync('src/**/*.ts');

const allChunks = files.flatMap(filePath => {
  const source = readFileSync(filePath, 'utf-8');
  return chunkCode(source, {
    language: 'typescript',
    maxChunkSize: 256,
    customMetadata: { filePath },
  });
});

console.log(`Indexed ${allChunks.length} chunks from ${files.length} files`);

// Each chunk aligns to function/class boundaries
const functionChunk = allChunks.find(c => c.content.includes('export function'));
console.log(functionChunk?.metadata.tokenCount);
// 187
```

### 20.3 Processing Mixed Content from Web Scraping

A pipeline scrapes web pages and needs to chunk the HTML content for a vector database.

```typescript
import { chunk } from 'chunk-smart';

const scrapedHTML = await fetchAndExtract('https://docs.example.com/guide');

// Auto-detects HTML content type
const chunks = chunk(scrapedHTML, {
  maxChunkSize: 512,
  overlap: 50,
});

console.log(chunks[0].metadata.contentType);
// 'html'

// Or strip tags for plain text embeddings
const textChunks = chunk(scrapedHTML, {
  contentType: 'html',
  maxChunkSize: 512,
});
```

### 20.4 Full RAG Pipeline Integration

A complete example showing `chunk-smart` as the first stage in a RAG pipeline with other npm-master packages.

```typescript
import { chunk } from 'chunk-smart';
import { createEmbedCache } from 'embed-cache';
import { packContext } from 'context-packer';
import { buildPrompt } from 'rag-prompt-builder';

// 1. Chunk the document
const chunks = chunk(documentText, {
  maxChunkSize: 512,
  overlap: 50,
  customMetadata: { documentId: 'doc-42' },
});

// 2. Generate and cache embeddings
const cache = createEmbedCache({ provider: 'openai' });
const vectors = await Promise.all(
  chunks.map(async c => ({
    chunk: c,
    embedding: await cache.embed(c.content),
  })),
);

// 3. Store in vector database
await vectorDB.upsert(
  vectors.map(v => ({
    id: `doc-42-chunk-${v.chunk.metadata.index}`,
    values: v.embedding,
    metadata: v.chunk.metadata,
  })),
);

// 4. At query time: retrieve, pack, and build prompt
const queryEmbedding = await cache.embed(userQuery);
const results = await vectorDB.query(queryEmbedding, { topK: 20 });
const retrievedChunks = results.map(r => chunks[r.metadata.index]);

const packed = packContext(retrievedChunks, { maxTokens: 4096 });
const prompt = buildPrompt({ query: userQuery, chunks: packed });

const answer = await llm.complete(prompt);
```

### 20.5 CLI Pipeline for Batch Processing

Chunking a directory of markdown files and storing the results as JSONL for later processing.

```bash
# Chunk all markdown files, output JSONL, store to file
for f in docs/*.md; do
  chunk-smart "$f" \
    --max-size 512 \
    --overlap 50 \
    --format jsonl
done > all-chunks.jsonl

# Count chunks per file
chunk-smart docs/api-reference.md --content-only --format text | grep -c '----'

# Extract only headings context from chunks
chunk-smart docs/guide.md | jq '.[].metadata.headings'
```

### 20.6 Chunking JSON API Responses

A system ingests large JSON responses from an API and needs to chunk them for embedding.

```typescript
import { chunkJSON } from 'chunk-smart';

const apiResponse = await fetch('https://api.example.com/products').then(r => r.text());

const chunks = chunkJSON(apiResponse, {
  maxChunkSize: 256,
  customMetadata: { source: 'products-api' },
});

// Each chunk contains one or more products
console.log(chunks[0].metadata.jsonPaths);
// ["$[0]", "$[1]", "$[2]"]

console.log(chunks[0].content);
// Pretty-printed JSON containing the first three product objects
```
