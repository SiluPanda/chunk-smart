import type { ChunkOptions } from './types'

function tokensToChars(tokens: number): number {
  return tokens * 4
}

/**
 * Split text at sentence boundaries (. ! ? followed by space or end).
 * Returns an array of sentence strings.
 */
function splitSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?])\s+/)
  return parts.filter(p => p.length > 0)
}

/**
 * Greedy-pack sentences into chunks no larger than maxChars.
 */
function packSentences(sentences: string[], maxChars: number): string[] {
  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      // Single sentence exceeds limit: split at word boundaries
      if (current.length > 0) {
        chunks.push(current.trimEnd())
        current = ''
      }
      const words = sentence.split(/\s+/)
      let wordChunk = ''
      for (const word of words) {
        if (wordChunk.length + word.length + 1 > maxChars && wordChunk.length > 0) {
          chunks.push(wordChunk.trimEnd())
          wordChunk = ''
        }
        // Single word exceeds maxChars: hard split it
        if (word.length > maxChars) {
          for (let i = 0; i < word.length; i += maxChars) {
            chunks.push(word.slice(i, i + maxChars))
          }
          continue
        }
        wordChunk += (wordChunk.length > 0 ? ' ' : '') + word
      }
      if (wordChunk.length > 0) current = wordChunk
    } else if (current.length + sentence.length + 1 > maxChars && current.length > 0) {
      chunks.push(current.trimEnd())
      current = sentence
    } else {
      current += (current.length > 0 ? ' ' : '') + sentence
    }
  }
  if (current.length > 0) chunks.push(current.trimEnd())
  return chunks
}

export function splitByTokenCount(text: string, maxTokens: number, overlap: number): string[] {
  const maxChars = tokensToChars(maxTokens)
  const overlapChars = tokensToChars(overlap)

  if (text.length <= maxChars) return [text]

  const chunks: string[] = []
  let pos = 0

  while (pos < text.length) {
    let end = pos + maxChars
    if (end >= text.length) {
      chunks.push(text.slice(pos))
      break
    }

    // Try to find a sentence boundary near end
    const window = text.slice(pos, end)
    const sentenceMatch = window.search(/[.!?]\s+[^\s](?=[^.!?]*$)/)
    if (sentenceMatch > maxChars / 2) {
      // Snap to sentence boundary
      const snapEnd = pos + sentenceMatch + 1
      chunks.push(text.slice(pos, snapEnd).trimEnd())
      pos = snapEnd - overlapChars
      if (pos < 0) pos = 0
    } else {
      chunks.push(text.slice(pos, end).trimEnd())
      pos = end - overlapChars
      if (pos <= 0 || pos >= text.length) break
    }
  }

  return chunks.filter(c => c.length > 0)
}

export function splitMarkdown(text: string, options: ChunkOptions): string[] {
  const maxChars = tokensToChars(options.maxTokens ?? 512)

  // Split at heading boundaries
  const headingRegex = /(?=^#{1,6}\s+)/m
  const sections = text.split(headingRegex).filter(s => s.trim().length > 0)

  if (sections.length <= 1) {
    // No headings: split at paragraphs
    return splitText(text, options)
  }

  const result: string[] = []

  for (const section of sections) {
    if (section.length <= maxChars) {
      result.push(section)
    } else {
      // Section too big: split at paragraph boundaries
      const paragraphs = section.split(/\n{2,}/).filter(p => p.trim().length > 0)
      let current = ''
      for (const para of paragraphs) {
        if (para.length > maxChars) {
          if (current.length > 0) {
            result.push(current.trimEnd())
            current = ''
          }
          // Paragraph too big: split at sentences
          const sentenceChunks = packSentences(splitSentences(para), maxChars)
          result.push(...sentenceChunks)
        } else if (current.length + para.length + 2 > maxChars && current.length > 0) {
          result.push(current.trimEnd())
          current = para
        } else {
          current += (current.length > 0 ? '\n\n' : '') + para
        }
      }
      if (current.length > 0) result.push(current.trimEnd())
    }
  }

  return result.filter(c => c.trim().length > 0)
}

export function splitCode(text: string, options: ChunkOptions): string[] {
  const maxChars = tokensToChars(options.maxTokens ?? 512)

  if (text.length <= maxChars) return [text]

  // Find top-level function/class/def/const/let/var boundaries
  const topLevelRegex = /(?=^(?:export\s+)?(?:async\s+)?(?:function\s+\w|class\s+\w|def\s+\w|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=))/m
  const blocks = text.split(topLevelRegex).filter(b => b.trim().length > 0)

  if (blocks.length <= 1) {
    // No top-level boundaries: split at blank lines
    return splitAtBlankLines(text, maxChars)
  }

  const result: string[] = []
  let current = ''

  for (const block of blocks) {
    if (block.length > maxChars) {
      if (current.length > 0) {
        result.push(current.trimEnd())
        current = ''
      }
      result.push(...splitAtBlankLines(block, maxChars))
    } else if (current.length + block.length > maxChars && current.length > 0) {
      result.push(current.trimEnd())
      current = block
    } else {
      current += block
    }
  }

  if (current.length > 0) result.push(current.trimEnd())
  return result.filter(c => c.trim().length > 0)
}

function splitAtBlankLines(text: string, maxChars: number): string[] {
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 0)
  const result: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if (para.length > maxChars) {
      if (current.length > 0) {
        result.push(current.trimEnd())
        current = ''
      }
      // Hard split by chars
      for (let i = 0; i < para.length; i += maxChars) {
        result.push(para.slice(i, i + maxChars))
      }
    } else if (current.length + para.length + 2 > maxChars && current.length > 0) {
      result.push(current.trimEnd())
      current = para
    } else {
      current += (current.length > 0 ? '\n\n' : '') + para
    }
  }

  if (current.length > 0) result.push(current.trimEnd())
  return result
}

export function splitJSON(text: string, options: ChunkOptions): string[] {
  const maxChars = tokensToChars(options.maxTokens ?? 512)

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return splitByTokenCount(text, options.maxTokens ?? 512, options.overlap ?? 0)
  }

  const chunks: string[] = []

  if (Array.isArray(parsed)) {
    // Split array elements into groups
    const itemsPerChunk = Math.max(1, Math.floor(maxChars / Math.max(1, text.length / parsed.length)))
    for (let i = 0; i < parsed.length; i += itemsPerChunk) {
      chunks.push(JSON.stringify(parsed.slice(i, i + itemsPerChunk), null, 2))
    }
  } else if (parsed !== null && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    const keys = Object.keys(obj)
    let currentObj: Record<string, unknown> = {}
    let currentSize = 0

    for (const key of keys) {
      const entry = JSON.stringify({ [key]: obj[key] }, null, 2)
      if (currentSize + entry.length > maxChars && currentSize > 0) {
        chunks.push(JSON.stringify(currentObj, null, 2))
        currentObj = {}
        currentSize = 0
      }
      currentObj[key] = obj[key]
      currentSize += entry.length
    }

    if (Object.keys(currentObj).length > 0) {
      chunks.push(JSON.stringify(currentObj, null, 2))
    }
  } else {
    return [text]
  }

  return chunks.filter(c => c.trim().length > 0)
}

export function splitText(text: string, options: ChunkOptions): string[] {
  const maxChars = tokensToChars(options.maxTokens ?? 512)

  if (text.length <= maxChars) return [text]

  // Split at paragraph boundaries (double newline)
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 0)

  const result: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if (para.length > maxChars) {
      if (current.length > 0) {
        result.push(current.trimEnd())
        current = ''
      }
      // Split at sentence boundaries
      const sentenceChunks = packSentences(splitSentences(para), maxChars)
      result.push(...sentenceChunks)
    } else if (current.length + para.length + 2 > maxChars && current.length > 0) {
      result.push(current.trimEnd())
      current = para
    } else {
      current += (current.length > 0 ? '\n\n' : '') + para
    }
  }

  if (current.length > 0) result.push(current.trimEnd())
  return result.filter(c => c.trim().length > 0)
}
