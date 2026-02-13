import { prisma } from '../../../shared/prisma';
import { encrypt, decrypt } from '../../../infrastructure/encryption.util';

export interface TenantIntegration {
  id: string;
  tenantId: string;
  provider: string;
  workspaceId: string | null;
  workspaceName: string | null;
  botTokenEncrypted: string | null;
  defaultChannelId: string | null;
  defaultChannelName: string | null;
  isActive: boolean;
  installedByUserId: number | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateIntegrationInput {
  tenantId: string;
  provider: string;
  workspaceId: string;
  workspaceName: string;
  botToken: string;
  installedByUserId?: number;
  metadata?: Record<string, any>;
}

export interface UpdateIntegrationInput {
  workspaceId?: string;
  workspaceName?: string;
  botToken?: string;
  defaultChannelId?: string | null;
  defaultChannelName?: string | null;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export class SlackRepository {
  async findByTenantId(tenantId: string): Promise<TenantIntegration | null> {
    const integration = await prisma.tenantIntegration.findUnique({
      where: {
        tenantId_provider: {
          tenantId,
          provider: 'slack',
        },
      },
    });
    return integration as TenantIntegration | null;
  }

  async findById(id: string): Promise<TenantIntegration | null> {
    const integration = await prisma.tenantIntegration.findUnique({
      where: { id },
    });
    return integration as TenantIntegration | null;
  }

  async findAllActive(): Promise<TenantIntegration[]> {
    const integrations = await prisma.tenantIntegration.findMany({
      where: {
        provider: 'slack',
        isActive: true,
      },
    });
    return integrations as TenantIntegration[];
  }

  async create(input: CreateIntegrationInput): Promise<TenantIntegration> {
    const encryptedToken = encrypt(input.botToken);

    const integration = await prisma.tenantIntegration.create({
      data: {
        tenantId: input.tenantId,
        provider: input.provider,
        workspaceId: input.workspaceId,
        workspaceName: input.workspaceName,
        botTokenEncrypted: encryptedToken,
        installedByUserId: input.installedByUserId,
        metadata: input.metadata || {},
        isActive: true,
      },
    });

    return integration as TenantIntegration;
  }

  async update(id: string, input: UpdateIntegrationInput): Promise<TenantIntegration> {
    const updateData: Record<string, any> = {};

    if (input.workspaceId !== undefined) updateData.workspaceId = input.workspaceId;
    if (input.workspaceName !== undefined) updateData.workspaceName = input.workspaceName;
    if (input.defaultChannelId !== undefined) updateData.defaultChannelId = input.defaultChannelId;
    if (input.defaultChannelName !== undefined) updateData.defaultChannelName = input.defaultChannelName;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;
    if (input.botToken !== undefined) {
      updateData.botTokenEncrypted = encrypt(input.botToken);
    }

    const integration = await prisma.tenantIntegration.update({
      where: { id },
      data: updateData,
    });

    return integration as TenantIntegration;
  }

  async upsert(input: CreateIntegrationInput): Promise<TenantIntegration> {
    const encryptedToken = encrypt(input.botToken);

    const integration = await prisma.tenantIntegration.upsert({
      where: {
        tenantId_provider: {
          tenantId: input.tenantId,
          provider: input.provider,
        },
      },
      update: {
        workspaceId: input.workspaceId,
        workspaceName: input.workspaceName,
        botTokenEncrypted: encryptedToken,
        installedByUserId: input.installedByUserId,
        metadata: input.metadata || {},
        isActive: true,
      },
      create: {
        tenantId: input.tenantId,
        provider: input.provider,
        workspaceId: input.workspaceId,
        workspaceName: input.workspaceName,
        botTokenEncrypted: encryptedToken,
        installedByUserId: input.installedByUserId,
        metadata: input.metadata || {},
        isActive: true,
      },
    });

    return integration as TenantIntegration;
  }

  async deactivate(tenantId: string): Promise<TenantIntegration | null> {
    const existing = await this.findByTenantId(tenantId);
    if (!existing) return null;

    return this.update(existing.id, { isActive: false });
  }

  async delete(id: string): Promise<void> {
    await prisma.tenantIntegration.delete({
      where: { id },
    });
  }

  async deleteByWorkspaceId(workspaceId: string): Promise<void> {
    await prisma.tenantIntegration.deleteMany({
      where: {
        provider: 'slack',
        workspaceId,
      },
    });
  }

  getDecryptedToken(integration: TenantIntegration): string | null {
    if (!integration.botTokenEncrypted) return null;
    try {
      return decrypt(integration.botTokenEncrypted);
    } catch (error) {
      console.error('[SlackRepository] Failed to decrypt token:', error);
      return null;
    }
  }
}

export const slackRepository = new SlackRepository();
