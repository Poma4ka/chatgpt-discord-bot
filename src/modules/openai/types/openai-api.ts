import OpenAI from 'openai';

export type OpenaiApi = <T>(apiCall: (api: OpenAI) => T) => T;
