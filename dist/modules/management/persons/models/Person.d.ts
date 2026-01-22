import Database from 'better-sqlite3';
import { BaseEntity } from '../../../../shared/types';
export type EmailLabel = 'work' | 'home' | 'other' | 'personal';
export type PhoneType = 'home' | 'work' | 'mobile' | 'other';
export interface PersonEmail {
    email: string;
    label: EmailLabel;
}
export interface PersonPhone {
    number: string;
    type: PhoneType;
}
export interface Person extends BaseEntity {
    firstName: string;
    lastName: string;
    emails: PersonEmail[];
    phones: PersonPhone[];
    organizationId?: number;
    country?: string;
    deletedAt?: string;
}
export interface PersonRow {
    id: number;
    firstName: string;
    lastName: string;
    emails: string;
    phones: string;
    organizationId: number | null;
    country: string | null;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
}
export interface CreatePersonData {
    firstName: string;
    lastName: string;
    emails: PersonEmail[];
    phones?: PersonPhone[];
    organizationId?: number;
    country?: string;
}
export interface UpdatePersonData {
    firstName?: string;
    lastName?: string;
    emails?: PersonEmail[];
    phones?: PersonPhone[];
    organizationId?: number | null;
    country?: string | null;
}
export declare class PersonModel {
    private db;
    constructor(db: Database.Database);
    initialize(): void;
    findExistingEmail(emails: string[], excludePersonId?: number): {
        email: string;
        personId: number;
    } | undefined;
    findExistingPhone(phones: string[], excludePersonId?: number): {
        phone: string;
        personId: number;
    } | undefined;
    private syncEmailLookup;
    private syncPhoneLookup;
    private rowToPerson;
    create(data: CreatePersonData): Person;
    searchByPersonName(search: string): Person[];
    findById(id: number, includeDeleted?: boolean): Person | undefined;
    findAll(options?: {
        search?: string;
        organizationId?: number;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    }): {
        persons: Person[];
        count: number;
    };
    findByorganizationId(organizationId: number, includeDeleted?: boolean): Person[];
    update(id: number, data: UpdatePersonData): Person | null;
    softDelete(id: number): boolean;
    restore(id: number): Person | null;
    hardDelete(id: number): boolean;
}
//# sourceMappingURL=Person.d.ts.map