import {
    ConsoleLogger,
    Injectable,
    LoggerService,
    LogLevel,
} from '@nestjs/common';

const LogLevels: { [key in LogLevel]: number } = {
    fatal: 0,
    error: 1,
    warn: 2,
    log: 3,
    verbose: 4,
    debug: 5,
};

@Injectable()
export class AppLogger extends ConsoleLogger implements LoggerService {
    constructor(readonly level: LogLevel | string = 'log') {
        super();
        this.setLogLevels(this.getLogLevels(level));
    }

    private getLogLevels(level?: LogLevel | string): LogLevel[] {
        if (!level || !Object.keys(LogLevels).includes(level)) {
            level = 'log';
        }

        return Object.keys(LogLevels).filter(
            (key) => LogLevels[key] <= LogLevels[level],
        ) as LogLevel[];
    }
}
