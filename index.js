require('dotenv').config();
const { Client, IntentsBitField, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require('discord.js');
const { MongoClient } = require('mongodb');

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ],
});

// Підключення до бази даних MongoDB
const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;
const collectionName = process.env.COLLECTION_NAME;

const clientMongo = new MongoClient(uri);

client.on('ready', async () => {
    console.log('Connected to Discord!');

    try {
        await clientMongo.connect();
        console.log('Connected to MongoDB!');

        const database = clientMongo.db(dbName);
        client.db = database;
        console.log(`Using database: ${dbName}`);

        client.codesCollection = database.collection(collectionName);
        console.log(`Using collection: ${collectionName}`);
    } catch (error) {
        console.error(error);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.content !== 'ping') return;

    const getCodeButton = new ButtonBuilder()
        .setLabel('Get Code')
        .setStyle('Danger') // Змінив ButtonStyle.PRIMARY на 'PRIMARY'
        .setCustomId('get-code-button');

    const buttonRow = new ActionRowBuilder().addComponents(getCodeButton);

    const filter = () => true;

    const reply = await message.reply({ content: 'Click the button to get a code...', components: [buttonRow] });

    const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.BUTTON,
        filter,
    });

    collector.on('collect', async (interaction) => {
        if (interaction.customId === 'get-code-button') {
            const code = generateCode();
            try {
                await interaction.reply({ content: `Your code is: ${code}`, ephemeral: true });
                await client.codesCollection.insertOne({ username: interaction.user.username, code: code });
                console.log('Code saved to the database.');
                setTimeout(async () => {
                    try {
                        await client.codesCollection.deleteOne({ code: code });
                        console.log('Code expired and removed from the database.');
                    } catch (error) {
                        console.error('Error removing expired code from the database:', error);
                    }
                }, 5 * 60 * 1000); // 5 хвилин у мілісекундах
            } catch (error) {
                console.error('Error sending code or saving to the database:', error);
            }
        }
    });
});

// Function to generate a random code
function generateCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
}

client.login(process.env.TOKEN);
