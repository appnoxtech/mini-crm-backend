import { prisma } from '../../../shared/prisma';

export interface KnowledgeBaseItem {
    id: number;
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
            category: row.category,
            topic: row.topic,
            content: row.content,
            keywords: row.keywords ? (typeof row.keywords === 'string' ? JSON.parse(row.keywords) : row.keywords) : [],
            updated_at: row.updatedAt.toISOString(),
        };
    }

    async addItem(data: Omit<KnowledgeBaseItem, 'id' | 'updated_at'>): Promise<number> {
        const item = await prisma.knowledgeBase.create({
            data: {
                category: data.category,
                topic: data.topic,
                content: data.content,
                keywords: data.keywords
            }
        });
        return item.id;
    }

    async getAllItems(): Promise<KnowledgeBaseItem[]> {
        const rows = await prisma.knowledgeBase.findMany({
            orderBy: { category: 'asc' }
        });
        return rows.map((row: any) => this.mapPrismaToItem(row));
    }

    async findRelevantContext(keywords: string[]): Promise<KnowledgeBaseItem[]> {
        if (keywords.length === 0) return [];

        // Simple keyword matching for now. 
        // In a real scenario, this would use full-text search or vector search.
        const rows = await prisma.knowledgeBase.findMany({
            where: {
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

    async updateItem(id: string, data: Partial<KnowledgeBaseItem>): Promise<void> {
        const updateData: any = {};
        if (data.category) updateData.category = data.category;
        if (data.topic) updateData.topic = data.topic;
        if (data.content) updateData.content = data.content;
        if (data.keywords) updateData.keywords = data.keywords;

        await prisma.knowledgeBase.update({
            where: { id: Number(id) },
            data: updateData
        });
    }

    async deleteItem(id: string): Promise<void> {
        await prisma.knowledgeBase.delete({
            where: { id: Number(id) }
        });
    }
}
