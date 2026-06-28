import { Module } from '@nestjs/common';
import { AnalysService } from './analys.service';
import { AnalysController } from './analys.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Analys, AnalysSchema } from './model/analys.schema';

@Module({
  imports: [
    MongooseModule.forRoot("mongodb://flowagency:flowagency2026@ac-8cp9xsx-shard-00-00.zhg72gv.mongodb.net:27017,ac-8cp9xsx-shard-00-01.zhg72gv.mongodb.net:27017,ac-8cp9xsx-shard-00-02.zhg72gv.mongodb.net:27017/analys?ssl=true&replicaSet=atlas-5mkhz4-shard-0&authSource=admin&appName=flowagency"),
    MongooseModule.forFeature([{ name: Analys.name, schema: AnalysSchema }]), // <-- bunu əlavə et


  ],
  controllers: [AnalysController],
  providers: [AnalysService],
})
export class AnalysModule { }
