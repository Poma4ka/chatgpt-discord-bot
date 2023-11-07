import { Inject, Injectable, Logger } from '@nestjs/common';
import {
    AttachmentBuilder,
    BaseMessageOptions,
    Message,
    TextBasedChannel,
} from 'discord.js';
import { OpenaiChatService } from '../openai/openai-chat.service';
import axios from 'axios';

@Injectable()
export class DiscordService {
    private readonly logger: Logger = new Logger(DiscordService.name);

    private readonly messages: Map<string, AbortController> = new Map();

    constructor(
        @Inject(OpenaiChatService)
        private openaiChatService: OpenaiChatService,
    ) {}

    async createMessage(message: Message): Promise<void> {
        const abortController = new AbortController();
        const { signal } = abortController;

        this.messages.set(message.id, abortController);

        const [abortTyping] = this.sendTyping(message.channel);

        try {
            const messageText = await this.getTextFromMessage(message);

            const result = await this.openaiChatService.createCompletion(
                {
                    content: messageText,
                    role: 'user',
                },
                [],
                {
                    signal,
                },
            );

            let content = '';

            let isReplying: boolean = false;
            let reply: Message;

            await result.forEach((value) => {
                if (signal.aborted) {
                    return;
                }

                content = `${content}${value}`;

                if (content) {
                    if (!isReplying) {
                        isReplying = true;

                        this.replyMessage(message, content, reply).then(
                            (message) => {
                                reply = message;
                                isReplying = false;
                            },
                        );
                    }
                }
            });

            if (signal.aborted) {
                return;
            }

            await this.replyMessage(message, content, reply);
        } catch (error) {
            this.logError(error);
            await message
                .reply({
                    content: 'Что-то я запутил, может пора отдохнуть...',
                })
                .catch(() => null);
        } finally {
            abortTyping();

            if (!signal.aborted) {
                this.messages.delete(message.id);
            }
        }
    }

    async updateMessage(message: Message): Promise<void> {
        if (this.messages.has(message.id)) {
            this.messages.get(message.id).abort();

            this.messages.delete(message.id);
            await this.createMessage(message);
        }
    }

    async deleteMessage(message: Message): Promise<void> {
        if (this.messages.has(message.id)) {
            this.messages.get(message.id).abort();

            this.messages.delete(message.id);
        }
    }

    sendTyping(channel: TextBasedChannel): [abort: () => void] {
        channel.sendTyping().catch(() => null);
        const interval = setInterval(() => {
            channel.sendTyping().catch(() => null);
        }, 10000);

        return [() => clearInterval(interval)];
    }

    getAuthor(message: Message): string {
        const defaultNick: string = 'Unknown Alien';

        try {
            const user = message.guild.members.cache.get(message.author.id);

            return (
                user.nickname ||
                message.author.displayName ||
                message.author.username
            );
        } catch (error: unknown) {
            this.logError(error);
            return defaultNick;
        }
    }

    private logError(error: unknown): void {
        if (error instanceof Error) {
            this.logger.error(error.message, error.stack);
        } else {
            this.logger.error('Unknown error', error);
        }
    }

    private async replyMessage(
        message: Message,
        content: string,
        reply?: Message,
    ): Promise<Message> {
        const payload: BaseMessageOptions =
            content.length > 2000
                ? {
                      files: [
                          await this.createTextAttachment(
                              content,
                              'message.md',
                          ),
                      ],
                      content: '',
                  }
                : {
                      content,
                  };

        if (content)
            if (reply) {
                return await reply.edit(payload);
            } else {
                return await message.reply(payload);
            }
    }

    private async createTextAttachment(content: string, name: string) {
        const attachment = new AttachmentBuilder(Buffer.from(content));
        attachment.setName(name);
        return attachment;
    }

    private async getTextFromMessage(message: Message): Promise<string> {
        let clean = `My name is ${this.getAuthor(
            message,
        )}\n${message.cleanContent.replace(/@/g, '')}`;

        if (message.attachments) {
            for (const [_, attachment] of message.attachments) {
                try {
                    if (
                        !['text', 'application'].includes(
                            attachment.contentType.split('/').at(0),
                        )
                    ) {
                        return;
                    }

                    if (attachment.size > 1024_00) {
                        return;
                    }

                    const content = await axios
                        .get(attachment.url, {
                            responseType: 'text',
                        })
                        .then((r) => r.data);

                    clean = `${clean}\nAttachment ${attachment.name}:\n===START===\n${content}\n===END===`;
                } catch (error) {
                    this.logError(error);
                }
            }
        }

        return clean;
    }
}
