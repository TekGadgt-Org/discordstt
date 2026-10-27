function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function commandConfig() {
  return {
    token: required('DISCORD_TOKEN'),
    clientId: required('DISCORD_CLIENT_ID'),
    guildId: process.env.DISCORD_GUILD_ID || null,
  };
}

function commandScope() {
  const scope = process.env.DISCORD_COMMAND_SCOPE || 'guild';
  if (scope !== 'guild' && scope !== 'global') throw new Error('DISCORD_COMMAND_SCOPE must be either guild or global');
  return scope;
}

module.exports = { commandConfig, commandScope };
