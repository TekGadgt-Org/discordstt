const { REST, Routes } = require('discord.js');
const fs = require('node:fs');

const { DISCORD_TOKEN: token, DISCORD_CLIENT_ID: clientId, DISCORD_GUILD_ID: guildId } = process.env;
if (!token || !clientId || !guildId) throw new Error('DISCORD_TOKEN, DISCORD_CLIENT_ID, and DISCORD_GUILD_ID are required');
const commands = fs.readdirSync('./commands').filter((file) => file.endsWith('.js')).map((file) => require(`./commands/${file}`).data.toJSON());
const rest = new REST({ version: '10' }).setToken(token);
(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);
    const data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) { console.error(error); process.exitCode = 1; }
})();
