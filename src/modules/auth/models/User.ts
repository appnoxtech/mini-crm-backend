import { User, AuthUser } from '../../../shared/types';
import { prisma } from '../../../shared/prisma';

type LoginUserResponse = {
  id: number;
  email: string;
  name: string;
  profileImg: any[];
  phone: string | null;
  dateFormat: string | null;
  timezone: string | null;
  language: string | null;
  defaultCurrency: string | null;
  createdAt: string;
  updatedAt: string;
  role: string | null;
};

export class UserModel {
  constructor() { }

  initialize(): void { }

  async createUser(email: string, name: string, passwordHash: string, role: string): Promise<User> {
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash,
        role,
      }
    });

    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    } as unknown as User;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });
    if (!user) return undefined;

    return {
      ...user,
      profileImg: typeof user.profileImg === 'string' ? JSON.parse(user.profileImg || '[]') : (user.profileImg || []),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    } as unknown as User;
  }

  async findById(id: number): Promise<User | undefined> {
    const user = await prisma.user.findUnique({
      where: { id }
    });
    if (!user) return undefined;

    return {
      ...user,
      profileImg: typeof user.profileImg === 'string' ? JSON.parse(user.profileImg || '[]') : (user.profileImg || []),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    } as unknown as User;
  }

  async findByIds(ids: number[]): Promise<User[]> {
    if (ids.length === 0) return [];
    const users = await prisma.user.findMany({
      where: { id: { in: ids } }
    });
    return users.map((user: any) => ({
      ...user,
      profileImg: typeof user.profileImg === 'string' ? JSON.parse(user.profileImg || '[]') : (user.profileImg || []),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    } as unknown as User));
  }

  async updateUser(id: number, updates: Partial<User>): Promise<AuthUser | null> {
    try {
      const data: any = {};
      const allowedUpdates: (keyof User)[] = [
        'name', 'email', 'profileImg', 'phone', 'dateFormat',
        'timezone', 'language', 'defaultCurrency'
      ];

      allowedUpdates.forEach(key => {
        if (updates[key] !== undefined) {
          data[key] = key === 'email' ? (updates[key] as string).toLowerCase() : updates[key];
        }
      });

      if (Object.keys(data).length === 0) return null;

      const updatedUser = await prisma.user.update({
        where: { id },
        data
      });

      const { passwordHash, ...safeUser } = updatedUser;
      return {
        ...safeUser,
        profileImg: typeof safeUser.profileImg === 'string' ? JSON.parse(safeUser.profileImg || '[]') : (safeUser.profileImg || []),
        createdAt: safeUser.createdAt.toISOString(),
        updatedAt: safeUser.updatedAt.toISOString(),
      } as unknown as AuthUser;
    } catch (error) {
      console.error('Error updating user:', error);
      return null;
    }
  }

  async getProfile(id: number): Promise<AuthUser | null> {
    const user = await prisma.user.findUnique({
      where: { id }
    });
    if (!user) return null;

    const { passwordHash, ...profile } = user;
    return {
      ...profile,
      profileImg: typeof profile.profileImg === 'string' ? JSON.parse(profile.profileImg || '[]') : (profile.profileImg || []),
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    } as unknown as AuthUser;
  }

  async updatePassword(id: number, passwordHash: string): Promise<boolean> {
    try {
      await prisma.user.update({
        where: { id },
        data: { passwordHash }
      });
      return true;
    } catch (error) {
      console.error('Error updating password:', error);
      return false;
    }
  }

  async updateAccountRole(id: number, role: string): Promise<boolean> {
    try {
      await prisma.user.update({
        where: { id },
        data: { role }
      });
      return true;
    } catch (error) {
      console.error('Error updating account role:', error);
      return false;
    }
  }

  async searchByPersonName(search: string): Promise<LoginUserResponse[]> {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      }
    });

    return users.map((user: any) => this.mapToLoginUser(user));
  }

  private mapToLoginUser(user: any): LoginUserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      profileImg: typeof user.profileImg === 'string' ? JSON.parse(user.profileImg || '[]') : (user.profileImg || []),
      phone: user.phone ?? null,
      dateFormat: user.dateFormat ?? null,
      timezone: user.timezone ?? null,
      language: user.language ?? null,
      defaultCurrency: user.defaultCurrency ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      role: user.role ?? null,
    };
  }
}
