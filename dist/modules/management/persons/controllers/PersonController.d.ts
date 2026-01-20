import { Response } from 'express';
import { PersonService } from '../services/PersonService';
import { AuthenticatedRequest } from '../../../../shared/types';
export declare class PersonController {
    private personService;
    constructor(personService: PersonService);
    searchPersons(req: AuthenticatedRequest, res: Response): Promise<void>;
    getAll(req: AuthenticatedRequest, res: Response): Promise<void>;
    getById(req: AuthenticatedRequest, res: Response): Promise<void>;
    create(req: AuthenticatedRequest, res: Response): Promise<void>;
    update(req: AuthenticatedRequest, res: Response): Promise<void>;
    delete(req: AuthenticatedRequest, res: Response): Promise<void>;
    restore(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=PersonController.d.ts.map