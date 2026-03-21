import { describe, it, expect } from 'vitest'
import { chunk, createChunker } from '../chunker'

describe('chunk()', () => {
  it('returns an array of Chunk objects', () => {
    const text = `# Title\n\nSome paragraph text here.\n\n## Section\n\nMore text in section.`
    const result = chunk(text)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    for (const c of result) {
      expect(typeof c.content).toBe('string')
      expect(c.metadata).toBeDefined()
      expect(typeof c.metadata.index).toBe('number')
      expect(typeof c.metadata.tokenCount).toBe('number')
      expect(typeof c.metadata.charCount).toBe('number')
      expect(typeof c.metadata.startOffset).toBe('number')
      expect(typeof c.metadata.endOffset).toBe('number')
    }
  })

  it('respects maxTokens option', () => {
    const text = 'Word '.repeat(500)
    const result = chunk(text, { maxTokens: 50, contentType: 'text' })
    for (const c of result) {
      expect(c.metadata.tokenCount).toBeLessThanOrEqual(55) // small tolerance
    }
  })

  it('assigns correct contentType in metadata for markdown', () => {
    const text = `# Heading\n\nParagraph text here.\n\n## Another heading\n\nMore text.`
    const result = chunk(text, { contentType: 'markdown' })
    for (const c of result) {
      expect(c.metadata.contentType).toBe('markdown')
    }
  })

  it('assigns correct contentType in metadata for code', () => {
    const code = `function foo() { return 1 }\nfunction bar() { return 2 }`
    const result = chunk(code, { contentType: 'code' })
    for (const c of result) {
      expect(c.metadata.contentType).toBe('code')
    }
  })

  it('assigns sequential indices to chunks', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.'
    const result = chunk(text, { maxTokens: 5, contentType: 'text' })
    result.forEach((c, i) => {
      expect(c.metadata.index).toBe(i)
    })
  })

  it('extracts headings from markdown chunks', () => {
    const text = `# Main Heading\n\nSome content under main heading.\n\n## Sub Heading\n\nSome content under sub.`
    const result = chunk(text, { contentType: 'markdown' })
    const withHeadings = result.filter(c => c.metadata.headings.length > 0)
    expect(withHeadings.length).toBeGreaterThan(0)
  })

  it('detects JSON content type automatically', () => {
    const json = JSON.stringify({ foo: 'bar', baz: 42 })
    const result = chunk(json)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].metadata.contentType).toBe('json')
  })

  it('handles empty string gracefully', () => {
    const result = chunk('')
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(0)
  })

  it('charCount matches content length', () => {
    const text = `# Title\n\nA paragraph of reasonable length here.\n\n## Section\n\nAnother paragraph.`
    const result = chunk(text, { contentType: 'markdown' })
    for (const c of result) {
      expect(c.metadata.charCount).toBe(c.content.length)
    }
  })

  it('tokenCount is ceil(charCount / 4)', () => {
    const text = `# Title\n\nA paragraph of reasonable length here.`
    const result = chunk(text, { contentType: 'markdown' })
    for (const c of result) {
      expect(c.metadata.tokenCount).toBe(Math.ceil(c.content.length / 4))
    }
  })
})

describe('createChunker()', () => {
  it('returns a Chunker object with all methods', () => {
    const chunker = createChunker()
    expect(typeof chunker.chunk).toBe('function')
    expect(typeof chunker.chunkMarkdown).toBe('function')
    expect(typeof chunker.chunkCode).toBe('function')
    expect(typeof chunker.chunkJSON).toBe('function')
    expect(typeof chunker.detectContentType).toBe('function')
  })

  it('applies default options to all chunk calls', () => {
    const chunker = createChunker({ maxTokens: 20 })
    const text = 'A'.repeat(400)
    const result = chunker.chunk(text, { contentType: 'text' })
    for (const c of result) {
      expect(c.metadata.tokenCount).toBeLessThanOrEqual(25)
    }
  })

  it('chunkMarkdown forces markdown content type', () => {
    const text = `# Heading\n\nText here.\n\n## Other\n\nMore text.`
    const chunker = createChunker()
    const result = chunker.chunkMarkdown(text)
    for (const c of result) {
      expect(c.metadata.contentType).toBe('markdown')
    }
  })

  it('chunkCode forces code content type', () => {
    const code = `function a() {}\nfunction b() {}`
    const chunker = createChunker()
    const result = chunker.chunkCode(code)
    for (const c of result) {
      expect(c.metadata.contentType).toBe('code')
    }
  })

  it('chunkJSON forces json content type', () => {
    const json = '{"a":1,"b":2}'
    const chunker = createChunker()
    const result = chunker.chunkJSON(json)
    for (const c of result) {
      expect(c.metadata.contentType).toBe('json')
    }
  })

  it('detectContentType delegates to detect module', () => {
    const chunker = createChunker()
    const result = chunker.detectContentType('{"x": 1}')
    expect(result.type).toBe('json')
    expect(result.confidence).toBeGreaterThan(0)
  })
})
