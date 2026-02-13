import { prisma } from '../../../shared/prisma';

export interface KnowledgeBaseItem {
    id: number;
    companyId: number;
    category: string;
    topic: string;
    content: string;
    keywords: string[];
    updated_at?: string;
}

export class KnowledgeBaseModel {
    constructor(_db?: any) { }

    initialize(): void {
        // No-op with Prisma
    }

    private mapPrismaToItem(row: any): KnowledgeBaseItem {
        return {
            id: row.id,
            companyId: row.companyId,
            category: row.category,
            topic: row.topic,
            content: row.content,
            keywords: row.keywords ? (typeof row.keywords === 'string' ? JSON.parse(row.keywords) : row.keywords) : [],
            updated_at: row.updatedAt.toISOString(),
        };
    }

    async addItem(data: Omit<KnowledgeBaseItem, 'id' | 'updated_at'> & { companyId: number }): Promise<number> {
        const item = await prisma.knowledgeBase.create({
            data: {
                companyId: data.companyId,
                category: data.category,
                topic: data.topic,
                content: data.content,
                keywords: data.keywords
            }
        });
        return item.id;
    }

    async getAllItems(companyId: number): Promise<KnowledgeBaseItem[]> {
        const rows = await prisma.knowledgeBase.findMany({
            where: { companyId },
            orderBy: { category: 'asc' }
        });
        return rows.map((row: any) => this.mapPrismaToItem(row));
    }

    async findRelevantContext(keywords: string[], companyId: number): Promise<KnowledgeBaseItem[]> {
        if (keywords.length === 0) return [];

        const rows = await prisma.knowledgeBase.findMany({
            where: {
                companyId,
                OR: keywords.map(kw => ({
                    OR: [
                        { topic: { contains: kw, mode: 'insensitive' } },
                        { content: { contains: kw, mode: 'insensitive' } },
                        { keywords: { array_contains: kw, path: [] } } // Postgres specific JSONB check
                    ]
                }))
            }
        });

        return rows.map((row: any) => this.mapPrismaToItem(row));
    }

    async updateItem(id: string, companyId: number, data: Partial<KnowledgeBaseItem>): Promise<void> {
        const updateData: any = {};
        if (data.category) updateData.category = data.category;
        if (data.topic) updateData.topic = data.topic;
        if (data.content) updateData.content = data.content;
        if (data.keywords) updateData.keywords = data.keywords;

        await prisma.knowledgeBase.updateMany({
            where: { id: Number(id), companyId },
            data: updateData
        });
    }

    async deleteItem(id: string, companyId: number): Promise<void> {
        await prisma.knowledgeBase.deleteMany({
            where: { id: Number(id), companyId }
        });
    }
}
