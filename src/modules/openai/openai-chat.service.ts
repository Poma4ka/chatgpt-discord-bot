import { Inject, Injectable, Logger } from '@nestjs/common';
import { OPENAI_API, OPENAI_CHAT_OPTIONS } from './constants';
import { OpenaiModuleOptions } from './openai.module';
import { OpenaiApi } from './types';
import {
    ChatCompletionAssistantMessageParam,
    ChatCompletionMessageParam,
    ChatCompletionUserMessageParam,
} from 'openai/src/resources/chat/completions';
import { from, map, Observable, of } from 'rxjs';
import OpenAI from 'openai';

interface ChatCompletionOptions {
    signal?: AbortSignal;
}
const isChatCompletion = (value: any): value is OpenAI.ChatCompletion =>
    value['object'] === 'chat.completion';

@Injectable()
export class OpenaiChatService {
    private logger: Logger = new Logger(OpenaiChatService.name);

    constructor(
        @Inject(OPENAI_API)
        private getApi: OpenaiApi,
        @Inject(OPENAI_CHAT_OPTIONS)
        private chatOptions: OpenaiModuleOptions['chat'],
    ) {}

    async createCompletion(
        message: ChatCompletionUserMessageParam,
        history: (
            | ChatCompletionAssistantMessageParam
            | ChatCompletionUserMessageParam
        )[] = [],
        options?: ChatCompletionOptions,
    ): Promise<Observable<string>> {
        const { messages, max_tokens } = this.prepareMessages([
            {
                role: 'system',
                content: this.chatOptions.systemMessage,
            },
            ...history,
            message,
        ]);

        this.logger.log(
            `Creating chat completion for: ${messages
                .at(-1)
                .content.slice(0, 100)}...`,
        );

        return this.getApi((api) =>
            api.chat.completions.create(
                {
                    messages,
                    model: this.chatOptions.model,
                    n: 1,
                    max_tokens,
                    top_p: this.chatOptions.topP,
                    frequency_penalty: this.chatOptions.frequencyPenalty,
                    presence_penalty: this.chatOptions.presencePenalty,
                    temperature: this.chatOptions.temperature,
                    stream: this.chatOptions.useStream,
                },
                {
                    signal: options.signal,
                },
            ),
        ).then(async (response) => {
            if (isChatCompletion(response)) {
                return of(response.choices[0].message.content);
            }

            return from(response).pipe(
                map((chunk) => chunk.choices[0].delta.content || ''),
            );
        });
    }

    private prepareMessages(messages: ChatCompletionMessageParam[]) {
        const maxTokens = Math.max(this.chatOptions.maxTokens, 1024);

        let messagesLength = this.getMessagesLength(messages);

        while (messages.length > 2 && messagesLength > maxTokens - 512) {
            messages.splice(1, 1);
            messagesLength = this.getMessagesLength(messages);
        }

        if (messagesLength > maxTokens - 512) {
            messages[1].content = messages[1].content.slice(maxTokens - 512);
        }

        const max_tokens: number = this.chatOptions.maxTokens - messagesLength;

        return { messages, max_tokens } as const;
    }

    private getMessagesLength(messages: ChatCompletionMessageParam[]) {
        return messages.map((message) => message.content).join('').length;
    }
}
