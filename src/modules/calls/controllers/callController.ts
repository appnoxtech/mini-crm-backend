import { Response } from 'express';
import { CallService } from '../services/callService';
import { getTwilioService } from '../services/twilioService';
import { AuthenticatedRequest } from '../../../shared/types';
import { ResponseHandler } from '../../../shared/responses/responses';
import {
    initiateCallSchema,
    updateCallSchema,
    callListQuerySchema
} from '../validations/callValidation';

/**
 * CallController
 * 
 * Handles HTTP requests for call-related operations
 */
export class CallController {
    private callService: CallService;
    private twilioService = getTwilioService();

    constructor(callService: CallService) {
        this.callService = callService;
    }

    /**
     * POST /api/calls/initiate
     * Initiate an outbound call
     */
    initiateCall = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                ResponseHandler.unauthorized(res);
                return;
            }

            // Validate request body
            const validationResult = initiateCallSchema.safeParse(req.body);
            if (!validationResult.success) {
                ResponseHandler.validationError(res, validationResult.error.issues);
                return;
            }

            const result = await this.callService.initiateCall(
                req.user.id,
                validationResult.data
            );

            ResponseHandler.created(res, {
                call: result.call,
                token: result.token
            }, 'Call initiated successfully');
        } catch (error: any) {
            console.error('[CallController] initiateCall error:', error);
            ResponseHandler.internalError(res, error.message || 'Failed to initiate call');
        }
    };

    /**
     * GET /api/calls
     * List calls with pagination and filters
     */
    listCalls = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                ResponseHandler.unauthorized(res);
                return;
            }

            // Validate query parameters
            const validationResult = callListQuerySchema.safeParse(req.query);
            if (!validationResult.success) {
                ResponseHandler.validationError(res, validationResult.error.issues);
                return;
            }

            const result = await this.callService.listCalls(req.user.id, validationResult.data);

            ResponseHandler.success(res, result);
        } catch (error: any) {
            console.error('[CallController] listCalls error:', error);
            ResponseHandler.internalError(res, error.message || 'Failed to list calls');
        }
    };

    /**
     * GET /api/calls/:id
     * Get a single call by ID
     */
    getCall = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                ResponseHandler.unauthorized(res);
                return;
            }

            const callId = parseInt(req.params.id, 10);
            if (isNaN(callId)) {
                ResponseHandler.validationError(res, { id: 'Invalid call ID' });
                return;
            }

            const call = await this.callService.getCallById(callId, req.user.id);
            if (!call) {
                ResponseHandler.notFound(res, 'Call not found');
                return;
            }

            // Also get events and recording
            const events = await this.callService.getCallEvents(callId);

            ResponseHandler.success(res, { ...call, events });
        } catch (error: any) {
            console.error('[CallController] getCall error:', error);
            ResponseHandler.internalError(res, error.message || 'Failed to get call');
        }
    };

    /**
     * PATCH /api/calls/:id
     * Update call notes and disposition
     */
    updateCall = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                ResponseHandler.unauthorized(res);
                return;
            }

            const callId = parseInt(req.params.id, 10);
            if (isNaN(callId)) {
                ResponseHandler.validationError(res, { id: 'Invalid call ID' });
                return;
            }

            // Validate request body
            const validationResult = updateCallSchema.safeParse(req.body);
            if (!validationResult.success) {
                ResponseHandler.validationError(res, validationResult.error.issues);
                return;
            }

            const call = await this.callService.updateCallDetails(
                callId,
                req.user.id,
                validationResult.data
            );

            if (!call) {
                ResponseHandler.notFound(res, 'Call not found');
                return;
            }

            ResponseHandler.success(res, call, 'Call updated successfully');
        } catch (error: any) {
            console.error('[CallController] updateCall error:', error);
            ResponseHandler.internalError(res, error.message || 'Failed to update call');
        }
    };

    /**
     * DELETE /api/calls/:id
     * Soft delete a call
     */
    deleteCall = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                ResponseHandler.unauthorized(res);
                return;
            }

            const callId = parseInt(req.params.id, 10);
            if (isNaN(callId)) {
                ResponseHandler.validationError(res, { id: 'Invalid call ID' });
                return;
            }

            const deleted = await this.callService.deleteCall(callId, req.user.id);
            if (!deleted) {
                ResponseHandler.notFound(res, 'Call not found');
                return;
            }

            ResponseHandler.noContent(res);
        } catch (error: any) {
            console.error('[CallController] deleteCall error:', error);
            ResponseHandler.internalError(res, error.message || 'Failed to delete call');
        }
    };

    /**
     * POST /api/calls/end/:id
     * End an active call
     */
    endCall = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                ResponseHandler.unauthorized(res);
                return;
            }

            const callId = parseInt(req.params.id, 10);
            if (isNaN(callId)) {
                ResponseHandler.validationError(res, { id: 'Invalid call ID' });
                return;
            }

            const call = await this.callService.endCall(callId, req.user.id);
            if (!call) {
                ResponseHandler.notFound(res, 'Call not found');
                return;
            }

            ResponseHandler.success(res, call, 'Call ended successfully');
        } catch (error: any) {
            console.error('[CallController] endCall error:', error);
            ResponseHandler.internalError(res, error.message || 'Failed to end call');
        }
    };

    /**
     * POST /api/calls/token
     * Generate Twilio client token for browser calling
     */
    generateToken = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                ResponseHandler.unauthorized(res);
                return;
            }

            const tokenResult = this.callService.generateToken(req.user.id, req.user.email);

            ResponseHandler.success(res, tokenResult);
        } catch (error: any) {
            console.error('[CallController] generateToken error:', error);
            ResponseHandler.internalError(res, error.message || 'Failed to generate token');
        }
    };

    /**
     * GET /api/calls/stats
     * Get call statistics for the current user
     */
    getStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                ResponseHandler.unauthorized(res);
                return;
            }

            const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
            const stats = await this.callService.getCallStats(req.user.id, { startDate, endDate });

            ResponseHandler.success(res, stats);
        } catch (error: any) {
            console.error('[CallController] getStats error:', error);
            ResponseHandler.internalError(res, error.message || 'Failed to get stats');
        }
    };

    /**
     * GET /api/calls/contact/:contactId
     * Get calls for a specific contact
     */
    getCallsForContact = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                ResponseHandler.unauthorized(res);
                return;
            }

            const contactId = parseInt(req.params.contactId, 10);
            if (isNaN(contactId)) {
                ResponseHandler.validationError(res, { contactId: 'Invalid contact ID' });
                return;
            }

            const limit = parseInt(req.query.limit as string, 10) || 10;
            const calls = await this.callService.getCallsForContact(contactId, limit);

            ResponseHandler.success(res, { calls });
        } catch (error: any) {
            console.error('[CallController] getCallsForContact error:', error);
            ResponseHandler.internalError(res, error.message || 'Failed to get calls');
        }
    };

    /**
     * GET /api/calls/deal/:dealId
     * Get calls for a specific deal
     */
    getCallsForDeal = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                ResponseHandler.unauthorized(res);
                return;
            }

            const dealId = parseInt(req.params.dealId, 10);
            if (isNaN(dealId)) {
                ResponseHandler.validationError(res, { dealId: 'Invalid deal ID' });
                return;
            }

            const calls = await this.callService.getCallsForDeal(dealId);

            ResponseHandler.success(res, { calls });
        } catch (error: any) {
            console.error('[CallController] getCallsForDeal error:', error);
            ResponseHandler.internalError(res, error.message || 'Failed to get calls');
        }
    };

    /**
     * GET /api/calls/:id/recording
     * Get recording for a call
     */
    getRecording = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                ResponseHandler.unauthorized(res);
                return;
            }

            const callId = parseInt(req.params.id, 10);
            if (isNaN(callId)) {
                ResponseHandler.validationError(res, { id: 'Invalid call ID' });
                return;
            }

            // Verify user has access to this call
            const call = await this.callService.getCallById(callId, req.user.id);
            if (!call) {
                ResponseHandler.notFound(res, 'Call not found');
                return;
            }

            const recording = await this.callService.getCallRecording(callId);
            if (!recording) {
                ResponseHandler.notFound(res, 'Recording not found');
                return;
            }

            ResponseHandler.success(res, recording);
        } catch (error: any) {
            console.error('[CallController] getRecording error:', error);
            ResponseHandler.internalError(res, error.message || 'Failed to get recording');
        }
    };
}
