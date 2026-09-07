import { Module } from '@nestjs/common';
import { ProceduresController } from './procedures.controller';
import { ProceduresService } from './procedures.service';
import { RedisModule } from '../../database/redis/redis.module';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [ProceduresController],
  providers: [ProceduresService],
  exports: [ProceduresService],
})
export class ProceduresModule {}