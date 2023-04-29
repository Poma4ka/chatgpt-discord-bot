import { AppModule } from '../app-module';
import { Config } from './config.module';
import {
    AttachmentBuilder,
    Client,
    GatewayIntentBits,
    Message,
    Partials,
    REST,
    TextBasedChannel,
} from 'discord.js';

export default class {
    private client: Client;
    private rest: REST;
    private config: Config;

    constructor(private appModule: AppModule) {}

    public async init() {
        this.config = this.appModule.configModule.getConfig();
        await this.createRest();
        await this.createClient();
    }

    private async createRest() {
        this.rest = new REST({ version: '10' }).setToken(
            this.config.discord.token,
        );
    }

    public getClient() {
        return this.client;
    }

    public getRest() {
        return this.rest;
    }

    private async createClient() {
        return new Promise((resolve) => {
            this.client = new Client({
                intents: [
                    GatewayIntentBits.Guilds,
                    GatewayIntentBits.GuildMessages,
                    GatewayIntentBits.GuildIntegrations,
                    GatewayIntentBits.DirectMessages,
                    GatewayIntentBits.DirectMessageTyping,
                    GatewayIntentBits.MessageContent,
                ],
                partials: [
                    Partials.Channel,
                    Partials.Channel,
                    Partials.Reaction,
                ],
            });

            this.client.on('ready', () => {
                console.log(`Logged in as ${this.client.user.tag}!`);
                resolve(null);
            });
            this.client.login(this.config.discord.token);
        });
    }

    public async getReferencesChain(
        message: Message,
        callback: (message: Message, br: () => void) => void,
    ) {
        message = message.reference
            ? await message.fetchReference()
            : undefined;

        while (message) {
            await callback(message, () => (message = null));
            message = message?.reference
                ? await message.fetchReference()
                : undefined;
        }
    }

    public createAttachment(content: string, name: string) {
        const attachment = new AttachmentBuilder(Buffer.from(content));
        attachment.setName(name);
        return attachment;
    }

    public sendTyping(channel: TextBasedChannel): () => void {
        channel.sendTyping();
        const interval = setInterval(() => {
            channel.sendTyping();
        }, 10000);

        return () => clearInterval(interval);
    }
}
