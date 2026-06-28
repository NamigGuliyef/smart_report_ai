import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { Analys, AnalysSchema } from '../analys/model/analys.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Analys.name, schema: AnalysSchema }]),
  ],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule { }
