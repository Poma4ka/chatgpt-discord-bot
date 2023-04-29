import { AppModule } from '../app-module';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface Config {
    discord: {
        token: string;
        clientID: string;
    };
    openAI: {
        keys: string[];
        model: string;
        temperature?: number;
        max_tokens?: number;
        top_p?: number;
        frequency_penalty?: number;
        presence_penalty?: number;
    };
    completion: {
        botName: string;
        systemMessage: string;
    };
}

export default class {
    private CONFIG_PATH: string = path.resolve('', 'config');
    private CONFIG_NAME: string = 'config.yml';

    private config: Config;

    constructor(private appModule: AppModule) {}

    public async init() {
        this.config = this.mergeWithDefault(
            (await this.readConfig()) as Config,
        );
        await this.updateConfig((config) => this.mergeWithDefault(config));
    }

    public getConfig(): Config {
        return this.config;
    }

    public async updateConfig(change: (config: Config) => any) {
        await fs.mkdir(this.CONFIG_PATH, { recursive: true }).catch(() => null);

        change(this.config);

        const newBuffer = Buffer.from(yaml.dump(this.config));

        await fs.writeFile(
            path.resolve(this.CONFIG_PATH, this.CONFIG_NAME),
            newBuffer,
        );
    }

    private async readConfig() {
        return await fs
            .access(path.resolve(this.CONFIG_PATH, this.CONFIG_NAME))
            .then(async () => {
                const buffer = await fs.readFile(
                    path.resolve(this.CONFIG_PATH, this.CONFIG_NAME),
                    'utf8',
                );

                try {
                    return yaml.load(buffer.toString());
                } catch (e) {
                    console.error('Error while load config');
                }
            })
            .catch(async () => {
                const config = this.getDefaultConfig();
                const configBuffer = Buffer.from(yaml.dump(config));

                await fs
                    .mkdir(this.CONFIG_PATH, { recursive: true })
                    .catch(() => null);
                await fs.writeFile(
                    path.resolve(this.CONFIG_PATH, this.CONFIG_NAME),
                    configBuffer,
                );

                return config;
            });
    }

    private mergeWithDefault(config: Config): Config {
        const defaultConfig = this.getDefaultConfig();

        return {
            completion: {
                ...defaultConfig.completion,
                ...config?.completion,
            },
            openAI: {
                ...defaultConfig.openAI,
                ...config?.openAI,
            },
            discord: {
                ...defaultConfig.discord,
                ...config?.discord,
            },
        };
    }

    private getDefaultConfig(): Config {
        return {
            discord: {
                token: 'discord-bot-token',
                clientID: '123456789',
            },
            openAI: {
                keys: ['key1', 'key2'],
                model: 'gpt-3.5-turbo-0301',
                top_p: null,
                presence_penalty: null,
                frequency_penalty: 0.6,
                temperature: 0.6,
                max_tokens: 4096,
            },
            completion: {
                botName: 'bot',
                systemMessage: 'You are Chat-GPT.',
            },
        };
    }
}
