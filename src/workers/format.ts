import { Worker, Job } from 'bullmq'
import redis from '../config/redis'
import prompt from '../prompts/format'
import { discordReview } from '../queues'
import discord from '../discord'
import { askStream } from '../openai'
import { findFacit } from '../lib/facit'

class JobData extends Job {
  declare data: {
    url: string
    json: string
    threadId: string
    pdfHash: string
    previousAnswer: string
    previousError: string
  }
}

const worker = new Worker(
  'format',
  async (job: JobData) => {
    const { json: previousJson, previousAnswer, previousError } = job.data

    const message = await discord.sendMessage(
      job.data,
      `🤖 Formaterar... ${job.attemptsStarted || ''}`
    )

    let progress = 0
    const response = await askStream(
      [
        {
          role: 'system',
          content:
            'You are an expert in CSRD reporting. Be accurate and follow the instructions carefully. Always reply with a JSON object.',
        },
        { role: 'user', content: prompt },
        previousError
          ? [
              { role: 'assistant', content: previousAnswer },
              { role: 'user', content: previousError },
            ]
          : [{ role: 'user', content: previousJson }],
        { role: 'user', content: 'Reply only with JSON' },
      ]
        .flat()
        .filter((m) => m?.content) as any[],
      {
        onParagraph: (response, paragraph) => {
          job.updateProgress(Math.min(100, (100 * progress++) / 10))
          job.log(paragraph)
        },
      }
    )

    let parsedJson
    try {
      job.log('Parsing JSON: \n\n' + response)
      const jsonMatch = response.match(/```json([\s\S]*?)```/)
      const json = jsonMatch?.length ? jsonMatch[1].trim() : response
      parsedJson = JSON.parse(json)
    } catch (error) {
      job.updateData({
        ...job.data,
        previousAnswer: response,
        previousError: 'Error when parsing json:' + error.message,
      })
      discord.sendMessage(job.data, `❌ ${error.message}:`)
      throw error
    }
    const companyName = parsedJson.companyName

    const facit = await findFacit(job.data.url, companyName)
    parsedJson = { ...parsedJson, facit } // overwrite the facit object and always use the correctly formatted one

    job.log(`Final JSON: 
${JSON.stringify(parsedJson, null, 2)}`)
    discordReview.add(companyName, {
      ...job.data,
      url: job.data.url || parsedJson.url,
      json: JSON.stringify(parsedJson, null, 2),
    })

    return JSON.stringify(parsedJson, null, 2)
  },
  {
    concurrency: 10,
    connection: redis,
  }
)

export default worker
