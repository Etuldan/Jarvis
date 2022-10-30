const winston = require('winston');
const { SeqTransport } = require('@datalust/winston-seq');

const fs = require('node:fs');
const path = require('node:path');
const { ButtonStyle, ButtonBuilder, ActionRowBuilder, Client, Events, Collection, GatewayIntentBits } = require('discord.js');
const { MongoClient, ObjectId } = require('mongodb');
const { discord, seq, mongo } = require('./config.json');
const { ButtonContract, ActionRowContract} = require('./models/buttonContract.js')

const clientMongo = new MongoClient(mongo.uri);

const client = new Client({ intents: [
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent,
	GatewayIntentBits.GuildMembers
] });

const logger = winston.createLogger({
	level: 'info',
	format: winston.format.combine(
	  winston.format.errors({ stack: true }),
	  winston.format.json(),
	),
	defaultMeta: { application: "DiscordBot" },
	transports: [
		new winston.transports.Console({
			format: winston.format.simple(),
		}),
	  	new SeqTransport({
			serverUrl: seq.uri,
			apiKey: seq.APIkey,
			onError: (e => { console.error(e) }),
			handleExceptions: true,
			handleRejections: true,
	  	})
	]
  });

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

client.commands = new Collection();
const taskLogger = logger.child({ activity: "commands" });
for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
		logger.info("Command register {name}", command.data);
	} else {
		logger.warn("The command at ${filePath} is missing a required 'data' or 'execute' property.");
	}
}

client.on('ready', () => {
	const taskLogger = logger.child({ activity: "login" });

	taskLogger.info("Logged in as {id} ...", client.user);
  	(async () => {
	try {
		await clientMongo.connect();
    	const database = clientMongo.db("discord-compta-bot");
		const contracts = database.collection("contracts");

		var cursor = contracts.find({ guild: 0, positive: true });
		var channel = client.channels.cache.find(channel => channel.id === "879302405928411186");
        await channel.bulkDelete(100)
			.catch(console.error);

		var row = new ActionRowContract();
		await cursor.forEach(function(contract) {
			var button = new ButtonContract(contract);
			//var button = new ButtonBuilder()
			//	.setCustomId(contract._id.toString())
			//	.setLabel(contract.name + " $" + contract.amount)
			//	.setStyle(ButtonStyle.Primary);
			//if(contract.paid == true) {
			//	button.setStyle(ButtonStyle.Success);
			//	button.setDisabled(true);
			//}
			row.addComponents(button);
		});
		try {
			if(row.components.length > 0) {
				var sent = channel.send({ components: [row] });
			}
		} catch (error) {
			taskLogger.error("Updating buttons failed for component {row}", row, error)
		}


		cursor = contracts.find({ guild: 0, positive: false });
		var channel = client.channels.cache.find(channel => channel.id === "879301542778380308");
        await channel.bulkDelete(100)
			.catch(console.error);

		var row = new ActionRowContract();
		await cursor.forEach(function(contract) {
			var button = new ButtonContract(contract);
			//var button = new ButtonBuilder()
			//	.setCustomId(contract._id.toString())
			//	.setLabel(contract.name + " $" + contract.amount)
			//	.setStyle(ButtonStyle.Primary);
			//if(contract.paid == true) {
			//	button.setStyle(ButtonStyle.Danger);
			//	button.setDisabled(true);
			//}
			row.addComponents(button);
		});
		try {
			if(row.components.length > 0) {
				var sent = channel.send({ components: [row] });
			}
		} catch (error) {
			taskLogger.error("Updating buttons failed for component {row}", row, error)
		}

	} finally {
		await clientMongo.close();
		taskLogger.info("{username} is ready !", client.user);
	}
  })();
});

client.on(Events.InteractionCreate, async interaction => {
	if (interaction.isChatInputCommand()) {
		const taskLogger = logger.child({ activity: "chatCommand" });

		const command = interaction.client.commands.get(interaction.commandName);
		if (!command) {
			taskLogger.error("No command matching ${interaction.commandName} was found.", interaction);
			return;
		}
	
		try {
			await command.execute(interaction);
		} catch (error) {
			taskLogger.error("There was an error while executing this command {interaction.commandName} : {error}", interaction, error);
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	};

	if(interaction.isButton()) {
		const taskLogger = logger.child({ activity: "button" });

		const collector = interaction.channel.createMessageComponentCollector({time: 15000 });
		collector.on('collect', async i => {
			try {
				await clientMongo.connect();
				const database = clientMongo.db("discord-compta-bot");
				const contracts = database.collection("contracts");

				let componentsActionRow =  i.message.components.map(oldActionRow => {
					let componentsButtons = oldActionRow.components.map(async(buttonComponent) => {
						const filter = { _id: ObjectId(buttonComponent.customId) };
						if(buttonComponent.customId == i.customId) {
							const updateDocument = { $set: { paid: true } };
							await contracts.updateOne(filter, updateDocument);
							console.log("Modify DB " + buttonComponent.customId);
						}
	
						var contract = await contracts.findOne(filter);
						const newButton = new ButtonContract(contract);
						console.log("Create Button " + buttonComponent.customId);
						return newButton;
					})

					updatedActionRow = new ActionRowBuilder();
					Promise.all(componentsButtons)
						.then(responses => responses.forEach(
							response => updatedActionRow.addComponents(response)
						));
				});
				Promise.all(componentsActionRow)
					.then(responses => responses.forEach(
						response => i.update({components: response})
					));

			} finally {
				//await clientMongo.close();
			}
		});
		collector.on('end', collected => console.log(`Collected ${collected.size} items`));
	}
});

client.login(discord.token);