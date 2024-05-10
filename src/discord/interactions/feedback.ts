import {
  ActionRowBuilder,
  ButtonInteraction,
  CommandInteraction,
  Interaction,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js'
import { userFeedback } from '../../queues'

export default {
  async execute(interaction: ButtonInteraction, job) {
    const input = new TextInputBuilder()
      .setCustomId('editInput')
      .setLabel(`Granska utsläppsdata`)
      .setStyle(TextInputStyle.Paragraph)

    const actionRow =
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        input
      )

    const modal = new ModalBuilder()
      .setCustomId('editModal')
      .setTitle(`Granska data för...`) // ${parsedJson.companyName}`)
      .addComponents(actionRow)

    await interaction.showModal(modal)

    const submitted = await interaction
      .awaitModalSubmit({
        time: 60000 * 20, // user has to submit the modal within 20 minutes
        filter: (i) => i.user.id === interaction.user.id, // only user who clicked button can interact with modal
      })
      .catch((error) => {
        console.error(error)
        return null
      })

    if (submitted) {
      const userInput = submitted.fields.getTextInputValue('editInput')

      await submitted.reply({
        content: 'Thanks for your feedback:',
      })

      interaction.channel?.sendTyping()
      //submitted.deferUpdate()
      await userFeedback.add(
        'userFeedback',
        {
          ...job.data,
          feedback: userInput,
        },
        {
          attempts: 3, // pröva tre gånger
        }
      )
    }
  },
}
