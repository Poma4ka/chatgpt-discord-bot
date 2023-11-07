import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDiscordClient, On, Once } from '@discord-nestjs/core';
import { Client, Message } from 'discord.js';
import { DiscordService } from './discord.service';

@Injectable()
export class DiscordGateway {
    private readonly logger: Logger = new Logger(DiscordGateway.name);

    constructor(
        @InjectDiscordClient()
        private readonly client: Client,
        @Inject(DiscordService)
        private discordBotService: DiscordService,
    ) {}

    @On('messageCreate')
    async onMessageCreate(message: Message) {
        if (
            !message.mentions.has(this.client.user.id, {
                ignoreEveryone: true,
                ignoreRoles: true,
                ignoreRepliedUser: false,
            })
        ) {
            return;
        }

        await this.discordBotService.createMessage(message);
    }

    @On('messageUpdate')
    async onMessageUpdate(message: Message) {
        await this.discordBotService.updateMessage(message);
    }

    @On('messageDelete')
    async onMessageDelete(message: Message) {
        await this.discordBotService.deleteMessage(message);
    }

    @Once('ready')
    async onReady() {
        this.logger.log(`Discord bot ${this.client.user.tag} was started!`);
    }
}
