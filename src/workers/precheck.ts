import { FlowProducer } from 'bullmq'
import redis from '../config/redis'
import wikidata from '../prompts/wikidata'
import fiscalYear from '../prompts/fiscalYear'
import { askPrompt } from '../openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { DiscordJob, DiscordWorker } from '../lib/DiscordWorker'

class JobData extends DiscordJob {
  declare data: DiscordJob['data'] & {
    paragraphs: string[]
    companyName?: string
  }
}

const flow = new FlowProducer({ connection: redis })

const worker = new DiscordWorker('precheck', async (job: JobData) => {
  const { paragraphs, ...baseData } = job.data

  // IDEA: Maybe ask for name and description at the same time when we have the full context?

  const companyName = await askPrompt(
    'What is the name of the company? Respond only with the company name. We will search Wikidata after this name. The following is an extract from a PDF:',
    paragraphs.join('-------------PDF EXTRACT-------------------\n\n')
  )

  job.log('Company name: ' + companyName)
  job.setThreadName(companyName)

  const base = {
    queueName: 'followUp',
    data: { ...baseData, companyName },
    opts: {
      attempts: 3,
    },
  }

  job.sendMessage(`🤖 Ställer frågor om basfakta...`)

  await flow.add({
    name: 'precheck done ' + companyName,
    queueName: 'extractEmissions', // this is where the result from the children will be sent
    data: { ...base.data },
    children: [
      {
        ...base,
        name: 'guesswikidata ' + companyName,
        queueName: 'guessWikidata',
        data: {
          ...base.data,
          schema: zodResponseFormat(wikidata.schema, 'wikidata'),
        },
      },
      {
        ...base,
        name: 'fiscalYear ' + companyName,
        data: {
          ...base.data,
          prompt: fiscalYear.prompt,
          schema: zodResponseFormat(fiscalYear.schema, 'fiscalYear'),
        },
      },
    ],
    opts: {
      attempts: 3,
    },
  })
})

export default worker
