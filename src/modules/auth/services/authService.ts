import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, AuthUser } from '../../../shared/types';
import { UserModel } from '../models/User';
import { PersonModel } from '../../management/persons/models/Person';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 10;

export class AuthService {
  private userModel: UserModel;
  private personModel: PersonModel;

  constructor(userModel: UserModel, personModel: PersonModel) {
    this.userModel = userModel;
    this.personModel = personModel;
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateToken(user: AuthUser): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  verifyToken(token: string): AuthUser | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  async createUser(email: string, name: string, password: string): Promise<AuthUser> {
    const passwordHash = await this.hashPassword(password);
    const user = this.userModel.createUser(email, name, passwordHash, 'user');

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt
    };
  }

  async authenticateUser(email: string, password: string): Promise<AuthUser | null> {
    try {
      const user = this.userModel.findByEmail(email);
      if (!user) {
        return null;
      }

      const isValid = await this.comparePassword(password, user.passwordHash);
      if (!isValid) {
        return null;
      }
      const { passwordHash, ...safeUser } = user;
      safeUser.profileImg = JSON.parse(safeUser.profileImg || '[]');
      return safeUser;
    } catch (error) {
      console.error('Authentication error:', error);
      return null;
    }
  }

  async getProfile(id: number): Promise<AuthUser | null> {
    const user = this.userModel.findById(id);
    if (!user) return null;

    return {
      ...user,
      profileImg: JSON.parse(user.profileImg || '[]')
    };
  }


  async updateUser(id: number, updates: Partial<{ name: string; email: string }>): Promise<AuthUser | null> {
    const user = this.userModel.updateUser(id, updates);
    if (!user) return null;

    return {
      ...user,
      profileImg: JSON.parse(user.profileImg || '[]')
    };
  }

  async changePassword(id: number, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      const user = this.userModel.findById(id);
      if (!user) {
        return false;
      }

      const isValid = await this.comparePassword(currentPassword, user.passwordHash);
      if (!isValid) {
        return false;
      }

      const newPasswordHash = await this.hashPassword(newPassword);
      return this.userModel.updatePassword(id, newPasswordHash);
    } catch (error) {
      console.error('Password change error:', error);
      return false;
    }
  }

  async changeAccountRole(id: number, role: string): Promise<boolean> {
    try {
      return this.userModel.updateAccountRole(id, role);
    } catch (error) {
      console.error('Account role change error:', error);
      return false;
    }
  }

  async searchByPersonName(searchTerm: string): Promise<any> {
    if (!searchTerm || !searchTerm.trim()) {
      return [];
    }

    const trimmedSearch = searchTerm.trim();

    // Search in users table
    const users = this.userModel.searchByPersonName(trimmedSearch);
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      type: 'user',
      profileImg: user.profileImg
    }));

    // Search in persons table
    const persons = this.personModel.searchByPersonName(trimmedSearch);
    const formattedPersons = persons.map(person => ({
      id: person.id,
      name: `${person.firstName} ${person.lastName || ''}`.trim(),
      email: person.emails?.[0]?.email || '',
      type: 'person',
      profileImg: [] // Persons don't have profileImg in this schema yet
    }));

    return [...formattedUsers, ...formattedPersons];
  }
}

// Export individual functions for backward compatibility
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return decoded;
  } catch (error) {
    return null;
  }
}

