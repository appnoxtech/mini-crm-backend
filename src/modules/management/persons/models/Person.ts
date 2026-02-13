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
    companyId: number;
    lastName: string;
    emails: PersonEmail[];
    phones: PersonPhone[];
    organizationId?: number;
    organization?: Organization | null;
    deletedAt?: string;
}

export interface CreatePersonData {
    firstName: string;
    companyId: number;
    lastName: string;
    emails: PersonEmail[];
    phones?: PersonPhone[];
    organizationId?: number;
}

export interface UpdatePersonData {
    firstName?: string;
    lastName?: string;
    emails?: PersonEmail[];
    phones?: PersonPhone[];
    organizationId?: number | null;
}

export class PersonModel {
    constructor() { }

    initialize(): void { }

    async findExistingEmail(emails: string[], companyId: number, excludePersonId?: number): Promise<{ email: string; personId: number } | null> {
        const result = await prisma.personEmail.findFirst({
            where: {
                email: { in: emails.map(e => e.toLowerCase()) },
                person: {
                    companyId,
                    deletedAt: null
                },
                ...(excludePersonId && { personId: { not: excludePersonId } })
            }
        });

        return result ? { email: result.email, personId: result.personId } : null;
    }

    async findExistingPhone(phones: string[], companyId: number, excludePersonId?: number): Promise<{ phone: string; personId: number } | null> {
        const result = await prisma.personPhone.findFirst({
            where: {
                phone: { in: phones },
                person: {
                    companyId,
                    deletedAt: null
                },
                ...(excludePersonId && { personId: { not: excludePersonId } })
            }
        });

        return result ? { phone: result.phone, personId: result.personId } : null;
    }

    async create(data: CreatePersonData): Promise<Person> {
        const person = await prisma.person.create({
            data: {
                firstName: data.firstName,
                companyId: data.companyId,
                lastName: data.lastName || '',
                emails: (data.emails as any) || (Prisma as any).JsonNull,
                phones: (data.phones as any) || (Prisma as any).JsonNull,
                organizationId: data.organizationId || null,
                ...(data.emails && data.emails.length > 0 && {
                    userEmails: {
                        create: data.emails.map(e => ({ email: e.email.toLowerCase() }))
                    }
                }),
                ...(data.phones && data.phones.length > 0 && {
                    userPhones: {
                        create: data.phones.map(p => ({ phone: p.number }))
                    }
                })
            }
        });

        return this.mapPrismaPersonToPerson(person);
    }

    async findById(id: number, companyId: number, includeDeleted: boolean = false): Promise<Person | null> {
        const person = await prisma.person.findFirst({
            where: { id, companyId },
            include: { organization: true }
        });
        if (!person || (!includeDeleted && person.deletedAt)) return null;
        return this.mapPrismaPersonToPerson(person);
    }

    async findByEmail(email: string, companyId: number): Promise<Person | null> {
        const personEmail = await prisma.personEmail.findFirst({
            where: {
                email: email.toLowerCase(),
                person: {
                    companyId,
                    deletedAt: null
                }
            },
            include: { person: true }
        });
        return personEmail ? this.mapPrismaPersonToPerson(personEmail.person) : null;
    }

    async findAll(options: {
        companyId: number;
        search?: string;
        organizationId?: number;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    }): Promise<{ persons: Person[]; count: number }> {
        const where: any = { companyId: options.companyId };

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

    async findByorganizationId(organizationId: number, companyId: number, includeDeleted: boolean = false): Promise<Person[]> {
        const rows = await prisma.person.findMany({
            where: {
                organizationId,
                companyId,
                ...(!includeDeleted && { deletedAt: null })
            },
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
        });
        return rows.map((r: any) => this.mapPrismaPersonToPerson(r));
    }

    async update(id: number, companyId: number, data: UpdatePersonData): Promise<Person | null> {
        try {
            const updated = await prisma.$transaction(async (tx: any) => {
                const updateData: any = {
                    ...(data.firstName !== undefined && { firstName: data.firstName }),
                    ...(data.lastName !== undefined && { lastName: data.lastName }),
                    ...(data.emails !== undefined && { emails: data.emails as any }),
                    ...(data.phones !== undefined && { phones: data.phones as any }),
                    ...(data.organizationId !== undefined && { organizationId: data.organizationId }),
                    updatedAt: new Date()
                };

                if (data.emails !== undefined) {
                    await tx.personEmail.deleteMany({
                        where: {
                            personId: id,
                            person: { companyId }
                        }
                    });
                    if (data.emails.length > 0) {
                        updateData.userEmails = {
                            create: data.emails.map(e => ({ email: e.email.toLowerCase() }))
                        };
                    }
                }

                if (data.phones !== undefined) {
                    await tx.personPhone.deleteMany({
                        where: {
                            personId: id,
                            person: { companyId }
                        }
                    });
                    if (data.phones.length > 0) {
                        updateData.userPhones = {
                            create: data.phones.map(p => ({ phone: p.number }))
                        };
                    }
                }

                return tx.person.update({
                    where: { id, companyId },
                    data: updateData,
                    include: { organization: true }
                });
            });

            return this.mapPrismaPersonToPerson(updated);
        } catch (error) {
            return null;
        }
    }

    async restore(id: number, companyId: number): Promise<Person | null> {
        try {
            const person = await prisma.$transaction(async (tx: any) => {
                const p = await tx.person.update({
                    where: { id, companyId },
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

    async hardDelete(id: number, companyId: number): Promise<boolean> {
        try {
            await prisma.person.delete({
                where: { id, companyId }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async softDelete(id: number, companyId: number): Promise<boolean> {
        try {
            await prisma.person.update({
                where: { id, companyId },
                data: { deletedAt: new Date() }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async searchByPersonName(search: string, companyId: number): Promise<Person[]> {
        const persons = await prisma.person.findMany({
            where: {
                companyId,
                deletedAt: null,
                OR: [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } }
                ]
            },
            include: { organization: true },
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
        });
        return persons.map((p: any) => this.mapPrismaPersonToPerson(p));
    }

    private mapPrismaPersonToPerson(p: any): Person {
        return {
            id: p.id,
            companyId: p.companyId,
            firstName: p.firstName,
            lastName: p.lastName,
            emails: (p.emails as any[]) || [],
            phones: (p.phones as any[]) || [],
            organizationId: p.organizationId || undefined,
            organization: p.organization ? {
                id: p.organization.id,
                name: p.organization.name,
            } as any : undefined,

            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
            deletedAt: p.deletedAt?.toISOString() || undefined
        };
    }
}

