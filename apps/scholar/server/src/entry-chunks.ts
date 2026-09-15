export const ENTRY_CHUNK_SIZE = 800;
export const ENTRY_CHUNK_OVERLAP = 120;

export interface EntryChunkSlice {
  content: string;
  charStart: number;
  charEnd: number;
}

export function splitEntryContent(content: string): EntryChunkSlice[] {
  if (!content) return [{ content: "", charStart: 0, charEnd: 0 }];
  const chunks: EntryChunkSlice[] = [];
  const step = ENTRY_CHUNK_SIZE - ENTRY_CHUNK_OVERLAP;
  for (let start = 0; start < content.length; start += step) {
    const end = Math.min(start + ENTRY_CHUNK_SIZE, content.length);
    chunks.push({ content: content.slice(start, end), charStart: start, charEnd: end });
    if (end === content.length) break;
  }
  return chunks;
}
