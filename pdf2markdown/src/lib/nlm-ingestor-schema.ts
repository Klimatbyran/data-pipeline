import { z } from 'zod'

export const CellSchema = z.object({
  content: z.string(),
  bbox: z.array(z.number()),
  row_nums: z.array(z.number()),
  col_nums: z.array(z.number()),
})

export const ParagraphSchema = z.object({
  content: z.string().optional(),
  bbox: z.array(z.number()),
})

export const HeaderSchema = z.object({
  content: z.string().optional(),
  bbox: z.array(z.number()),
  level: z.number(),
})

export const ListItemSchema = z.object({
  content: z.string().optional(),
  bbox: z.array(z.number()),
  level: z.number(),
})

export const TableSchema = z.object({
  content: z.string().optional(),
  bbox: z.array(z.number()),
  rows: z.array(z.any()).optional(),
  level: z.number(),
})

export const BlockSchema = z.union([
  ParagraphSchema,
  HeaderSchema,
  ListItemSchema,
  TableSchema,
])

export const ParsedDocumentSchema = z.object({
  return_dict: z.object({
    result: z.object({
      blocks: z.array(BlockSchema),
    }),
    page_dim: z.array(z.number()),
    num_pages: z.number(),
  }),
})

export type Cell = z.infer<typeof CellSchema>
export type Paragraph = z.infer<typeof ParagraphSchema>
export type Header = z.infer<typeof HeaderSchema>
export type ListItem = z.infer<typeof ListItemSchema>
export type Table = z.infer<typeof TableSchema>
export type Block = z.infer<typeof BlockSchema>
export type ParsedDocument = z.infer<typeof ParsedDocumentSchema>
