import {
  Block,
  ParsedDocument,
  Table,
  ParsedDocumentSchema,
} from './nlm-ingestor-schema'
import { fromBuffer } from 'pdf2pic'
import { openai } from './openai'

export async function extractTextViaVisionAPI(
  { imageBase64 }: { imageBase64: string },
  context: string,
) {
  const result = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a CSRD expert and will extract text from a PDF with extract from the tables.',
      },
      {
        role: 'user',
        content: `I have a PDF with couple of tables related to a company's CO2 emissions. Can you extract the text from screenshot? I will send you the screenshot extract the header and table contents and ignore the surrounding text if they are not related to the tables/graphs (such as header, description, footnotes or disclaimers). Use Markdown format for the table(s), only reply with markdown. OK?`,
      },
      {
        role: 'assistant',
        content:
          'Sure. Sounds good. Send the screenhot and I will extract the table(s) and return in markdown format as accurately as possible without any other comment.',
      },
      {
        role: 'assistant',
        content:
          // TODO: This prompt is tecnically incorrect, since we pass in a `context` which is the previous page that had tables
          // What we probably want to do here is to send the raw markdown parsed from the same page as the tables and screenshot.
          'This is previous text extracted with a less accurate method:' +
          context,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: imageBase64, detail: 'high' },
          },
        ],
      },
    ],
    // TODO: Why the max tokens here compared to the previous version of this function?
    max_tokens: 4096,
  })
  if (!result.choices[0]?.message?.content) {
    throw new Error(
      'Failed to get content from Vision API: ' + JSON.stringify(result),
    )
  }
  return result.choices[0].message.content
}

function parseTableBlock(block: Table): string {
  if (!block.rows || block.rows.length === 0) {
    return ''
  }

  // Convert table rows to markdown
  const rows = block.rows.map((row) => {
    return row.map((cell) => cell.content || '').join(' | ')
  })

  // Add header separator after first row
  if (rows.length > 0) {
    const headerSeparator = Array(rows[0].split('|').length)
      .fill('---')
      .join(' | ')
    rows.splice(1, 0, headerSeparator)
  }

  return rows.join('\n')
}

function parseHeaderBlock(block: Header): string {
  if (!block.content) return ''
  const level = Math.max(1, Math.min(6, block.level + 1)) // Ensure level is between 1-6
  return `${'#'.repeat(level)} ${block.content.trim()}`
}

function parseParagraphBlock(block: Paragraph): string {
  return block.content ? block.content.trim() : ''
}

function parseListItemBlock(block: ListItem): string {
  if (!block.content) return ''
  const indent = '  '.repeat(Math.max(0, block.level - 1))
  return `${indent}- ${block.content.trim()}`
}

export function jsonToTables(json: ParsedDocument): Table[] {
  return json.return_dict.result.blocks.filter(
    (block): block is Table => 'rows' in block,
  )
}

function parseBlock(block: Block): string {
  if ('rows' in block) {
    return parseTableBlock(block)
  } else if ('level' in block && 'content' in block) {
    return parseHeaderBlock(block as Header)
  } else if ('content' in block) {
    return parseParagraphBlock(block as Paragraph)
  }
  return ''
}

export async function jsonToMarkdown(
  json: ParsedDocument,
  pdf: Buffer,
): Promise<string> {
  try {
    // Validate input
    const result = ParsedDocumentSchema.parse(json)
    const blocks = result.return_dict.result.blocks

    if (!blocks || blocks.length === 0) {
      console.error('No blocks found in document')
      return 'No content found in document'
    }

    // Check if all blocks are empty
    const hasNonEmptyBlock = blocks.some((block) => {
      if ('content' in block && block.content) {
        return block.content.trim().length > 0
      }
      if ('rows' in block && block.rows) {
        return block.rows.length > 0
      }
      return false
    })

    if (!hasNonEmptyBlock) {
      console.error('All blocks are empty')
      console.error(
        'Block details:',
        blocks.map((block) => ({
          type:
            'rows' in block
              ? 'Table'
              : 'level' in block
                ? 'Header'
                : 'Paragraph',
          hasContent: Boolean(block.content),
          contentLength: block.content?.length || 0,
          hasRows: 'rows' in block ? Boolean(block.rows?.length) : 'N/A',
        })),
      )
      return 'Document contains only empty blocks. The PDF may be corrupted or protected.'
    }

    console.log('\n=== Processing Blocks ===')
    console.log(`Total blocks: ${blocks.length}`)
    blocks.forEach((block, index) => {
      console.log(`\nBlock ${index}:`)
      console.log(
        '- Type:',
        'rows' in block ? 'Table' : 'level' in block ? 'Header' : 'Paragraph',
      )
      console.log('- Content:', block.content)
      if ('rows' in block) {
        console.log('- Table rows:', block.rows?.length || 0)
      }
      if ('level' in block) {
        console.log('- Header level:', block.level)
      }
    })
    const [pageWidth, pageHeight] = json.return_dict.page_dim

    const markdownBlocks = await Promise.all(
      blocks.map(async (block: Block) => {
        console.log(
          `Processing block of type: ${
            'rows' in block
              ? 'Table'
              : 'level' in block
                ? 'Header'
                : 'Paragraph'
          }`,
        )

        if ('rows' in block) {
          // For tables, try direct parsing first
          const tableMarkdown = parseTableBlock(block)
          if (tableMarkdown && tableMarkdown.trim()) {
            return tableMarkdown
          }

          // TODO: Use already extracted page image instead

          // If direct parsing yields no content, fall back to Vision API
          const pageNumber = block.page_idx + 1
          const pdfConverter = fromBuffer(pdf, {
            density: 600,
            format: 'png',
            width: pageWidth * 2,
            height: pageHeight * 2,
            preserveAspectRatio: true,
          })

          const result = await pdfConverter(pageNumber, {
            responseType: 'buffer',
          })
          if (!result.buffer) {
            throw new Error(`Failed to convert page ${pageNumber} to image`)
          }

          // NOTE: block.content here refers to the current section in the document
          // TODO: Find a way to get the relevant markdown content from a given page when parsing the DoclingDocument JSON output
          // Then, we should pass this table data to the Vision API.
          return extractTextViaVisionAPI(
            { buffer: result.buffer },
            block.content || '',
          )
        }

        // For non-table blocks, use appropriate parser
        const parsedContent = parseBlock(block)
        if (parsedContent) {
          return parsedContent
        }

        console.log('Skipping empty block:', block)
        return null
      }),
    )

    const markdown = (await Promise.all(markdownBlocks))
      .filter((block) => block !== null && block !== '')
      .join('\n\n')

    if (!markdown.trim()) {
      console.error('No content was extracted from blocks')
      const blockSummary = blocks.map((block) => ({
        type:
          'rows' in block ? 'Table' : 'level' in block ? 'Header' : 'Paragraph',
        hasContent: Boolean(block.content),
        contentLength: block.content?.length || 0,
      }))
      console.error('Block summary:', JSON.stringify(blockSummary, null, 2))
      return 'No content could be extracted from document. Check server logs for details.'
    }

    return markdown
  } catch (error) {
    console.error('Error processing document:', error)
    throw new Error(`Failed to process document: ${error.message}`)
  }
}
