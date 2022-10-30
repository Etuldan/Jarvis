const { ButtonStyle, ButtonBuilder, ActionRowBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with Pong!'),
	async execute(interaction) {
		const row = new ActionRowBuilder()
		.addComponents(
			new ButtonBuilder()
				.setCustomId('primary')
				.setLabel('Click me!')
				.setStyle(ButtonStyle.Primary),
		);

		await interaction.reply({ content: 'I think you should,', components: [row] });
	},
};
