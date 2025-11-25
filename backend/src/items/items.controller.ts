import {
  Controller,
  DefaultValuePipe,
  Get,
  Header,
  Logger,
  ParseBoolPipe,
  ParseIntPipe,
  Query,
} from '@nestjs/common'
import { GetItemsDto } from './dto/get-items.dto'
import { ItemsService } from './items.service'

@Controller('items')
export class ItemsController {
  private readonly logger = new Logger(ItemsController.name);

  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  findAll(@Query() query: GetItemsDto) {
    // для дебага
    // this.logger.log(`GET /items client request: offset=${query.offset}, turbo=${query.turbo}`);
    
    return this.itemsService.findAll(query);
  }

  @Get('benchmark')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  benchmark(
    @Query('turbo', new DefaultValuePipe(false), ParseBoolPipe) turbo: boolean,
    @Query('count', new DefaultValuePipe(1000), ParseIntPipe) count: number,
    @Query('concurrency', new DefaultValuePipe(1), ParseIntPipe) concurrency: number,
  ) {
    // для дебага
    // this.logger.log(` BENCHMARK START: turbo=${turbo}, count=${count}, threads=${concurrency}`);
    return this.itemsService.benchmark(turbo, count, concurrency);
  }
}