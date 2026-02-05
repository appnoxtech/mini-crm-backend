import { prisma } from '../../../../shared/prisma';
import { BaseEntity } from '../../../../shared/types';
import { Organization } from '../../organisations/models/Organization';
import { Prisma } from '@prisma/client';

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
    organization?: Organization | null;
    country?: string;
    deletedAt?: string;
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

export class PersonModel {
    constructor() { }

    initialize(): void { }

    async findExistingEmail(emails: string[], excludePersonId?: number): Promise<{ email: string; personId: number } | null> {
        const result = await prisma.personEmail.findFirst({
            where: {
                email: { in: emails.map(e => e.toLowerCase()) },
                person: { deletedAt: null },
                ...(excludePersonId && { personId: { not: excludePersonId } })
            }
        });

        return result ? { email: result.email, personId: result.personId } : null;
    }

    async findExistingPhone(phones: string[], excludePersonId?: number): Promise<{ phone: string; personId: number } | null> {
        const result = await prisma.personPhone.findFirst({
            where: {
                phone: { in: phones },
                person: { deletedAt: null },
                ...(excludePersonId && { personId: { not: excludePersonId } })
            }
        });

        return result ? { phone: result.phone, personId: result.personId } : null;
    }

    async create(data: CreatePersonData): Promise<Person> {
        const person = await prisma.person.create({
            data: {
                firstName: data.firstName,
                lastName: data.lastName || '',
                emails: (data.emails as any) || (Prisma as any).JsonNull,
                phones: (data.phones as any) || (Prisma as any).JsonNull,
                organizationId: data.organizationId || null,
                country: data.country || null,
                userEmails: {
                    create: data.emails.map(e => ({ email: e.email.toLowerCase() }))
                },
                userPhones: {
                    create: (data.phones || []).map(p => ({ phone: p.number }))
                }
            }
        });

        return this.mapPrismaPersonToPerson(person);
    }

    async searchByPersonName(search: string): Promise<Person[]> {
        const rows = await prisma.person.findMany({
            where: {
                OR: [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } }
                ],
                deletedAt: null
            }
        });
        return rows.map((r: any) => this.mapPrismaPersonToPerson(r));
    }

    async findById(id: number, includeDeleted: boolean = false): Promise<Person | null> {
        const person = await prisma.person.findUnique({
            where: { id },
            include: { organization: true }
        });
        if (!person || (!includeDeleted && person.deletedAt)) return null;
        return this.mapPrismaPersonToPerson(person);
    }

    async findByEmail(email: string): Promise<Person | null> {
        const personEmail = await prisma.personEmail.findFirst({
            where: {
                email: email.toLowerCase(),
                person: { deletedAt: null }
            },
            include: { person: true }
        });
        return personEmail ? this.mapPrismaPersonToPerson(personEmail.person) : null;
    }

    async findAll(options: {
        search?: string;
        organizationId?: number;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    } = {}): Promise<{ persons: Person[]; count: number }> {
        const where: any = {};

        if (!options.includeDeleted) {
            where.deletedAt = null;
        }

        if (options.organizationId) {
            where.organizationId = options.organizationId;
        }

        if (options.search) {
            where.OR = [
                { firstName: { contains: options.search, mode: 'insensitive' } },
                { lastName: { contains: options.search, mode: 'insensitive' } }
            ];
        }

        const [rows, count] = await Promise.all([
            prisma.person.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: options.limit,
                skip: options.offset || 0,
                include: { organization: true }
            }),
            prisma.person.count({ where })
        ]);

        return {
            persons: rows.map((r: any) => this.mapPrismaPersonToPerson(r)),
            count
        };
    }

    async findByorganizationId(organizationId: number, includeDeleted: boolean = false): Promise<Person[]> {
        const rows = await prisma.person.findMany({
            where: {
                organizationId,
                ...(!includeDeleted && { deletedAt: null })
            },
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
        });
        return rows.map((r: any) => this.mapPrismaPersonToPerson(r));
    }

    async update(id: number, data: UpdatePersonData): Promise<Person | null> {
        try {
            const updated = await prisma.$transaction(async (tx: any) => {
                const updateData: any = {
                    ...(data.firstName !== undefined && { firstName: data.firstName }),
                    ...(data.lastName !== undefined && { lastName: data.lastName }),
                    ...(data.emails !== undefined && { emails: data.emails as any }),
                    ...(data.phones !== undefined && { phones: data.phones as any }),
                    ...(data.organizationId !== undefined && { organizationId: data.organizationId }),
                    ...(data.country !== undefined && { country: data.country }),
                    updatedAt: new Date()
                };

                if (data.emails !== undefined) {
                    await tx.personEmail.deleteMany({ where: { personId: id } });
                    updateData.userEmails = {
                        create: data.emails.map(e => ({ email: e.email.toLowerCase() }))
                    };
                }

                if (data.phones !== undefined) {
                    await tx.personPhone.deleteMany({ where: { personId: id } });
                    updateData.userPhones = {
                        create: data.phones.map(p => ({ phone: p.number }))
                    };
                }

                return tx.person.update({
                    where: { id },
                    data: updateData,
                    include: { organization: true }
                });
            });

            return this.mapPrismaPersonToPerson(updated);
        } catch (error) {
            return null;
        }
    }

    async softDelete(id: number): Promise<boolean> {
        try {
            await prisma.$transaction([
                prisma.personEmail.deleteMany({ where: { personId: id } }),
                prisma.personPhone.deleteMany({ where: { personId: id } }),
                prisma.person.update({
                    where: { id },
                    data: { deletedAt: new Date() }
                })
            ]);
            return true;
        } catch (error) {
            return false;
        }
    }

    async restore(id: number): Promise<Person | null> {
        try {
            const person = await prisma.$transaction(async (tx: any) => {
                const p = await tx.person.update({
                    where: { id },
                    data: { deletedAt: null },
                    include: { organization: true }
                });

                const emails = (p.emails as any[]) || [];
                const phones = (p.phones as any[]) || [];

                await tx.personEmail.createMany({
                    data: emails.map(e => ({ personId: id, email: e.email.toLowerCase() })),
                    skipDuplicates: true
                });

                await tx.personPhone.createMany({
                    data: phones.map(p => ({ personId: id, phone: p.number })),
                    skipDuplicates: true
                });

                return p;
            });

            return this.mapPrismaPersonToPerson(person);
        } catch (error) {
            return null;
        }
    }

    async hardDelete(id: number): Promise<boolean> {
        try {
            await prisma.person.delete({
                where: { id }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    private mapPrismaPersonToPerson(p: any): Person {
        return {
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            emails: (p.emails as any[]) || [],
            phones: (p.phones as any[]) || [],
            organizationId: p.organizationId || undefined,
            organization: p.organization ? {
                id: p.organization.id,
                name: p.organization.name,
                // map other fields if needed
            } as any : undefined,
            country: p.country || undefined,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
            deletedAt: p.deletedAt?.toISOString() || undefined
        };
    }
}
