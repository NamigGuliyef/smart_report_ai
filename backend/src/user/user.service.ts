import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Analys } from '../analys/model/analys.schema';

@Injectable()
export class UserService {
    constructor(
        @InjectModel(Analys.name) private readonly analysModel: Model<Analys>,
    ) { }

    /**
     * İstifadəçinin sonuncu cədvəl qarşılaşdırma analizini qaytarır.
     * Yalnız customPrompt olmayan (standart qarşılaşdırma) analizlər arasından seçilir.
     */
    async getLastComparisonStats(userId: string) {
        // Sonuncu standart qarşılaşdırma analizini tap (customPrompt boş olan)
        const lastAnalysis = await this.analysModel.findOne({
            'metadata.userId': userId,
            $or: [
                { 'metadata.customPrompt': { $exists: false } },
                { 'metadata.customPrompt': null },
                { 'metadata.customPrompt': '' },
            ],
        }).sort({ createdAt: -1 });

        if (!lastAnalysis) {
            return {
                hasData: false,
                accuracy: 0,
                discrepancies: 0,
                totalItems: 0,
                lastAuditDate: null,
                fileName: null,
                analysisId: null,
            };
        }

        const dataContent = lastAnalysis.dataContent || {};
        const discrepanciesCount = dataContent.discrepancies?.length || 0;
        const accuracyScore = dataContent.data_quality_score || 0;

        return {
            hasData: true,
            accuracy: accuracyScore,
            discrepancies: discrepanciesCount,
            totalItems: discrepanciesCount,
            lastAuditDate: (lastAnalysis as any).createdAt || null,
            fileName: lastAnalysis.fileName || null,
            analysisId: lastAnalysis._id || null,
            context: dataContent.context || null,
        };
    }


    // Hesabatın silinməsi
    async deleteAnalysis(analysisId: string) {
        return await this.analysModel.findByIdAndDelete(analysisId);
    }

}
