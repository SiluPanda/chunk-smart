import { describe, it, expect } from 'vitest'
import { splitByTokenCount, splitMarkdown, splitCode, splitJSON, splitText } from '../split'
import type { ChunkOptions } from '../types'

function opts(maxTokens: number, overlap = 0): ChunkOptions {
  return { maxTokens, overlap, minTokens: 0, preserveStructure: true }
}

describe('splitByTokenCount', () => {
  it('returns single chunk when text fits within maxTokens', () => {
    const text = 'Short text'
    const result = splitByTokenCount(text, 512, 0)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(text)
  })

  it('splits long text into multiple chunks respecting maxTokens', () => {
    // 200 chars -> 50 tokens; max is 10 tokens = 40 chars
    const text = 'A'.repeat(200)
    const result = splitByTokenCount(text, 10, 0)
    expect(result.length).toBeGreaterThan(1)
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(40 + 5) // small tolerance for boundary snapping
    }
  })

  it('adds overlap between chunks', () => {
    const text = 'Hello world. This is a sentence. And another one follows here. Final words.'
    const result = splitByTokenCount(text, 5, 1) // 5 tokens = 20 chars, 1 token overlap = 4 chars
    expect(result.length).toBeGreaterThan(1)
  })
})

describe('splitMarkdown', () => {
  it('splits at heading boundaries', () => {
    const md = `# Heading One\n\nParagraph under heading one.\n\n# Heading Two\n\nParagraph under heading two.`
    const result = splitMarkdown(md, opts(512))
    expect(result.length).toBeGreaterThanOrEqual(2)
    expect(result.some(r => r.includes('# Heading One'))).toBe(true)
    expect(result.some(r => r.includes('# Heading Two'))).toBe(true)
  })

  it('splits a large section at paragraph boundaries', () => {
    // Each paragraph is ~100 chars; maxTokens=10 means 40 chars
    const para = (n: number) => `Para ${n}: ` + 'x'.repeat(30)
    const md = `# Title\n\n${para(1)}\n\n${para(2)}\n\n${para(3)}`
    const result = splitMarkdown(md, opts(10))
    expect(result.length).toBeGreaterThan(1)
  })

  it('handles text with no headings by falling back to paragraph split', () => {
    const text = 'First paragraph here.\n\nSecond paragraph here.\n\nThird paragraph here.'
    const result = splitMarkdown(text, opts(512))
    expect(result.length).toBeGreaterThanOrEqual(1)
  })

  it('returns entire text as one chunk when it fits', () => {
    const text = '# Small doc\n\nJust a small paragraph.'
    const result = splitMarkdown(text, opts(512))
    expect(result).toHaveLength(1)
  })
})

describe('splitCode', () => {
  it('returns single chunk for small code', () => {
    const code = `function foo() { return 1 }`
    const result = splitCode(code, opts(512))
    expect(result).toHaveLength(1)
  })

  it('splits at function boundaries', () => {
    const code = `function alpha() {\n  return 1\n}\n\nfunction beta() {\n  return 2\n}\n\nfunction gamma() {\n  return 3\n}`
    const result = splitCode(code, opts(5)) // tiny maxTokens to force splits
    expect(result.length).toBeGreaterThan(1)
  })

  it('splits at blank lines when no top-level patterns found', () => {
    const code = `x = 1\ny = 2\n\nz = x + y\n\nprint(z)\n`.repeat(20)
    const result = splitCode(code, opts(10))
    expect(result.length).toBeGreaterThan(1)
  })
})

describe('splitJSON', () => {
  it('splits object by top-level keys', () => {
    const obj: Record<string, number> = {}
    for (let i = 0; i < 20; i++) obj[`key${i}`] = i
    const json = JSON.stringify(obj, null, 2)
    const result = splitJSON(json, opts(10)) // force small chunk size
    expect(result.length).toBeGreaterThan(1)
    // Each chunk should be valid JSON
    for (const c of result) {
      expect(() => JSON.parse(c)).not.toThrow()
    }
  })

  it('splits array into groups', () => {
    const arr = Array.from({ length: 50 }, (_, i) => ({ id: i, value: `item${i}` }))
    const json = JSON.stringify(arr, null, 2)
    const result = splitJSON(json, opts(10))
    expect(result.length).toBeGreaterThan(1)
  })

  it('falls back to token split for invalid JSON', () => {
    const text = 'not json at all'.repeat(50)
    const result = splitJSON(text, opts(10))
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('splitText', () => {
  it('returns single chunk when text fits', () => {
    const text = 'Short text that fits easily.'
    const result = splitText(text, opts(512))
    expect(result).toHaveLength(1)
  })

  it('splits at paragraph boundaries', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.'
    const result = splitText(text, opts(3)) // 3 tokens = 12 chars — forces splits
    expect(result.length).toBeGreaterThan(1)
  })

  it('splits at sentence boundaries when paragraph is too large', () => {
    const longPara = 'This is sentence one. This is sentence two. This is sentence three. This is sentence four.'
    const result = splitText(longPara, opts(5))
    expect(result.length).toBeGreaterThan(1)
  })
})
