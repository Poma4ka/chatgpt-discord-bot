import { GatewayIntentBits } from 'discord.js';
import { AppModule } from './app-module';

const app = new AppModule();

app.init().then(() => console.log('Started'));
