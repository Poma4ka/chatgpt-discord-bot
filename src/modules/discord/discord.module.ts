import { Module } from '@nestjs/common';
import { DiscordService } from './discord.service';
import { DiscordModule as NestjsDiscordModule } from '@discord-nestjs/core';
import { DiscordGateway } from './discord.gateway';
import { GatewayIntentBits, Partials } from 'discord.js';
import { OpenaiModule } from '../openai/openai.module';

@Module({
    imports: [
        NestjsDiscordModule.forRootAsync({
            useFactory: () => ({
                token: process.env.DISCORD_BOT_TOKEN,
                discordClientOptions: {
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
                },
                failOnLogin: true,
                autoLogin: true,
                shutdownOnAppDestroy: true,
            }),
        }),
        OpenaiModule.forFeature(),
    ],
    providers: [DiscordService, DiscordGateway],
})
export class DiscordModule {}
