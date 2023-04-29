import { AppModule } from '../app-module';
import { createClient } from 'redis';
import { RedisClientType as _RedisClientType } from '@redis/client/dist/lib/client';
import { Config } from './config.module';

export default class {
    private client: _RedisClientType;
    private config: Config;

    constructor(private appModule: AppModule) {}

    public async init() {
        this.config = this.appModule.configModule.getConfig();
        this.client = await createClient({
            url: this.config.redis.url,
        });

        this.client.on('error', (err) =>
            console.log('Redis Client Error', err),
        );

        await this.client.connect();
    }

    async get<T extends object>(
        key: string,
        deserialize: boolean = true,
    ): Promise<T> {
        if (this.client.isReady) {
            const value = await this.client
                .get(this.getKeyName(key))
                .catch(() => null);
            if (deserialize) {
                return this.deserialize(value);
            }

            return value;
        }
        return null;
    }

    async set<T extends object>(key: string, value: T, expirationMS?: number) {
        if (this.client.isReady) {
            return this.client
                .set(this.getKeyName(key), this.serialize(value), {
                    PX: expirationMS,
                })
                .catch(() => null);
        }
    }

    async del(...keys: string[]) {
        if (this.client.isReady) {
            return this.client
                .del(keys.map((key) => this.getKeyName(key)))
                .catch(() => null);
        }
    }

    private serialize(value: any) {
        if ([null, undefined].includes(value)) {
            return value;
        }

        if (value instanceof Object) {
            return JSON.stringify(value);
        }
        return value.toString();
    }

    private deserialize(value: string) {
        if ([null, undefined].includes(value)) {
            return value;
        }

        try {
            return JSON.parse(value);
        } catch (e) {
            return value;
        }
    }

    private getKeyName(key: string) {
        return (
            (this.config.redis.prefix ? this.config.redis.prefix + ':' : '') +
            key
        );
    }
}
