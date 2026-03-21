import { describe, it, expect } from 'vitest'
import { detectContentType } from '../detect'

describe('detectContentType', () => {
  it('detects valid JSON object with high confidence', () => {
    const result = detectContentType('{"key": "value", "num": 42}')
    expect(result.type).toBe('json')
    expect(result.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('detects valid JSON array with high confidence', () => {
    const result = detectContentType('[1, 2, 3]')
    expect(result.type).toBe('json')
    expect(result.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('detects malformed JSON starting with { at lower confidence', () => {
    const result = detectContentType('{ not valid json here }')
    expect(result.type).toBe('json')
    expect(result.confidence).toBeLessThan(0.9)
  })

  it('detects markdown with headings', () => {
    const md = `# Title\n\nSome paragraph text here.\n\n## Section Two\n\nMore text.`
    const result = detectContentType(md)
    expect(result.type).toBe('markdown')
    expect(result.confidence).toBeGreaterThanOrEqual(0.8)
  })

  it('detects markdown with code fences', () => {
    const md = `Some text\n\n\`\`\`js\nconsole.log('hi')\n\`\`\``
    const result = detectContentType(md)
    expect(result.type).toBe('markdown')
  })

  it('detects HTML with DOCTYPE', () => {
    const html = `<!DOCTYPE html><html><body><p>Hello</p></body></html>`
    const result = detectContentType(html)
    expect(result.type).toBe('html')
    expect(result.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('detects HTML with div tags', () => {
    const html = `<div class="container"><p>Hello world</p></div>`
    const result = detectContentType(html)
    expect(result.type).toBe('html')
  })

  it('detects code with function keyword', () => {
    const code = `function greet(name) {\n  return 'Hello ' + name\n}`
    const result = detectContentType(code)
    expect(result.type).toBe('code')
    expect(result.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('detects code with class keyword', () => {
    const code = `class MyClass {\n  constructor() {}\n}`
    const result = detectContentType(code)
    expect(result.type).toBe('code')
  })

  it('detects code with Python def keyword', () => {
    const code = `def compute(x, y):\n    return x + y\n`
    const result = detectContentType(code)
    expect(result.type).toBe('code')
  })

  it('falls back to text for plain prose', () => {
    const text = `This is just a plain text paragraph without any special syntax. It has multiple sentences and no special markers.`
    const result = detectContentType(text)
    expect(result.type).toBe('text')
    expect(result.confidence).toBe(0.5)
  })

  it('detects YAML with key-value lines', () => {
    const yaml = `name: my-project\nversion: 1.0.0\ndescription: a project\nauthor: someone`
    const result = detectContentType(yaml)
    expect(result.type).toBe('yaml')
    expect(result.confidence).toBeGreaterThanOrEqual(0.8)
  })
})
