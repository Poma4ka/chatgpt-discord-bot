import ConfigModule from './modules/config.module';
import OpenaiModule from './modules/openai-module';
import DiscordModule from './modules/discord.module';
import CacheModule from './modules/cache.module';
import RuntimeController from './controllers/runtime.controller';

export class AppModule {
    public configModule: ConfigModule;
    public openAIModule: OpenaiModule;
    public discordModule: DiscordModule;
    public cacheModule: CacheModule;

    private runtimeController: RuntimeController;

    constructor() {}

    public async init() {
        this.configModule = new ConfigModule(this);
        this.openAIModule = new OpenaiModule(this);
        this.discordModule = new DiscordModule(this);
        this.cacheModule = new CacheModule(this);

        await this.configModule.init();
        await this.openAIModule.init();
        await this.discordModule.init();
        // await this.cacheModule.init();

        this.runtimeController = new RuntimeController(this);
    }
}
