import { detectContentType } from './detect'
import { splitMarkdown, splitCode, splitJSON, splitText, splitByTokenCount } from './split'
import type { Chunk, ChunkMetadata, ChunkOptions, Chunker, ContentType, DetectResult } from './types'

const DEFAULTS: Required<ChunkOptions> = {
  maxTokens: 512,
  minTokens: 50,
  overlap: 0,
  contentType: 'text',
  preserveStructure: true,
}

function resolveOptions(defaults: Required<ChunkOptions>, overrides?: Partial<ChunkOptions>): Required<ChunkOptions> {
  return { ...defaults, ...(overrides ?? {}) }
}

function tokensFor(text: string): number {
  return Math.ceil(text.length / 4)
}

/** Extract first-level headings from a markdown chunk for metadata. */
function extractHeadings(content: string): string[] {
  const headings: string[] = []
  for (const line of content.split('\n')) {
    const m = line.match(/^(#{1,6})\s+(.+)/)
    if (m) headings.push(m[2].trim())
  }
  return headings
}

/** Detect code language from fence or shebang on first non-empty line. */
function detectCodeLanguage(content: string): string | undefined {
  const first = content.trimStart().split('\n')[0] ?? ''
  const fenceMatch = first.match(/^```(\w+)/)
  if (fenceMatch) return fenceMatch[1]
  const shebangMatch = first.match(/^#!.*\/(\w+)/)
  if (shebangMatch) return shebangMatch[1]
  return undefined
}

function buildChunks(
  parts: string[],
  originalText: string,
  contentType: ContentType,
  options: Required<ChunkOptions>,
): Chunk[] {
  const overlapChars = options.overlap * 4
  const chunks: Chunk[] = []

  // Build startOffset by searching for each part in the original text
  let searchFrom = 0

  for (let i = 0; i < parts.length; i++) {
    const content = parts[i]
    if (!content || content.trim().length === 0) continue

    // Find where this part appears in the original text
    let startOffset = originalText.indexOf(content.trimEnd(), searchFrom)
    if (startOffset === -1) {
      // Fallback: search trimmed
      startOffset = originalText.indexOf(content.trim(), searchFrom)
    }
    if (startOffset === -1) startOffset = searchFrom

    const endOffset = startOffset + content.length

    const overlapBefore = i > 0 ? Math.min(overlapChars, (parts[i - 1] ?? '').length) : 0
    const overlapAfter = i < parts.length - 1 ? Math.min(overlapChars, (parts[i + 1] ?? '').length) : 0

    const metadata: ChunkMetadata = {
      index: chunks.length,
      startOffset,
      endOffset,
      tokenCount: tokensFor(content),
      charCount: content.length,
      contentType,
      headings: contentType === 'markdown' ? extractHeadings(content) : [],
      codeLanguage: contentType === 'code' ? detectCodeLanguage(content) : undefined,
      overlapBefore,
      overlapAfter,
    }

    chunks.push({ content, metadata })
    searchFrom = Math.max(searchFrom, startOffset + 1)
  }

  return chunks
}

export function chunk(text: string, options?: ChunkOptions): Chunk[] {
  const opts = resolveOptions(DEFAULTS, options)

  let contentType: ContentType
  if (opts.contentType && opts.contentType !== 'text') {
    contentType = opts.contentType
  } else if (options?.contentType) {
    contentType = options.contentType
  } else {
    const detected = detectContentType(text)
    contentType = detected.type
  }

  let parts: string[]

  switch (contentType) {
    case 'markdown':
      parts = splitMarkdown(text, opts)
      break
    case 'code':
      parts = splitCode(text, opts)
      break
    case 'json':
      parts = splitJSON(text, opts)
      break
    case 'html':
    case 'yaml':
    case 'text':
    default:
      if (opts.preserveStructure) {
        parts = splitText(text, opts)
      } else {
        parts = splitByTokenCount(text, opts.maxTokens, opts.overlap)
      }
      break
  }

  return buildChunks(parts, text, contentType, opts)
}

export function createChunker(defaultOptions?: ChunkOptions): Chunker {
  const defaults = resolveOptions(DEFAULTS, defaultOptions)

  return {
    chunk(text: string, overrides?: Partial<ChunkOptions>): Chunk[] {
      return chunk(text, resolveOptions(defaults, overrides))
    },

    chunkMarkdown(text: string, overrides?: Partial<ChunkOptions>): Chunk[] {
      return chunk(text, resolveOptions(defaults, { ...overrides, contentType: 'markdown' }))
    },

    chunkCode(text: string, overrides?: Partial<ChunkOptions>): Chunk[] {
      return chunk(text, resolveOptions(defaults, { ...overrides, contentType: 'code' }))
    },

    chunkJSON(text: string, overrides?: Partial<ChunkOptions>): Chunk[] {
      return chunk(text, resolveOptions(defaults, { ...overrides, contentType: 'json' }))
    },

    detectContentType(text: string): DetectResult {
      return detectContentType(text)
    },
  }
}
