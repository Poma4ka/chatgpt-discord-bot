import { DynamicModule, Logger, Module, Provider } from '@nestjs/common';
import { OpenaiChatService } from './openai-chat.service';
import {
    OPENAI_API,
    OPENAI_API_OPTIONS,
    OPENAI_CHAT_OPTIONS,
} from './constants';
import { OpenaiApi } from './types';
import OpenAI, { APIError, OpenAIError } from 'openai';
import { readFile, writeFile } from 'fs/promises';

export interface OpenaiModuleOptions {
    api: {
        apiKey?: string;
        apiKeysFile?: string;
    };
    chat?: {
        systemMessage?: string;
        model: string;
        maxTokens: number;
        temperature?: number;
        topP?: number;
        frequencyPenalty?: number;
        presencePenalty?: number;
        useStream?: boolean;
    };
}

@Module({})
export class OpenaiModule {
    private static logger: Logger = new Logger(OpenaiModule.name);

    private static options: OpenaiModuleOptions;

    static forRoot(options: OpenaiModuleOptions): DynamicModule {
        this.options = options;
        const providers = this.getProviders();

        return {
            module: OpenaiModule,
            providers,
            exports: providers,
        };
    }

    static forFeature(): DynamicModule {
        const providers = this.getProviders();

        return {
            module: OpenaiModule,
            providers,
            exports: providers,
        };
    }

    private static getProviders(): Provider[] {
        return [
            OpenaiChatService,

            {
                provide: OPENAI_API_OPTIONS,
                useFactory: () => this.options.api,
            },
            {
                provide: OPENAI_CHAT_OPTIONS,
                useFactory: () => this.options.chat ?? {},
            },
            {
                provide: OPENAI_API,
                inject: [OPENAI_API_OPTIONS],
                useFactory: (options: OpenaiModuleOptions['api']) =>
                    this.createOpenaiApi(options),
            },
        ];
    }

    private static async createOpenaiApi(
        options: OpenaiModuleOptions['api'],
    ): Promise<OpenaiApi> {
        const openaiApi = new OpenAI();

        const resetApiKey = async (removePrevious: boolean = false) => {
            if (options.apiKeysFile) {
                const keysString = await readFile(options.apiKeysFile).then(
                    String,
                );

                let keys = keysString.split(/\r\n|\n/).filter(Boolean);

                const index = keys.indexOf(openaiApi.apiKey);

                if (removePrevious || index !== -1) {
                    keys = keys.filter((_, i) => i !== index);

                    await writeFile(options.apiKeysFile, keys.join('\n'));

                    this.logger.warn(
                        `Openai API key "${this.maskApiKey(
                            openaiApi.apiKey,
                        )}" removed from file`,
                    );
                }

                openaiApi.apiKey = keys[index + 1] || keys[0];

                if (!openaiApi.apiKey) {
                    throw new OpenAIError('No free Openai API keys');
                }

                this.logger.log(
                    `New Openai API key selected: ${this.maskApiKey(
                        openaiApi.apiKey,
                    )}`,
                );
            } else {
                openaiApi.apiKey = options.apiKey;
            }
        };

        await resetApiKey(false);

        return (api) => {
            const request = (attempt = 1) => {
                if (!openaiApi.apiKey) {
                    throw new OpenAIError('API key not found');
                }

                const res = api(openaiApi);

                if (res instanceof Promise) {
                    return res.catch(
                        async (error: (typeof APIError)['prototype']) => {
                            if (
                                [
                                    'insufficient_quota',
                                    'access_terminated',
                                    'invalid_api_key',
                                ].includes(error.code)
                            ) {
                                await resetApiKey(true);
                                return request(attempt + 1);
                            }

                            if (error.status === 429) {
                                await resetApiKey(false);

                                if (attempt === 5) {
                                    throw error;
                                }
                                return request(attempt + 1);
                            }

                            throw error;
                        },
                    ) as any;
                } else {
                    return res;
                }
            };

            return request();
        };
    }

    private static maskApiKey(key: string) {
        return `*****************************${key.slice(
            Math.floor(key.length * 0.8),
        )}`;
    }
}
