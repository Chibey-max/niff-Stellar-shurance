import { Controller, Post, Body } from '@nestjs/common';
import { HealthDto } from './dto/health.dto';

@Controller()
export class AppController {
  @Post('health')
  health(@Body() body: HealthDto) {
    return { status: 'ok' };
  }
}
