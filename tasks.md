# chunk-smart — Task Breakdown

This file tracks all implementation tasks derived from SPEC.md. Tasks are grouped by phase, matching the implementation roadmap. Each task is granular and actionable.

---

## Phase 0: Project Scaffolding & Configuration

- [x] **Install dev dependencies** — Add `typescript`, `vitest`, `eslint`, and `@types/node` as devDependencies in `package.json`. Run `npm install` to generate `node_modules` and `package-lock.json`. | Status: done

- [ ] **Add CLI bin entry to package.json** — Add `"bin": { "chunk-smart": "dist/cli.js" }` to `package.json` so the CLI is available after global install or via `npx`. | Status: not_done

- [x] **Configure ESLint** — Create `.eslintrc.cjs` (or `eslint.config.js`) with TypeScript support. Ensure `npm run lint` works against `src/`. | Status: done

- [ ] **Create directory structure** — Create all directories specified in the file structure: `src/strategies/`, `src/boundaries/`, `src/atomic/`, `src/__tests__/`, `src/__tests__/atomic/`, `src/__tests__/fixtures/markdown/`, `src/__tests__/fixtures/code/`, `src/__tests__/fixtures/html/`, `src/__tests__/fixtures/json/`, `src/__tests__/fixtures/mixed/`. | Status: not_done

- [x] **Configure Vitest** — Ensure vitest is properly configured (either via `vitest.config.ts` or the existing `package.json` script `"test": "vitest run"`). Verify `npm run test` runs successfully with zero tests. | Status: done

---

## Phase 1: Core Chunking Engine (Types, Detection, Boundaries, Recursive Splitting)

### 1.1 Type Definitions

- [x] **Define ContentType union type** — In `src/types.ts`, define `type ContentType = 'markdown' | 'code' | 'html' | 'json' | 'yaml' | 'text'`. | Status: done

- [ ] **Define SizeUnit union type** — In `src/types.ts`, define `type SizeUnit = 'tokens' | 'characters'`. | Status: not_done

- [x] **Define Chunk interface** — In `src/types.ts`, define the `Chunk` interface with `content: string` and `metadata: ChunkMetadata`. | Status: done

- [ ] **Define ChunkMetadata interface** — In `src/types.ts`, define `ChunkMetadata` with all fields: `index`, `startOffset`, `endOffset`, `tokenCount`, `charCount`, `contentType`, `headings`, `codeLanguage?`, `overlapBefore`, `overlapAfter`, `forceSplit`, `tableRowRange?`, `jsonPaths?`, `custom?`. | Status: not_done

- [ ] **Define ChunkOptions interface** — In `src/types.ts`, define `ChunkOptions` with fields: `maxChunkSize?`, `minChunkSize?`, `targetChunkSize?`, `overlap?`, `sizeUnit?`, `tokenCounter?`, `contentType?`, `preserveStructure?`, `customMetadata?`. | Status: not_done

- [ ] **Define MarkdownChunkOptions interface** — In `src/types.ts`, extend `ChunkOptions` with `headerDepth?`, `frontmatter?` (`'preserve' | 'exclude' | 'metadata'`), and `splitLists?`. | Status: not_done

- [ ] **Define CodeChunkOptions interface** — In `src/types.ts`, extend `ChunkOptions` with `language?`. | Status: not_done

- [ ] **Define HTMLChunkOptions interface** — In `src/types.ts`, extend `ChunkOptions` with `stripTags?` and `preserveTagHierarchy?`. | Status: not_done

- [ ] **Define JSONChunkOptions interface** — In `src/types.ts`, extend `ChunkOptions` with `compact?`. | Status: not_done

- [x] **Define DetectResult interface** — In `src/types.ts`, define `DetectResult` with `type: ContentType` and `confidence: number`. | Status: done

- [ ] **Define Chunker interface** — In `src/types.ts`, define the `Chunker` interface returned by `createChunker()` with methods: `chunk()`, `chunkMarkdown()`, `chunkCode()`, `chunkHTML()`, `chunkJSON()`, `detectContentType()`. | Status: not_done

### 1.2 Size Measurement

- [x] **Implement default token counter** — In `src/size.ts`, implement the default approximate token counter: `(text: string) => Math.ceil(text.length / 4)`. | Status: done

- [ ] **Implement measureSize function** — In `src/size.ts`, implement a function that measures text size in either tokens or characters based on the `sizeUnit` option, using the configured `tokenCounter` for token mode and `text.length` for character mode. | Status: not_done

- [x] **Implement resolveDefaults function** — In `src/size.ts` (or a dedicated `defaults.ts`), implement a function that merges user-provided options with built-in defaults (`maxChunkSize: 512`, `minChunkSize: 50`, `targetChunkSize: maxChunkSize`, `overlap: 0`, `sizeUnit: 'tokens'`, etc.). | Status: done

- [ ] **Write size measurement tests** — In `src/__tests__/size.test.ts`, test default token counter accuracy, custom token counter integration, character mode measurement, and edge cases (empty string, single character, Unicode text). | Status: not_done

### 1.3 Boundary Detection

- [ ] **Implement section boundary detector** — In `src/boundaries/section.ts`, detect section boundaries: markdown headers (`#` through `######`), horizontal rules (`---`, `***`, `___`), and HTML heading elements (`<h1>` through `<h6>`). Return an array of boundary positions with their levels. | Status: not_done

- [ ] **Implement paragraph boundary detector** — In `src/boundaries/paragraph.ts`, detect paragraph boundaries at double newlines (`\n\n`). | Status: not_done

- [ ] **Implement sentence boundary detector** — In `src/boundaries/sentence.ts`, detect sentence boundaries at `.`, `!`, `?` followed by whitespace or end of text. Handle edge cases: abbreviations ("Dr.", "Mr.", "e.g."), URLs containing periods, ellipses ("..."), decimal numbers. | Status: not_done

- [ ] **Implement word boundary detector** — In `src/boundaries/word.ts`, detect word boundaries at whitespace between words. | Status: not_done

- [ ] **Create boundary detection orchestrator** — In `src/boundaries/index.ts`, export all boundary detectors and provide a unified interface that returns boundaries sorted by position and level. | Status: not_done

- [ ] **Write boundary detection tests** — Test section boundaries (ATX headers at all depths, horizontal rules, HTML headings). Test paragraph boundaries with various newline patterns. Test sentence boundaries including edge cases (abbreviations, URLs, ellipses, decimal numbers). Test word boundaries with various whitespace patterns. | Status: not_done

### 1.4 Plain Text Recursive Splitting Strategy

- [x] **Implement recursive text splitter** — In `src/strategies/text.ts`, implement the recursive splitting algorithm: try double newlines first, then single newlines, then sentence endings, then spaces, then character-level split. Each level checks if segments fit within `maxChunkSize`; if not, recursively apply the next finer separator. | Status: done

- [ ] **Implement target size optimization** — Within the recursive splitter, when multiple split points are available, prefer the split that produces chunks closest to `targetChunkSize`. | Status: not_done

- [x] **Write plain text strategy tests** — Test with prose paragraphs, single long paragraphs with no structure, documents with only newlines, pathological input (one very long word exceeding `maxChunkSize`). Verify all chunks respect `maxChunkSize`. | Status: done

### 1.5 Small Chunk Merging

- [ ] **Implement forward merge** — In `src/merge.ts`, implement logic to merge chunks smaller than `minChunkSize` into the next chunk (forward merge preferred). | Status: not_done

- [ ] **Implement backward merge fallback** — In `src/merge.ts`, when forward merge is not possible (last chunk), merge the small chunk into the previous chunk instead. | Status: not_done

- [ ] **Implement first/last chunk exemption** — Ensure the first and last chunks are exempt from minimum size enforcement (a document may naturally start or end with a short section). | Status: not_done

- [ ] **Write merge tests** — In `src/__tests__/merge.test.ts`, test forward merge, backward merge, first/last chunk exemption, and merging when multiple consecutive chunks are below `minChunkSize`. | Status: not_done

### 1.6 Metadata Construction

- [x] **Implement metadata builder** — In `src/metadata.ts`, implement a function that constructs `ChunkMetadata` objects: assign sequential `index`, compute `startOffset` and `endOffset` from the original text, compute `tokenCount` and `charCount`, set `contentType`, set `headings` (empty array for now), set `overlapBefore: 0` and `overlapAfter: 0` (overlap applied later), set `forceSplit: false`, and attach `custom` metadata from options. | Status: done

- [x] **Write metadata tests** — In `src/__tests__/metadata.test.ts`, verify correct index assignment, offset calculation, token/char count accuracy, content type passthrough, and custom metadata attachment. | Status: done

### 1.7 Content Type Detection

- [x] **Implement markdown detection heuristics** — In `src/detect.ts`, implement markdown confidence scoring based on: ATX headers (+0.3 per occurrence, max 0.6), fenced code blocks (+0.3), pipe tables (+0.3), markdown links (+0.1, max 0.3), emphasis/bold (+0.1, max 0.2), unordered lists (+0.1, max 0.2), blockquotes (+0.1, max 0.2), frontmatter delimiters (+0.2), horizontal rules (+0.1). | Status: done

- [x] **Implement HTML detection heuristics** — In `src/detect.ts`, implement HTML confidence scoring: DOCTYPE (+0.5), HTML/HEAD/BODY tags (+0.4), block-level tags (+0.2 per unique tag, max 0.6), closing tags (+0.1, max 0.3), self-closing tags (+0.1), HTML attributes (+0.1, max 0.2). | Status: done

- [x] **Implement JSON detection heuristics** — In `src/detect.ts`, implement JSON confidence scoring: starts with `{` or `[` (+0.4), valid JSON.parse (+0.6), key-value patterns (+0.2, max 0.4), nested braces/brackets (+0.1). | Status: done

- [x] **Implement YAML detection heuristics** — In `src/detect.ts`, implement YAML confidence scoring: YAML document start `---` (+0.4), key-value pairs (+0.2, max 0.4), YAML-specific types (+0.2), indentation-based nesting (+0.1), no markdown headers (+0.1). Handle false positives from markdown frontmatter. | Status: done

- [x] **Implement code detection heuristics** — In `src/detect.ts`, implement code confidence scoring: function declarations (+0.3, max 0.6), class declarations (+0.3), import/require statements (+0.2, max 0.4), variable declarations (+0.1, max 0.2), curly brace blocks (+0.1), semicolons at line endings (+0.1, max 0.2), comment patterns (+0.1, max 0.2), shebang line (+0.3). | Status: done

- [x] **Implement plain text fallback** — In `src/detect.ts`, if no content type exceeds the 0.3 confidence threshold, return `{ type: 'text', confidence: 0.0 }`. | Status: done

- [ ] **Implement detection performance optimization** — Analyze only the first 2000 characters for performance on large documents, plus sampling of markers throughout the text. | Status: not_done

- [x] **Export detectContentType function** — In `src/detect.ts`, export `function detectContentType(text: string): DetectResult` that runs all heuristics and returns the type with the highest confidence. | Status: done

- [x] **Write content type detection tests** — In `src/__tests__/detect.test.ts`, test detection for: pure markdown, pure HTML, pure JSON, pure YAML, pure code (JS, Python, Go), plain text, ambiguous inputs (markdown with inline HTML, JSON that looks like code), and verify confidence scores. Test the 0.3 threshold fallback to plain text. | Status: done

### 1.8 Main `chunk()` Function

- [x] **Implement chunk() orchestration** — In `src/chunk.ts`, implement the main `chunk()` function: resolve defaults, auto-detect content type (or use specified type), dispatch to the appropriate strategy, apply small chunk merging, construct metadata, and return `Chunk[]`. For Phase 1, only the plain text strategy is available; other content types fall back to plain text. | Status: done

- [x] **Write chunk() function tests** — In `src/__tests__/chunk.test.ts`, test with plain text input, verify auto-detection dispatch, verify option defaults, verify metadata on output chunks, and test edge cases (empty input returns zero chunks, whitespace-only input returns zero chunks, single character input). | Status: done

### 1.9 Public API Exports (Phase 1)

- [x] **Set up index.ts exports** — In `src/index.ts`, export `chunk` from `./chunk`, `detectContentType` from `./detect`, and all type definitions from `./types`. | Status: done

- [ ] **Verify build** — Run `npm run build` (tsc) and confirm `dist/` is generated with correct `.js`, `.d.ts`, and `.js.map` files. | Status: not_done

---

## Phase 2: Markdown Strategy

### 2.1 Atomic Unit Detectors

- [ ] **Implement code fence detector** — In `src/atomic/code-fence.ts`, detect fenced code blocks. Handle backtick (```) and tilde (`~~~`) fences. Extract the language tag from the opening fence. Handle nested fences (a 4-backtick fence can contain 3-backtick fences). Handle unclosed fences (treat remainder as code block). Return start/end positions and language tag. | Status: not_done

- [ ] **Write code fence detector tests** — In `src/__tests__/atomic/code-fence.test.ts`, test backtick fences, tilde fences, fences with language tags, nested fences, unclosed fences, fences with no content, and fences preceded by indentation. | Status: not_done

- [ ] **Implement markdown table detector** — In `src/atomic/table.ts`, detect markdown tables: header row with pipes, separator row matching `/^\|?[\s:-]+(\|[\s:-]+)+\|?\s*$/`, followed by data rows. Return start/end positions. Handle tables with and without outer pipes. Handle tables with no data rows (header + separator only). | Status: not_done

- [ ] **Write table detector tests** — In `src/__tests__/atomic/table.test.ts`, test tables with outer pipes, without outer pipes, with alignment markers (`:---`, `:---:`, `---:`), with no data rows, and tables embedded within other content. | Status: not_done

- [ ] **Implement frontmatter detector** — In `src/atomic/frontmatter.ts`, detect YAML frontmatter at the document start (`---` on first line, content, `---` on a subsequent line). Return the frontmatter text and parsed YAML content (using a simple key-value parser, not a full YAML parser, to maintain zero dependencies). | Status: not_done

- [ ] **Write frontmatter detector tests** — In `src/__tests__/atomic/frontmatter.test.ts`, test valid frontmatter, frontmatter with complex YAML, missing closing delimiter, `---` that is not at document start, and documents with `---` used as horizontal rules after frontmatter. | Status: not_done

- [ ] **Implement math block detector** — In `src/atomic/math-block.ts`, detect display math blocks (`$$` on its own line to closing `$$`). Handle inline math (`$...$`) as word-level units (not split mid-expression). Return start/end positions. | Status: not_done

- [ ] **Implement list group detector** — In `src/atomic/list-group.ts`, detect consecutive list items starting with `- `, `* `, `+ `, `1. `, or `1) ` at the same or deeper indentation. Handle nested sub-items (they stay with their parent). Return start/end positions. | Status: not_done

- [ ] **Create atomic unit detection orchestrator** — In `src/atomic/index.ts`, export all atomic detectors and provide a unified function that scans text and returns all atomic unit ranges sorted by position. | Status: not_done

### 2.2 Heading Tracker

- [ ] **Implement heading context tracker** — In `src/heading-tracker.ts`, implement a stateful tracker that maintains a heading stack. When a `##` header is encountered, it replaces the previous `##` entry and clears all deeper entries (`###`, `####`, etc.). Expose methods: `push(level: number, text: string)`, `getContext(): string[]`, and `reset()`. | Status: not_done

- [ ] **Write heading tracker tests** — Test push/pop semantics: adding `#` then `##` then `###` produces `["H1", "H2", "H3"]`; adding another `##` replaces the second entry and clears `###`; resetting clears all. | Status: not_done

### 2.3 Markdown Chunking Strategy

- [ ] **Implement markdown strategy** — In `src/strategies/markdown.ts`, implement the full markdown chunking strategy: scan for all atomic units (code fences, tables, frontmatter, math blocks, list groups, blockquotes, admonition blocks), scan for section boundaries (headers, horizontal rules), split at section boundaries first, then fall back to paragraph/sentence/word boundaries using the recursive splitter. Preserve atomic units as indivisible blocks. | Status: not_done

- [ ] **Implement header depth option** — In the markdown strategy, support `headerDepth` option: only split on headers of depth N or less (e.g., `headerDepth: 2` splits on `#` and `##` only). Default: 6. | Status: not_done

- [ ] **Implement frontmatter handling** — In the markdown strategy, implement the three frontmatter modes: `'preserve'` (include as first chunk or merge into first content chunk), `'exclude'` (strip entirely), `'metadata'` (parse YAML, attach to all chunks' metadata, exclude from content). | Status: not_done

- [ ] **Implement list splitting option** — In the markdown strategy, support the `splitLists` option: when `true`, split between top-level list items when the group exceeds `maxChunkSize` (nested sub-items stay with their parent). Default: `false`. | Status: not_done

- [ ] **Implement heading context propagation** — Integrate the heading tracker into the markdown strategy so that each chunk receives the correct `headings` array in its metadata. | Status: not_done

- [ ] **Implement force-split for oversized code fences** — When a code fence exceeds `maxChunkSize`, force-split at line boundaries within the code content. Retain fence markers (opening on first sub-chunk, closing on last sub-chunk). Set `forceSplit: true` and preserve `codeLanguage` on all sub-chunks. | Status: not_done

- [ ] **Implement force-split for oversized tables** — When a table exceeds `maxChunkSize`, split by rows. Duplicate the header row and separator row in each sub-chunk. Set `forceSplit: true` and `tableRowRange: [startRow, endRow]` on each sub-chunk. | Status: not_done

- [ ] **Implement blockquote preservation** — Consecutive blockquote lines (starting with `> `) are kept together as an atomic unit. | Status: not_done

- [ ] **Implement admonition block preservation** — Admonition blocks (`:::` to closing `:::`) are kept as one unit. | Status: not_done

- [ ] **Implement chunkMarkdown() export** — In `src/chunk-markdown.ts`, export `function chunkMarkdown(text: string, options?: MarkdownChunkOptions): Chunk[]` that directly invokes the markdown strategy. | Status: not_done

- [ ] **Write markdown strategy tests** — In `src/__tests__/chunk-markdown.test.ts`, test with real markdown documents containing: headers at multiple depths, code fences (with and without language tags), tables, lists, blockquotes, frontmatter, math blocks, mixed content. Verify heading context propagation across nested headers. Verify frontmatter handling in all three modes. Verify `headerDepth` and `splitLists` options. Test force-split scenarios for oversized code fences and tables. | Status: not_done

### 2.4 Overlap

- [ ] **Implement overlap application** — In `src/overlap.ts`, implement overlap logic: when `overlap > 0`, duplicate content from the end of chunk N at the beginning of chunk N+1. Measure overlap in the configured `sizeUnit` (tokens or characters). | Status: not_done

- [ ] **Implement boundary-aware overlap** — Ensure overlap regions start and end at word boundaries (never mid-word). If the exact overlap size lands mid-word, extend slightly to the next word boundary. | Status: not_done

- [ ] **Implement atomic unit overlap exclusion** — Do not apply overlap across atomic unit boundaries. If chunk N ends with a code fence, the overlap draws from text preceding the code fence. If chunk N is entirely an atomic unit, no overlap is applied to that boundary. | Status: not_done

- [ ] **Implement overlap metadata indicators** — Set `overlapBefore` and `overlapAfter` on each chunk's metadata. First chunk always has `overlapBefore: 0`. Last chunk always has `overlapAfter: 0`. | Status: not_done

- [ ] **Write overlap tests** — In `src/__tests__/overlap.test.ts`, test overlap application at word boundaries, overlap indicators in metadata, no overlap across atomic unit boundaries, first/last chunk overlap values, overlap with various `sizeUnit` settings. | Status: not_done

### 2.5 Create Test Fixtures for Markdown

- [ ] **Create markdown test fixtures** — In `src/__tests__/fixtures/markdown/`, create sample markdown documents covering: simple prose, headers with code fences, tables, lists, frontmatter, math blocks, mixed content, and edge cases (very large code blocks, tables with many rows). | Status: not_done

---

## Phase 3: Code, HTML, JSON, and YAML Strategies

### 3.1 HTML Block Element Detector

- [ ] **Implement HTML block element detector** — In `src/atomic/html-block.ts`, detect block-level HTML elements (`<div>`, `<section>`, `<article>`, `<pre>`, `<table>`, `<ul>`, `<ol>`, `<blockquote>`, `<figure>`, `<details>`, `<aside>`, `<nav>`, `<main>`, `<header>`, `<footer>`, `<form>`) from opening tag to matching closing tag. Handle nested same-tag elements by tracking depth. | Status: not_done

- [ ] **Write HTML block detector tests** — In `src/__tests__/atomic/html-block.test.ts`, test nested divs, self-closing tags, void elements, tags with attributes, and deeply nested structures. | Status: not_done

### 3.2 JSON Block Detector

- [ ] **Implement JSON block detector** — In `src/atomic/json-block.ts`, implement bracket-matching state machine for `{`/`}` and `[`/`]` pairs. Respect string literals (content between unescaped double quotes) so braces inside strings are not counted. Return start/end positions of complete JSON objects and arrays. | Status: not_done

- [ ] **Write JSON block detector tests** — In `src/__tests__/atomic/json-block.test.ts`, test simple objects, nested objects, arrays, strings containing braces, escaped quotes, and deeply nested structures (50+ levels). | Status: not_done

### 3.3 Code Chunking Strategy

- [ ] **Implement code strategy core** — In `src/strategies/code.ts`, implement code chunking: split at module-level declarations (functions, classes, top-level variables separated by blank lines). Keep import blocks as single units. Fall back to blank line and single line boundaries. | Status: not_done

- [ ] **Implement brace matching state machine** — For C-style languages, track brace depth. A function/class starts at depth 0 and extends to matching closing brace at depth 0. Exclude braces inside string literals and comments from depth tracking. | Status: not_done

- [ ] **Implement language-aware heuristics for C-style languages** — Support JS, TS, Java, C#, Go, Rust: detect `function`, `const ... =`, `class`, `interface` keywords, `{ }` brace matching, `import`/`require` patterns. | Status: not_done

- [ ] **Implement language-aware heuristics for Python** — Detect `def`, `class`, `async def` keywords, indentation-based blocks (4-space or tab), `import`/`from ... import` patterns. | Status: not_done

- [ ] **Implement language-aware heuristics for Ruby** — Detect `def`, `class`, `module` keywords, `def`/`end` and `class`/`end` and `do`/`end` blocks, `require`/`require_relative` patterns. | Status: not_done

- [ ] **Implement language-aware heuristics for Shell** — Detect function definition patterns, `{ }` or indentation blocks, `source`/`.` patterns. | Status: not_done

- [ ] **Implement generic code fallback** — Blank-line separated blocks with brace matching fallback. | Status: not_done

- [ ] **Implement comment preservation** — Comments immediately preceding a function/class declaration (JSDoc, docstrings, `#` comment blocks) are kept with the declaration. | Status: not_done

- [ ] **Implement language auto-detection** — Detect language from syntax patterns (shebang line, keywords, import style) when `language` option is not specified. | Status: not_done

- [ ] **Implement chunkCode() export** — In `src/chunk-code.ts`, export `function chunkCode(text: string, options?: CodeChunkOptions): Chunk[]`. | Status: not_done

- [ ] **Write code strategy tests** — In `src/__tests__/chunk-code.test.ts`, test with real source files in JavaScript, TypeScript, Python, and Go. Verify function/class boundary detection, import block preservation, comment attachment, language auto-detection, and force-split for oversized functions. | Status: not_done

### 3.4 HTML Chunking Strategy

- [ ] **Implement HTML strategy core** — In `src/strategies/html.ts`, implement HTML chunking: split on heading elements (`<h1>`-`<h6>`), then sectioning elements (`<section>`, `<article>`, etc.), then block-level elements (`<div>`, `<p>`, etc.), then line breaks, then text content boundaries. | Status: not_done

- [ ] **Implement tag balancing** — Ensure every chunk contains balanced opening and closing tags. Find split points where the tag stack is empty or at a level that produces self-contained HTML fragments. | Status: not_done

- [ ] **Implement preserveTagHierarchy option** — When `true`, wrap each chunk in its ancestor tags to preserve the tag hierarchy (e.g., `<div><section>chunk content</section></div>`). Default: `false`. | Status: not_done

- [ ] **Implement stripTags option** — When `true`, remove HTML tags from chunk content, producing plain text. Tag boundaries are still used for splitting decisions. Default: `false`. | Status: not_done

- [ ] **Implement HTML atomic units** — Treat `<pre>`, `<table>`, `<svg>`, `<script>`, and `<style>` blocks as atomic units. | Status: not_done

- [ ] **Implement HTML heading context tracking** — Track `<h1>`-`<h6>` elements for heading context metadata, similar to markdown heading tracking. | Status: not_done

- [ ] **Implement chunkHTML() export** — In `src/chunk-html.ts`, export `function chunkHTML(text: string, options?: HTMLChunkOptions): Chunk[]`. | Status: not_done

- [ ] **Write HTML strategy tests** — In `src/__tests__/chunk-html.test.ts`, test with real HTML documents containing nested divs, tables, lists, pre blocks, script tags. Verify tag balancing, `stripTags`, `preserveTagHierarchy`, and atomic unit preservation. | Status: not_done

### 3.5 JSON Chunking Strategy

- [ ] **Implement JSON strategy core** — In `src/strategies/json.ts`, implement JSON chunking: for top-level arrays, each element becomes a separate chunk (or multiple elements are grouped to reach target size). For top-level objects, group properties into chunks. Nested structures are treated as atomic. | Status: not_done

- [ ] **Implement JSON path metadata** — Attach `jsonPaths` to each chunk's metadata: an array of JSON path strings (e.g., `["$.users[0]", "$.users[1]"]`) identifying the properties/elements in the chunk. | Status: not_done

- [ ] **Implement JSON pretty-printing** — JSON chunks are always pretty-printed by default. Implement the `compact` option for minified output. | Status: not_done

- [ ] **Implement oversized JSON value force-split** — When a single nested value exceeds `maxChunkSize`, force-split: for nested objects/arrays, split at the first level of internal structure; for long strings, split at sentence or word boundaries. Each sub-chunk must be valid JSON. | Status: not_done

- [ ] **Implement chunkJSON() export** — In `src/chunk-json.ts`, export `function chunkJSON(text: string, options?: JSONChunkOptions): Chunk[]`. | Status: not_done

- [ ] **Write JSON strategy tests** — In `src/__tests__/chunk-json.test.ts`, test with arrays of objects, nested structures, large string values, deeply nested JSON, and verify JSON path metadata and pretty-printing. | Status: not_done

### 3.6 YAML Chunking Strategy

- [ ] **Implement YAML strategy core** — In `src/strategies/yaml.ts`, implement YAML chunking: split multi-document YAML on `---` separators. Split within documents at top-level key boundaries. Keep indented blocks under a key as atomic units. Preserve comments preceding a key. | Status: not_done

- [ ] **Write YAML strategy tests** — Test multi-document YAML, top-level key splitting, nested block preservation, and comment preservation. | Status: not_done

### 3.7 Strategy Registry

- [ ] **Implement strategy registry** — In `src/strategies/index.ts`, create a registry that maps `ContentType` to its corresponding chunking strategy function. Provide a `dispatch(contentType, text, options)` function that routes to the correct strategy. | Status: not_done

### 3.8 Create Test Fixtures for Code, HTML, JSON

- [ ] **Create code test fixtures** — In `src/__tests__/fixtures/code/`, create sample source files in JavaScript, TypeScript, Python, and shell script. | Status: not_done

- [ ] **Create HTML test fixtures** — In `src/__tests__/fixtures/html/`, create sample HTML documents with nested elements, tables, scripts, and mixed content. | Status: not_done

- [ ] **Create JSON test fixtures** — In `src/__tests__/fixtures/json/`, create sample JSON files: array of objects, deeply nested, large string values. | Status: not_done

- [ ] **Create mixed content test fixtures** — In `src/__tests__/fixtures/mixed/`, create documents with mixed content types (markdown with embedded JSON, HTML with embedded code). | Status: not_done

---

## Phase 4: Factory, CLI, Integration Tests, and Polish

### 4.1 Factory Function

- [x] **Implement createChunker()** — In `src/factory.ts`, implement the factory function that accepts `ChunkOptions` and returns a `Chunker` instance. The instance pre-binds the options to all chunking methods. Per-call overrides merge with factory options, which merge with defaults (highest precedence: per-call > factory > defaults). | Status: done

- [x] **Export createChunker from index.ts** — Add `createChunker` to the public API exports. | Status: done

- [x] **Write factory tests** — Test option merging precedence, verify that factory-created chunkers produce identical results to direct function calls with the same options. | Status: done

### 4.2 CLI Implementation

- [ ] **Implement CLI argument parser** — In `src/cli.ts`, implement CLI flag parsing for all flags specified in the spec: `--max-size`, `--min-size`, `--target-size`, `--overlap`, `--unit`, `--content-type`, `--no-structure`, `--header-depth`, `--frontmatter`, `--split-lists`, `--language`, `--strip-tags`, `--format`, `--compact`, `--content-only`, `--version`, `--help`, `--stdin`. Parse without external dependencies (use `process.argv` directly). | Status: not_done

- [ ] **Implement file input reading** — Read input from a file path argument. Handle file not found and read errors with exit code 1. | Status: not_done

- [ ] **Implement stdin reading** — Read input from stdin when no file is specified or `--stdin` is used. Handle empty input with exit code 1. | Status: not_done

- [ ] **Implement JSON output format** — Output chunks as a JSON array of `Chunk` objects (the default format). | Status: not_done

- [ ] **Implement JSONL output format** — Output one `Chunk` JSON object per line when `--format jsonl` is specified. | Status: not_done

- [ ] **Implement text output format** — Output chunk content only, separated by `----`, when `--format text` is specified. | Status: not_done

- [ ] **Implement --content-only flag** — When set, output only `content` fields, not full `Chunk` objects with metadata. | Status: not_done

- [ ] **Implement --compact flag for CLI** — Output minified JSON (no pretty-printing) when `--compact` is specified. | Status: not_done

- [ ] **Implement --version flag** — Print the version from `package.json` and exit with code 0. | Status: not_done

- [ ] **Implement --help flag** — Print usage information and exit with code 0. | Status: not_done

- [ ] **Implement configuration validation** — Validate flag values (e.g., `--max-size` must be a positive number, `--unit` must be `tokens` or `characters`, `--content-type` must be a valid ContentType). Exit with code 2 on invalid flags. | Status: not_done

- [ ] **Implement exit codes** — Exit 0 on success, exit 1 on input error (file not found, read failure, empty input), exit 2 on configuration error (invalid flags or incompatible options). | Status: not_done

- [ ] **Add shebang line to cli.ts** — Add `#!/usr/bin/env node` at the top of the compiled `cli.js` so it can be executed directly. | Status: not_done

- [ ] **Write CLI tests** — In `src/__tests__/cli.test.ts`, test: file input chunking, stdin input chunking, all three output formats (json, jsonl, text), flag parsing for all flags, `--version` output, `--help` output, invalid flag exit code 2, missing file exit code 1, empty input exit code 1. | Status: not_done

### 4.3 Integration Tests

- [ ] **Implement roundtrip test** — Chunk a document, concatenate all chunks (removing overlap), verify the result matches the original input. Test with multiple content types. | Status: not_done

- [ ] **Implement size compliance test** — Chunk documents of various sizes and content types. Verify no chunk exceeds `maxChunkSize` (except documented force-split cases). Verify no chunk is below `minChunkSize` (except first/last chunk exemptions). | Status: not_done

- [ ] **Implement overlap consistency test** — Chunk with overlap, verify that the overlap region of chunk N+1 matches the end of chunk N exactly. | Status: not_done

- [ ] **Implement determinism test** — Chunk the same input twice with the same options, verify identical output (deep equality on the entire `Chunk[]` array). | Status: not_done

- [ ] **Implement large document test** — Chunk a 1MB document, verify completion within performance targets (< 50ms), verify correct chunk count and metadata integrity. | Status: not_done

### 4.4 Edge Case Tests

- [x] **Test empty input** — Verify `chunk('')` returns an empty array. | Status: done

- [ ] **Test whitespace-only input** — Verify `chunk('   \n\n  ')` returns an empty array. | Status: not_done

- [ ] **Test single character input** — Verify `chunk('a')` returns one chunk with correct metadata. | Status: not_done

- [ ] **Test unclosed code fence** — Verify a code fence with no closing marker treats the remainder of the document as the code block. | Status: not_done

- [ ] **Test table with no data rows** — Verify a table with only header and separator rows is kept atomic. | Status: not_done

- [ ] **Test deeply nested JSON** — Verify chunking JSON nested 50+ levels deep completes without stack overflow. | Status: not_done

- [ ] **Test single oversized line** — Verify a single line exceeding `maxChunkSize` is force-split at word boundaries. | Status: not_done

- [ ] **Test Unicode text** — Test with CJK characters, emoji, and right-to-left text. Verify token counting and boundary detection work correctly. | Status: not_done

- [ ] **Test mixed line endings** — Verify correct behavior with `\r\n`, `\r`, and `\n` line endings (and mixed within the same document). | Status: not_done

- [ ] **Test document with every structural element** — Create a stress test document containing headers, code fences, tables, lists, blockquotes, frontmatter, math blocks, HTML blocks, and inline JSON. Verify all atomic units are correctly preserved. | Status: not_done

### 4.5 Performance

- [ ] **Implement pre-computed boundary map** — Before splitting, scan the entire document and build an array of boundary positions with types and levels. The splitting algorithm operates on this array instead of re-scanning. | Status: not_done

- [ ] **Implement lazy token counting** — Compute token counts only when needed for split decisions. For chunks obviously within size limits (by character count heuristic), defer exact token counting. | Status: not_done

- [ ] **Implement minimal string copying** — Operate on the original string using offset ranges during boundary analysis. Create substring copies only in the final output step. | Status: not_done

- [ ] **Ensure no backtracking regex** — Audit all regular expressions to ensure they are linear-time. Replace complex patterns with hand-written scanners where backtracking risk exists. | Status: not_done

- [ ] **Create performance benchmark** — Create a benchmark script that measures chunking time for documents of various sizes (1KB, 10KB, 50KB, 100KB, 500KB, 1MB) and content types. Verify results meet the spec targets. | Status: not_done

### 4.6 Documentation

- [ ] **Write README.md** — Create a comprehensive README covering: package overview, installation, quick start, API reference (`chunk`, `chunkMarkdown`, `chunkCode`, `chunkHTML`, `chunkJSON`, `createChunker`, `detectContentType`), CLI usage, configuration options table, content type detection, atomic unit handling, overlap, integration examples (with `embed-cache`, `context-packer`, `rag-prompt-builder`), and performance characteristics. | Status: not_done

- [ ] **Add JSDoc comments to all public functions** — Add JSDoc to `chunk()`, `chunkMarkdown()`, `chunkCode()`, `chunkHTML()`, `chunkJSON()`, `createChunker()`, `detectContentType()`, and all exported types/interfaces. | Status: not_done

### 4.7 Final Exports and Build Verification

- [ ] **Update index.ts with all exports** — Ensure `src/index.ts` exports: `chunk`, `chunkMarkdown`, `chunkCode`, `chunkHTML`, `chunkJSON`, `createChunker`, `detectContentType`, and all public types (`Chunk`, `ChunkMetadata`, `ChunkOptions`, `MarkdownChunkOptions`, `CodeChunkOptions`, `HTMLChunkOptions`, `JSONChunkOptions`, `ContentType`, `SizeUnit`, `DetectResult`, `Chunker`). | Status: not_done

- [ ] **Final build verification** — Run `npm run build`, `npm run lint`, and `npm run test` with all tests passing. Verify the `dist/` output contains all expected files. | Status: not_done

- [ ] **Version bump to 1.0.0** — Update `package.json` version to `1.0.0` for production release after all phases are complete. | Status: not_done
