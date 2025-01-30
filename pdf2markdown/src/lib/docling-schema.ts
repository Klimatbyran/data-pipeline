import { z } from 'zod'

export const BodyLabelSchema = z.enum(['list', 'unspecified'])
export const NameSchema = z.enum(['list', '_root_'])
export const CoordOriginSchema = z.enum(['BOTTOMLEFT'])

export const TextLabelSchema = z.enum([
  'caption',
  'list_item',
  'page_footer',
  'page_header',
  'paragraph',
  'section_header',
  'text',
])

export const MarkerSchema = z.enum(['-'])
export const ParentSchema = z.object({
  $ref: z.string(),
})

export const OriginSchema = z.object({
  mimetype: z.string(),
  binary_hash: z.number(),
  filename: z.string(),
})

export const SizeSchema = z.object({
  width: z.number(),
  height: z.number(),
})

export const BboxSchema = z.object({
  l: z.number(),
  t: z.number(),
  r: z.number(),
  b: z.number(),
  coord_origin: CoordOriginSchema,
})

export const ProvSchema = z.object({
  page_no: z.number(),
  bbox: BboxSchema,
  charspan: z.array(z.number()),
})

export const TextSchema = z.object({
  self_ref: z.string(),
  parent: ParentSchema,
  children: z.array(z.any()),
  label: TextLabelSchema,
  prov: z.array(ProvSchema),
  orig: z.string(),
  text: z.string(),
  level: z.number().optional(),
  enumerated: z.boolean().optional(),
  marker: MarkerSchema.optional(),
})

export const BodySchema = z.object({
  self_ref: z.string(),
  children: z.array(ParentSchema),
  name: NameSchema,
  label: BodyLabelSchema,
  parent: ParentSchema.optional(),
})

export const ImageSchema = z.object({
  mimetype: z.enum(['image/png']),
  dpi: z.number(),
  size: SizeSchema,
  uri: z.string(),
})
export type Image = z.infer<typeof ImageSchema>

export const PageSchema = z.object({
  size: SizeSchema,
  page_no: z.number(),
  image: ImageSchema.optional(),
})

export const TableCellSchema = z.object({
  bbox: BboxSchema.optional(),
  row_span: z.number(),
  col_span: z.number(),
  start_row_offset_idx: z.number(),
  end_row_offset_idx: z.number(),
  start_col_offset_idx: z.number(),
  end_col_offset_idx: z.number(),
  text: z.string(),
  column_header: z.boolean(),
  row_header: z.boolean(),
  row_section: z.boolean(),
})
export type Table = z.infer<typeof TableSchema>

export const DataSchema = z.object({
  table_cells: z.array(TableCellSchema),
  num_rows: z.number(),
  num_cols: z.number(),
  grid: z.array(z.array(TableCellSchema)),
})

export const PictureSchema = z.object({
  self_ref: z.string(),
  parent: ParentSchema,
  children: z.array(z.any()),
  label: z.enum(['picture']),
  prov: z.array(ProvSchema),
  captions: z.array(ParentSchema),
  references: z.array(z.any()),
  footnotes: z.array(z.any()),
  annotations: z.array(z.any()).optional(),
  data: DataSchema.optional(),
})

export const TableSchema = z.object({
  self_ref: z.string(),
  parent: ParentSchema,
  children: z.array(z.any()),
  label: z.enum(['table']),
  prov: z.array(ProvSchema),
  captions: z.array(ParentSchema),
  references: z.array(z.any()),
  footnotes: z.array(z.any()),
  annotations: z.array(z.any()).optional(),
  data: DataSchema.optional(),
})

export const DoclingDocumentSchema = z.object({
  schema_name: z.string(),
  version: z.string(),
  name: z.string(),
  origin: OriginSchema,
  furniture: BodySchema,
  body: BodySchema,
  groups: z.array(BodySchema),
  texts: z.array(TextSchema),
  pictures: z.array(PictureSchema),
  tables: z.array(TableSchema),
  key_value_items: z.array(z.any()),
  pages: z.record(z.string(), PageSchema),
})
export type DoclingDocument = z.infer<typeof DoclingDocumentSchema>
