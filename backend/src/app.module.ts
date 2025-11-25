import { CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import * as Joi from 'joi'
import { Item } from './items/entities/item.entity'
import { ItemsModule } from './items/items.module'

@Module({
  imports: [
    // ----------------- Config -----------------
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().default(3000),
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(5432),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_DATABASE: Joi.string().required(),
      }),
    }),

    // ----------------- In‑memory Cache -----------------
    // ttl – 10 сек (по‑умолчанию), max – 1000 записей в кеше
    CacheModule.register({
      isGlobal: true,
      ttl: 10,          // seconds
      max: 1000,        // max items
    }),

    // ----------------- TypeORM (PostgreSQL) -----------------
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get<string>('DB_HOST'),
        port: cfg.get<number>('DB_PORT'),
        username: cfg.get<string>('DB_USERNAME'),
        password: cfg.get<string>('DB_PASSWORD'),
        database: cfg.get<string>('DB_DATABASE'),
        entities: [Item],
        synchronize: true, // в продакшн замените миграциями
        logging: false,
        dropSchema: true,
        extra: {
          max: 20, // одновременно открытых соединений к PostgreSQL
        },
      }),
    }),

    ItemsModule,
  ],
})
export class AppModule {}