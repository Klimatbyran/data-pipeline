import { SlashCommandBuilder } from 'discord.js'
import { crawlURL } from '../queues'

export default {
  data: new SlashCommandBuilder()
    .setName('crawl')
    .addStringOption((option) =>
      option
        .setName('url')
        .setDescription('URL to crawl for sustainability pages')
        .setRequired(true)
    )
    .setDescription(
      'Skicka in en url, t ex www.skania.se och få tillbaka deras hållbarhetsrapport.'
    ),

  async execute(interaction) {
    console.log('crawl')
    const url = interaction.options.getString('url')
    if (!url) {
      await interaction.followUp({
        content: 'No url provided. Try again with /crawl <url>',
        ephemeral: true,
      })

      return
    }

    crawlURL.add('crawl url' + url.slice(-20), {
      url,
    })

    await interaction.reply('Tack! Nu är din URL placerad i min crawler-kö.')
  },
}
