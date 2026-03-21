export type ContentType = 'markdown' | 'code' | 'html' | 'json' | 'yaml' | 'text'

export interface DetectResult { type: ContentType; confidence: number }

export interface ChunkMetadata {
  index: number
  startOffset: number
  endOffset: number
  tokenCount: number
  charCount: number
  contentType: ContentType
  headings: string[]
  codeLanguage?: string
  overlapBefore: number
  overlapAfter: number
}

export interface Chunk { content: string; metadata: ChunkMetadata }

export interface ChunkOptions {
  maxTokens?: number
  minTokens?: number
  overlap?: number
  contentType?: ContentType
  preserveStructure?: boolean
}

export interface Chunker {
  chunk(text: string, overrides?: Partial<ChunkOptions>): Chunk[]
  chunkMarkdown(text: string, options?: Partial<ChunkOptions>): Chunk[]
  chunkCode(text: string, options?: Partial<ChunkOptions>): Chunk[]
  chunkJSON(text: string, options?: Partial<ChunkOptions>): Chunk[]
  detectContentType(text: string): DetectResult
}
