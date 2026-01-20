import { Response } from 'express';
import { CallService } from '../services/callService';
import { AuthenticatedRequest } from '../../../shared/types';
/**
 * CallController
 *
 * Handles HTTP requests for call-related operations
 */
export declare class CallController {
    private callService;
    private twilioService;
    constructor(callService: CallService);
    /**
     * POST /api/calls/initiate
     * Initiate an outbound call
     */
    initiateCall: (req: AuthenticatedRequest, res: Response) => Promise<void>;
    /**
     * GET /api/calls
     * List calls with pagination and filters
     */
    listCalls: (req: AuthenticatedRequest, res: Response) => Promise<void>;
    /**
     * GET /api/calls/:id
     * Get a single call by ID
     */
    getCall: (req: AuthenticatedRequest, res: Response) => Promise<void>;
    /**
     * PATCH /api/calls/:id
     * Update call notes and disposition
     */
    updateCall: (req: AuthenticatedRequest, res: Response) => Promise<void>;
    /**
     * DELETE /api/calls/:id
     * Soft delete a call
     */
    deleteCall: (req: AuthenticatedRequest, res: Response) => Promise<void>;
    /**
     * POST /api/calls/end/:id
     * End an active call
     */
    endCall: (req: AuthenticatedRequest, res: Response) => Promise<void>;
    /**
     * POST /api/calls/token
     * Generate Twilio client token for browser calling
     */
    generateToken: (req: AuthenticatedRequest, res: Response) => Promise<void>;
    /**
     * GET /api/calls/stats
     * Get call statistics for the current user
     */
    getStats: (req: AuthenticatedRequest, res: Response) => Promise<void>;
    /**
     * GET /api/calls/contact/:contactId
     * Get calls for a specific contact
     */
    getCallsForContact: (req: AuthenticatedRequest, res: Response) => Promise<void>;
    /**
     * GET /api/calls/deal/:dealId
     * Get calls for a specific deal
     */
    getCallsForDeal: (req: AuthenticatedRequest, res: Response) => Promise<void>;
    /**
     * GET /api/calls/:id/recording
     * Get recording for a call
     */
    getRecording: (req: AuthenticatedRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=callController.d.ts.map