import { Controller, Get, Query } from '@nestjs/common'
import { GetItemsDto } from './dto/get-items.dto'
import { ItemsService } from './items.service'

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  findAll(@Query() query: GetItemsDto) {
    return this.itemsService.findAll(query);
  }
}