import { GatewayIntentBits } from 'discord.js';
import { AppModule } from './app-module';

const app = new AppModule();

await app.init().then(() => console.log('Started'));
