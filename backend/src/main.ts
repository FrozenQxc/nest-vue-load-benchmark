import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

 
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  
  // CORS  
  app.enableCors();

  // Настройка Swagger
  const config = new DocumentBuilder()
    .setTitle('Highload Benchmark API')
    .setDescription('API for load testing')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT || 3000, '0.0.0.0');

  const url = await app.getUrl();
  console.log(`Application is running on: ${url}`);
  console.log(`Swagger is running on: ${url}/api/docs`);
}
bootstrap();