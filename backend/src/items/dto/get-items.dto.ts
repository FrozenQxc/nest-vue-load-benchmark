import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'

export class GetItemsDto {
  @ApiPropertyOptional({ description: 'Количество записей (default: 50)', default: 50 })
  @IsOptional()
  @Type(() => Number)  
  @IsInt()
  @Min(1)
  @Max(1000)  
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Смещение (default: 0)', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}