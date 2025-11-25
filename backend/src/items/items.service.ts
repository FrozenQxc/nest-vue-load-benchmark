import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Cache } from 'cache-manager'
import pLimit from 'p-limit'
import { MoreThan, Repository } from 'typeorm'
import { GetItemsDto } from './dto/get-items.dto'
import { Item } from './entities/item.entity'

@Injectable()
export class ItemsService {
  private readonly logger = new Logger(ItemsService.name);

  constructor(
    @InjectRepository(Item)
    private readonly itemsRepo: Repository<Item>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  // Seed – 50 000 записей
  async onModuleInit() {
    await this.seedDatabase();
  }

  private async seedDatabase() {
    const cnt = await this.itemsRepo.count();
    if (cnt > 0) {
      this.logger.log(`Database already seeded (${cnt} rows)`);
      return;
    }

    this.logger.log('Seeding DB with 50 000 items...');
    const BATCH = 2000;
    const TOTAL = 50000;

    for (let i = 0; i < TOTAL; i += BATCH) {
      const batch = [];
      for (let j = 0; j < BATCH && i + j < TOTAL; j++) {
        batch.push({
          name: `Item #${i + j + 1} – ${Math.random()
            .toString(36)
            .substring(7)}`,
          created_at: new Date(),
        });
      }
      await this.itemsRepo.insert(batch);
      this.logger.log(`Inserted ${i + batch.length}/${TOTAL}`);
    }
    this.logger.log('✅ Seed complete');
  }

  // GET /items (с кэшированием)
  async findAll(dto: GetItemsDto) {
    const { limit = 50, offset = 0, turbo = false, afterId } = dto;

    // Ключ кэша учитывает limit/offset/afterId
    const cacheKey = `items_${limit}_${offset}_${afterId ?? 'none'}`;

    // Turbo (in‑memory)
    if (turbo) {
      const cached = await this.cache.get<any>(cacheKey);
      if (cached) {
        // Дебаг
        // this.logger.debug(`Cache hit: ${cacheKey}`);
        return cached;
      }
    }

    //  Запрос к БД 
    let items: Item[];
    let total: number;

    if (afterId) {
      // key‑set pagination
      [items, total] = await this.itemsRepo.findAndCount({
        where: { id: MoreThan(afterId) },
        order: { id: 'ASC' },
        take: limit,
      });
    } else {
      // обычный offset‑based
      [items, total] = await this.itemsRepo.findAndCount({
        skip: offset,
        take: limit,
        order: { id: 'ASC' },
      });
    }

    const result = { data: items, total, limit, offset, afterId };

    // ----------------- Сохранить в кэш -----------------
    if (turbo) {
      // ttl 10 000 ms = 10 сек (соответствует настройке CacheModule)
      await this.cache.set(cacheKey, result, 10_000);
    }

    return result;
  }

  // Benchmark (внутренний load‑generator)
  async benchmark(
    turbo: boolean,
    count = 1000,
    concurrency = 1,
  ): Promise<{
    requests: number;
    concurrency: number;
    duration: string;
    rps: number;
    turbo: boolean;
    message: string;
  }> {
    const start = performance.now();
    const limit = pLimit(concurrency);

    const tasks = Array.from({ length: count }).map(() => {
      const offset = Math.floor(Math.random() * 20);
      return limit(() => this.findAll({ limit: 50, offset, turbo }));
    });

    await Promise.allSettled(tasks);
    const end = performance.now();
    const durationMs = end - start;
    const rps = durationMs ? Math.round((count / durationMs) * 1000) : 0;

    return {
      requests: count,
      concurrency,
      duration: durationMs.toFixed(2),
      rps,
      turbo,
      message: turbo ? '🚀 Turbo (in‑memory cache)' : '🐌 Slow (DB only)',
    };
  }
}