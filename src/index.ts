// chunk-smart - Structure-aware text chunker for RAG pipelines
export { chunk, createChunker } from './chunker'
export { detectContentType } from './detect'
export type {
  ContentType,
  DetectResult,
  ChunkMetadata,
  Chunk,
  ChunkOptions,
  Chunker,
} from './types'
