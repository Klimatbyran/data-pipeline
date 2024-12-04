import { DiscordJob, DiscordWorker } from '../lib/DiscordWorker'
import { apiFetch } from '../lib/api'
import { defaultMetadata } from '../lib/saveUtils'

export class JobData extends DiscordJob {
  declare data: DiscordJob['data'] & {
    companyName: string
    wikidata: any
    industry?: any
  }
}

const saveIndustry = new DiscordWorker<JobData>(
  'saveIndustry',
  async (job) => {
    const { url, wikidata, industry } = job.data
    const wikidataId = wikidata.node
    const metadata = defaultMetadata(url)

    if (industry) {
      job.editMessage(`🤖 Sparar branschdata...`)
      return await apiFetch(`/companies/${wikidataId}/industry`, {
        body: {
          industry,
          metadata,
        },
        method: 'POST',
      })
    }

    return null
  },
)

export default saveIndustry
