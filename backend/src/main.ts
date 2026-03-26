import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Global validation pipe with whitelist and forbidNonWhitelisted
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    disableErrorMessages: false, // For development; set true in prod
    exceptionFactory: (errors) => {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.map((error) => ({
          field: error.property,
          messages: Object.values(error.constraints || {}),
        })),
      });
    },
  }));

  // Global exception filter for consistent error shape
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(3000);
  console.log('Application is running on: http://localhost:3000');
}
bootstrap();

