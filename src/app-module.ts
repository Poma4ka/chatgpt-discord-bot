import { Module } from '@nestjs/common';
import { DiscordModule } from './modules/discord/discord.module';
import { OpenaiModule } from './modules/openai/openai.module';
import { resolve } from 'path';

@Module({
    imports: [
        OpenaiModule.forRoot({
            api: {
                apiKey: process.env.OPENAI_API_KEY,
                apiKeysFile: process.env.OPENAI_API_KEYS_FILE
                    ? resolve(process.env.OPENAI_API_KEYS_FILE)
                    : null,
            },
            chat: {
                systemMessage: process.env.CHATGPT_SYSTEM_MESSAGE,
                model: process.env.CHATGPT_MODEL,
                maxTokens: Number(process.env.CHATGPT_MAX_TOKENS),
                frequencyPenalty:
                    Number(process.env.CHATGPT_FREQUENCY_PENALTY) || undefined,
                presencePenalty:
                    Number(process.env.CHATGPT_PRESENCE_PENALTY) || undefined,
                topP: Number(process.env.CHATGPT_TOP_P) || undefined,
                temperature:
                    Number(process.env.CHATGPT_TEMPERATURE) || undefined,
                useStream: Boolean(process.env.CHATGPT_USE_STREAM),
            },
        }),
        DiscordModule,
    ],
})
export class AppModule {}
