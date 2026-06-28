import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ versionKey: false, timestamps: true })

export class Analys extends Document {

    @Prop({ required: true })
    fileName: string;

    @Prop({ type: Object }) // Faylın məzmunu istənilən struktura malik ola bilər
    dataContent: any;

    @Prop({ type: Object })
    metadata: {
        columnNames: string[];
        user: string;
        userId?: string;
        customPrompt?: string;
        model?: string;
    };

}

export const AnalysSchema = SchemaFactory.createForClass(Analys);
