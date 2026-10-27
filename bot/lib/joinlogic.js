const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');

module.exports = async (interaction) => {
  let connection = getVoiceConnection(interaction.guildId);
  await interaction.deferReply({ ephemeral: true });
  const member = interaction.member;
  if (!member?.voice?.channel) {
    await interaction.editReply('Join a voice channel and then try that again!');
    return null;
  }
  if (!connection) {
    const channel = member.voice.channel;
    connection = joinVoiceChannel({ channelId: channel.id, guildId: channel.guild.id, selfDeaf: false, selfMute: true, adapterCreator: channel.guild.voiceAdapterCreator });
  }
  await interaction.editReply('Joined!');
  return connection;
};
