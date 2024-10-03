import { Queue, QueueOptions } from 'bullmq'
import redis from '../config/redis'

const options: QueueOptions = {
  connection: redis,
  defaultJobOptions: { removeOnComplete: false },
}

const downloadPDF = new Queue('downloadPDF', options)
const pdf2Markdown = new Queue('pdf2Markdown', options)
const splitText = new Queue('splitText', options)
const indexParagraphs = new Queue('indexParagraphs', options)
const searchVectors = new Queue('searchVectors', options)
const guessWikidata = new Queue('guessWikidata', options)
const extractEmissions = new Queue('extractEmissions', options)
const reflectOnAnswer = new Queue('reflectOnAnswer', options)
const followUp = new Queue('followUp', options)
const format = new Queue('format', options)
const discordReview = new Queue('discordReview', options)
const includeFacit = new Queue('includeFacit', options)
const userFeedback = new Queue('userFeedback', options)

export {
  downloadPDF,
  pdf2Markdown,
  splitText,
  indexParagraphs,
  searchVectors,
  guessWikidata,
  extractEmissions,
  reflectOnAnswer,
  followUp,
  format,
  discordReview,
  includeFacit,
  userFeedback,
}
