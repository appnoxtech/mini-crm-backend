import { Person, PersonModel, CreatePersonData, UpdatePersonData, PersonEmail, PersonPhone } from '../models/Person';
import { OrganisationModel } from '../../organisations/models/Organisation';

export class PersonService {
    constructor(
        private personModel: PersonModel,
        private organisationModel?: OrganisationModel
    ) { }

    async create(data: CreatePersonData): Promise<Person> {
        // Validate organisation exists if provided
        if (data.organisationId && this.organisationModel) {
            const org = this.organisationModel.findById(data.organisationId);
            if (!org) {
                throw new Error('Organisation not found');
            }
        }

        // Check email uniqueness
        const emailStrings = data.emails.map(e => e.email);
        const existingEmail = this.personModel.findExistingEmail(emailStrings);
        if (existingEmail) {
            throw new Error('Person already exists');
        }

        // Check phone uniqueness if phones provided
        if (data.phones && data.phones.length > 0) {
            const phoneStrings = data.phones.map(p => p.number);
            const existingPhone = this.personModel.findExistingPhone(phoneStrings);
            if (existingPhone) {
                throw new Error('Person already exists');
            }
        }

        return this.personModel.create(data);
    }

    async getById(id: number): Promise<Person | null> {
        const person = this.personModel.findById(id);
        return person || null;
    }

    async getAll(options: {
        search?: string;
        organisationId?: number;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    } = {}): Promise<{ persons: Person[]; count: number }> {
        return this.personModel.findAll(options);
    }

    async getByOrganisationId(organisationId: number): Promise<Person[]> {
        return this.personModel.findByOrganisationId(organisationId);
    }

    async update(id: number, data: UpdatePersonData): Promise<Person | null> {
        // Validate organisation exists if provided
        if (data.organisationId && this.organisationModel) {
            const org = this.organisationModel.findById(data.organisationId);
            if (!org) {
                throw new Error('Organisation not found');
            }
        }

        // Check email uniqueness if emails are being updated
        if (data.emails && data.emails.length > 0) {
            const emailStrings = data.emails.map(e => e.email);
            const existingEmail = this.personModel.findExistingEmail(emailStrings, id);
            if (existingEmail) {
                throw new Error('Person already exists');
            }
        }

        // Check phone uniqueness if phones are being updated
        if (data.phones && data.phones.length > 0) {
            const phoneStrings = data.phones.map(p => p.number);
            const existingPhone = this.personModel.findExistingPhone(phoneStrings, id);
            if (existingPhone) {
                throw new Error('Person already exists');
            }
        }

        return this.personModel.update(id, data);
    }

    async delete(id: number): Promise<boolean> {
        return this.personModel.softDelete(id);
    }

    async restore(id: number): Promise<Person | null> {
        return this.personModel.restore(id);
    }
}
