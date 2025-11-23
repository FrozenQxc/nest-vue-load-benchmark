import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { GetItemsDto } from './dto/get-items.dto'
import { Item } from './entities/item.entity'

@Injectable()
export class ItemsService implements OnModuleInit {
  private readonly logger = new Logger(ItemsService.name);

  constructor(
    @InjectRepository(Item)
    private itemsRepository: Repository<Item>,
  ) {}

  
  async onModuleInit() {
    await this.seedDatabase();
  }

  async seedDatabase() {
    const count = await this.itemsRepository.count();
    if (count > 0) {
      this.logger.log(`Database already has ${count} items. Skipping seed.`);
      return;
    }

    this.logger.log('Seeding database with 50,000 items...');
    const batchSize = 1000; // Вставляем пачками по 1000, чтобы не перегрузить память
    const totalItems = 50000;

    for (let i = 0; i < totalItems; i += batchSize) {
      const items = [];
      for (let j = 0; j < batchSize; j++) {
        items.push({
          name: `Item #${i + j + 1} - ${Math.random().toString(36).substring(7)}`,
          created_at: new Date(),  
        });
      }
 
      await this.itemsRepository.insert(items);
      this.logger.log(`Inserted items ${i} to ${i + batchSize}`);
    }
    this.logger.log('Seeding complete!');
  }

  async findAll(params: GetItemsDto) {
    const { limit, offset } = params;
    
  
    const [items, total] = await this.itemsRepository.findAndCount({
      take: limit,
      skip: offset,
      order: {
        id: 'ASC', 
      },
    });

    return {
      data: items,
      total,
      limit,
      offset,
    };
  }
}