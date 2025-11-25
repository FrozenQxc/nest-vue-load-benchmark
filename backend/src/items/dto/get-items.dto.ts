import { Transform } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, IsPositive, Min } from 'class-validator'

export class GetItemsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => Number(value))
  limit?: number = 50;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }) => Number(value))
  offset?: number = 0;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  turbo?: boolean = false;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Transform(({ value }) => Number(value))
  afterId?: number;
}