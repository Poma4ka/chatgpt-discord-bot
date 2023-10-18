import { AppModule } from '../app-module';
import { GuildMember, Message } from 'discord.js';
import { ChatCompletionRequestMessage } from 'openai/api';
import { Config } from '../modules/config.module';

interface ActiveMessage {
    id: string;
    abort: AbortController;
}

export default class {
    private config: Config;
    private activeMessages: ActiveMessage[] = [];

    constructor(private appModule: AppModule) {
        this.config = this.appModule.configModule.getConfig();
        this.createMessageListener();
    }

    async createMessageListener() {
        this.appModule.discordModule
            .getClient()
            .on('messageCreate', this.onMessage.bind(this));
        this.appModule.discordModule
            .getClient()
            .on('messageUpdate', this.onMessageUpdate.bind(this));
        this.appModule.discordModule
            .getClient()
            .on('messageDelete', this.onMessageDelete.bind(this));
    }

    async onMessage(message: Message) {
        if (!message.content) {
            return;
        }

        if (message.reference) {
            const referenceMessage = await message.channel.messages.fetch(
                message.reference.messageId,
            );

            if (referenceMessage.author.id !== this.config.discord.clientID) {
                return;
            }
        } else if (
            !message.mentions.has(this.config.discord.clientID, {
                ignoreEveryone: true,
                ignoreRoles: true,
                ignoreRepliedUser: true,
            })
        ) {
            return;
        }

        const clearTyping = this.appModule.discordModule.sendTyping(
            message.channel,
        );

        const cleanMessage = this.cleanMessage(message);
        const user = await message.guild.members.cache.get(message.author.id);

        const username = this.getUsername(user, message);

        const history = await this.getHistory(
            message,
            this.config.openAI.max_tokens,
        );

        const abortController = new AbortController();

        this.activeMessages.push({
            abort: abortController,
            id: message.id,
        });

        const reply = await this.appModule.openAIModule.createChatCompletion(
            history,
            {
                content: cleanMessage,
                role: 'user',
                name: username,
            },
            {
                signal: abortController.signal,
            },
        );

        if (!abortController.signal.aborted) {
            if (reply.status) {
                if (reply.message.length > 2000) {
                    await message.reply({
                        files: [
                            this.appModule.discordModule.createAttachment(
                                reply.message,
                                'message.md',
                            ),
                        ],
                    });
                } else {
                    await message.reply({
                        content: reply.message
                            ? reply.message
                            : '```\n        \n```',
                    });
                }
            } else {
                await message.reply({
                    content: 'Что то я затупил, может быть пора отдохнуть...',
                });
            }
        }
        clearTyping();
    }

    async onMessageUpdate(message: Message) {
        this.activeMessages = this.activeMessages.filter(({ id, abort }) => {
            if (id === message.id) {
                abort.abort();
                this.onMessage(message);
            }
            return true;
        });
    }

    async onMessageDelete(message: Message) {
        this.activeMessages = this.activeMessages.filter(({ id, abort }) => {
            if (id === message.id) {
                abort.abort();
                return false;
            }
            return true;
        });
    }

    private async getHistory(
        message: Message,
        maxMessagesLength: number = 4096,
    ): Promise<ChatCompletionRequestMessage[]> {
        const result: ChatCompletionRequestMessage[] = [];

        await this.appModule.discordModule.getReferencesChain(
            message,
            async (message, br) => {
                if (maxMessagesLength <= 0) {
                    return br();
                }

                const cleanMessage = this.cleanMessage(message);

                if (maxMessagesLength - cleanMessage.length < 0) {
                    return br();
                }

                if (message.author.id === this.config.discord.clientID) {
                    result.unshift({
                        role: 'assistant',
                        content: cleanMessage,
                    });
                } else {
                    const user = await message.guild.members.cache.get(
                        message.author.id,
                    );

                    const username = this.getUsername(user, message);

                    result.unshift({
                        role: 'user',
                        content: cleanMessage,
                        name: username,
                    });
                }

                maxMessagesLength -= cleanMessage.length;
            },
        );

        return result;
    }

    private cleanMessage(message: Message): string {
        let clean = message.cleanContent;

        if (message.attachments) {
            const attachments = [];
            message.attachments.forEach((attachment) => {
                attachments.push(attachment.toJSON());
            });
            clean = `${clean}\n${JSON.stringify({ attachments })}`;
        }

        return clean.replace(/@/g, '');
    }

    private getUsername(user: GuildMember, message: Message) {
        const nick = (user?.nickname ?? message?.author?.username ?? '')
            .replaceAll(/(?!\w| )./g, '')
            .trim();

        return nick || 'UnknownAlien';
    }
}
