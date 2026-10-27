const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const { TranscriptionManager } = require('../lib/transcription-manager');
const joinlogic = require('../lib/joinlogic');

const manager = new TranscriptionManager();

module.exports = {
  data: new SlashCommandBuilder().setName('transcribe').setDescription('Transcribes spoken words to messages in text chat.'),
  manager,
  async execute(interaction) {
    const joined = await joinlogic(interaction);
    if (!joined) return;
    const connection = getVoiceConnection(interaction.guildId);
    if (!connection) return;
    const label = interaction.member.nickname || interaction.user.tag;
    await manager.start({ guildId: interaction.guildId, userId: interaction.user.id, connection, channel: interaction.channel, label });
    await interaction.followUp({ content: 'Listening for speech.', ephemeral: true });
  }
};
