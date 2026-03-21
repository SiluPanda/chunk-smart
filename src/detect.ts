import type { ContentType, DetectResult } from './types'

export function detectContentType(text: string): DetectResult {
  const trimmed = text.trim()

  // JSON: starts with { or [
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed)
      return { type: 'json' as ContentType, confidence: 0.95 }
    } catch {
      return { type: 'json' as ContentType, confidence: 0.7 }
    }
  }

  // HTML: starts with <!DOCTYPE or <html, or has common HTML tags
  if (
    /^<!doctype\s+html/i.test(trimmed) ||
    /^<html/i.test(trimmed) ||
    /<(div|p|span|body|head|h[1-6]|ul|ol|li|table|form|input|a\s|img\s)[^>]*>/i.test(trimmed)
  ) {
    return { type: 'html' as ContentType, confidence: 0.9 }
  }

  // YAML: has key: value lines, optional --- marker, no < chars
  if (!trimmed.includes('<')) {
    const lines = trimmed.split('\n').slice(0, 20)
    const yamlKeyValueLines = lines.filter(l => /^\s*[\w-]+\s*:\s*.+/.test(l))
    const hasMarker = trimmed.startsWith('---')
    if (hasMarker || yamlKeyValueLines.length >= 2) {
      return { type: 'yaml' as ContentType, confidence: 0.8 }
    }
  }

  // Markdown: has # headings, ``` fences, **bold**, - list items
  let mdScore = 0
  if (/^#{1,6}\s+\S/m.test(trimmed)) mdScore += 2
  if (/```/.test(trimmed)) mdScore += 2
  if (/\*\*[^*]+\*\*/.test(trimmed)) mdScore += 1
  if (/^[-*+]\s+\S/m.test(trimmed)) mdScore += 1
  if (/^\[.+\]\(.+\)/m.test(trimmed)) mdScore += 1
  if (mdScore >= 2) {
    return { type: 'markdown' as ContentType, confidence: 0.8 }
  }

  // Code: common code patterns
  let codeScore = 0
  if (/\bfunction\s+\w+\s*\(/.test(trimmed)) codeScore += 2
  if (/\bclass\s+\w+/.test(trimmed)) codeScore += 2
  if (/\bdef\s+\w+\s*\(/.test(trimmed)) codeScore += 2
  if (/\bimport\s+[\w{*]/.test(trimmed)) codeScore += 1
  if (/\bconst\s+\w+\s*=/.test(trimmed)) codeScore += 1
  if (/\blet\s+\w+\s*=/.test(trimmed)) codeScore += 1
  if (/\bvar\s+\w+\s*=/.test(trimmed)) codeScore += 1
  if (/^\s{2,}.*[{};]$/m.test(trimmed)) codeScore += 1
  if (codeScore >= 2) {
    return { type: 'code' as ContentType, confidence: 0.7 }
  }

  return { type: 'text' as ContentType, confidence: 0.5 }
}
