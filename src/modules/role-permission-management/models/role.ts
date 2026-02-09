import { prisma } from '../../../shared/prisma';
import { BaseEntity } from '../../../shared/types';
import { User } from '../../../shared/types'


export interface Role extends BaseEntity {
    name: string,
    description?: string,
    isSystem?: string,
    users?: User[],
    permissions?: RolePermission[]
}

export interface Permission extends BaseEntity {
    name: string,
    description?: string,
    roles?: RolePermission[]
}


export interface RolePermission extends BaseEntity {
    roleId: number,
    permissionId: number,
    role?: Role,
    permission?: Permission
}

export class RoleModel {
    constructor() { }

    async create(data: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role> {
        const role = await prisma.role.create({
            data: {
                name: data.name,
                description: data.description,
                isSystem: data.isSystem,
                users: data.users,
                permissions: data.permissions
            }
        });
        return role;
    }

}


