import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app-module';
import { AppLogger } from './common/logger';

const bootstrap = async () => {
    await NestFactory.createApplicationContext(AppModule, {
        logger: new AppLogger(process.env.LOG_LEVEL),
        abortOnError: true,
    });
};

bootstrap();
