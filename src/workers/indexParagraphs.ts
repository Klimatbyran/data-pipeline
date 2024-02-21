import { Worker, Job } from 'bullmq'
import redis from '../config/redis'
import { ChromaClient } from 'chromadb'
import { OpenAIEmbeddingFunction } from 'chromadb'
import { indexParagraphs, searchVectors } from '../queues'
import { cleanCollectionName } from '../lib/cleaners'
import chromadb from '../config/chromadb'
import openai from '../config/openai'
import discord from '../discord'
import { TextChannel } from 'discord.js'
import { getEncoding } from 'js-tiktoken'

class JobData extends Job {
  data: {
    paragraphs: string[]
    url: string,
    channelId: string
    messageId: string
  }
}

const worker = new Worker(
  'indexParagraphs',
  async (job: JobData) => {
    const client = new ChromaClient(chromadb)

    const paragraphs = job.data.paragraphs
    const url = job.data.url
    const channel = await discord.client.channels.fetch(job.data.channelId) as TextChannel
    const message = await channel.messages.fetch(job.data.messageId)
    await message.edit(`Sparar i vectordatabas...`)
    job.log('Indexing ' + paragraphs.length + ' paragraphs from url: ' + url)
    
    const encoding = getEncoding("cl100k_base")
    paragraphs.forEach((p, i) => {
      const tokens = encoding.encode(p).length
      const maxTokens = 8192 // FIXME how to fetch this properly?
      if (tokens > maxTokens) {
        throw new Error(`Paragraph ${i} has ${tokens} tokens, exceeding max limit of ${maxTokens} tokens.`);
      }
    })
    
    const embedder = new OpenAIEmbeddingFunction(openai)

    job.log(url)
    job.log(cleanCollectionName(url))

    const collection = await client.getOrCreateCollection({
      name: cleanCollectionName(url),
      embeddingFunction: embedder,
    })

    await Promise.all(
      paragraphs.map(async (p, i) => {
        job.log('Adding paragraph ' + i)
        await collection.add({
          ids: [job.data.url + '#' + i],
          metadatas: [
            {
              source: url,
              parsed: new Date().toISOString(),
              page: i,
            },
          ],
          documents: [p],
        })
        job.updateProgress(Math.floor(Math.min(1, i / paragraphs.length) * 100))
      })
    )

    await collection.add({
      ids: paragraphs.map((p, i) => job.data.url + '#' + i),
      metadatas: paragraphs.map((p, i) => ({
        source: url,
        parsed: new Date().toISOString(),
        page: i,
      })),
      documents: paragraphs.map((p) => p),
    })

    searchVectors.add('search ' + url, {
      url,
      channelId: job.data.channelId,
      messageId: job.data.messageId,
    })

    return paragraphs
  },
  {
    connection: redis,
    autorun: false,
  }
)

export default worker
