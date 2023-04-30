import { AppModule } from '../app-module';
import { Configuration, OpenAIApi } from 'openai';
import {
    ChatCompletionRequestMessage,
    CreateChatCompletionRequest,
} from 'openai/api';
import { AxiosError } from 'axios';
import * as console from 'console';
import { Config } from './config.module';

interface ChatCompletionOptions {
    signal?: AbortSignal;
}

export default class {
    private configuration: Configuration;
    private openAI: OpenAIApi;
    private config: Config;

    constructor(private appModule: AppModule) {
    }

    public async init(key?: string) {
        this.config = this.appModule.configModule.getConfig();

        if (!this.config.openAI.keys.length) {
            console.error('No free openAI keys');
        }

        this.configuration = new Configuration({
            apiKey: key ?? this.config.openAI.keys.at(0),
        });
        this.openAI = new OpenAIApi(this.configuration);
    }

    public async createChatCompletion(
        history: ChatCompletionRequestMessage[],
        message: ChatCompletionRequestMessage,
        options?: ChatCompletionOptions,
        attempt: number = 0,
    ): Promise<{ status: boolean; message?: string; aborted?: boolean }> {
        const { messages, max_tokens } = this.prepareChatCompletionMessages([
            {
                content: this.config.completion.systemMessage,
                role: 'system',
            },
            ...history,
            message,
        ]);

        const request: CreateChatCompletionRequest = {
            model: this.config.openAI.model,
            messages,
            max_tokens,
            temperature: this.config.openAI.temperature ?? undefined,
            top_p: this.config.openAI.top_p ?? undefined,
            frequency_penalty:
                this.config.openAI.frequency_penalty ?? undefined,
            presence_penalty: this.config.openAI.presence_penalty ?? undefined,
        };

        return this.openAI
            .createChatCompletion(request, {
                signal: options?.signal,
            })
            .then((response) => {
                if (typeof response === 'object' && 'data' in response) {
                    return {
                        status: true,
                        message: response.data.choices[0].message.content,
                    };
                } else {
                    return {
                        status: false,
                    };
                }
            })
            .catch((error) => {
                if (options?.signal?.aborted) {
                    return {
                        aborted: true,
                        status: false,
                    };
                }
                if (attempt >= 5) {
                    return {
                        status: false,
                    };
                }
                return this.onError(
                    error,
                    () =>
                        this.createChatCompletion(
                            history,
                            message,
                            options,
                            ++attempt,
                        ),
                    () => ({
                        status: false,
                    }),
                );
            });
    }

    private onError<T, E>(
        error: AxiosError<any>,
        retry: () => T,
        fail: () => E,
    ): Promise<T | E> {
        if (
            [
                'insufficient_quota',
                'access_terminated',
                'invalid_api_key',
            ].includes(error.response?.data?.error?.code)
        ) {
            console.log('Clear openAI key: ' + error.message);
            return this.resetOpenAIKey().then(() => retry());
        }

        if (error.response?.status === 429) {
            if (this.config.openAI.keys.length > 1) {
                const index = this.config.openAI.keys.indexOf(
                    this.configuration.apiKey as string,
                );
                console.log('Swap openAI key: ' + error.message);
                return this.init(
                    this.config.openAI.keys.at(
                        index + 1 > this.config.openAI.keys.length - 1
                            ? 0
                            : index + 1,
                    ),
                ).then(() => retry());
            }
        }

        console.error('Chat complete Error: ' + error, error);
        return Promise.resolve(fail());
    }

    private prepareChatCompletionMessages(
        messages: ChatCompletionRequestMessage[],
    ) {
        let messagesLength = this.getMessagesLength(messages);

        while (
            messages.length > 3 &&
            messagesLength > (this.config.openAI.max_tokens ?? 4096) * 0.75
            ) {
            messages.splice(1, 1);
            const newMessagesLength = this.getMessagesLength(messages);
            if (newMessagesLength !== messagesLength) {
                messagesLength = newMessagesLength;
            } else {
                break;
            }
        }

        const max_tokens: number =
            this.config.openAI.max_tokens - messagesLength;

        return { messages, max_tokens } as const;
    }

    private getMessagesLength(messages: ChatCompletionRequestMessage[]) {
        return messages.map((message) => message.content).join('').length;
    }

    private async resetOpenAIKey() {
        await this.appModule.configModule.updateConfig((config) => {
            config.openAI.keys = config.openAI.keys.filter((_, id) => id !== 0);
        });

        await this.init();
    }
}
