"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallController = void 0;
const twilioService_1 = require("../services/twilioService");
const responses_1 = require("../../../shared/responses/responses");
const callValidation_1 = require("../validations/callValidation");
/**
 * CallController
 *
 * Handles HTTP requests for call-related operations
 */
class CallController {
    callService;
    twilioService = (0, twilioService_1.getTwilioService)();
    constructor(callService) {
        this.callService = callService;
    }
    /**
     * POST /api/calls/initiate
     * Initiate an outbound call
     */
    initiateCall = async (req, res) => {
        try {
            if (!req.user) {
                responses_1.ResponseHandler.unauthorized(res);
                return;
            }
            // Validate request body
            const validationResult = callValidation_1.initiateCallSchema.safeParse(req.body);
            if (!validationResult.success) {
                responses_1.ResponseHandler.validationError(res, validationResult.error.issues);
                return;
            }
            const result = await this.callService.initiateCall(req.user.id, validationResult.data);
            responses_1.ResponseHandler.created(res, {
                call: result.call,
                token: result.token
            }, 'Call initiated successfully');
        }
        catch (error) {
            console.error('[CallController] initiateCall error:', error);
            responses_1.ResponseHandler.internalError(res, error.message || 'Failed to initiate call');
        }
    };
    /**
     * GET /api/calls
     * List calls with pagination and filters
     */
    listCalls = async (req, res) => {
        try {
            if (!req.user) {
                responses_1.ResponseHandler.unauthorized(res);
                return;
            }
            // Validate query parameters
            const validationResult = callValidation_1.callListQuerySchema.safeParse(req.query);
            if (!validationResult.success) {
                responses_1.ResponseHandler.validationError(res, validationResult.error.issues);
                return;
            }
            const result = this.callService.listCalls(req.user.id, validationResult.data);
            responses_1.ResponseHandler.success(res, result);
        }
        catch (error) {
            console.error('[CallController] listCalls error:', error);
            responses_1.ResponseHandler.internalError(res, error.message || 'Failed to list calls');
        }
    };
    /**
     * GET /api/calls/:id
     * Get a single call by ID
     */
    getCall = async (req, res) => {
        try {
            if (!req.user) {
                responses_1.ResponseHandler.unauthorized(res);
                return;
            }
            const callId = parseInt(req.params.id, 10);
            if (isNaN(callId)) {
                responses_1.ResponseHandler.validationError(res, { id: 'Invalid call ID' });
                return;
            }
            const call = this.callService.getCallById(callId, req.user.id);
            if (!call) {
                responses_1.ResponseHandler.notFound(res, 'Call not found');
                return;
            }
            // Also get events and recording
            const events = this.callService.getCallEvents(callId);
            responses_1.ResponseHandler.success(res, { ...call, events });
        }
        catch (error) {
            console.error('[CallController] getCall error:', error);
            responses_1.ResponseHandler.internalError(res, error.message || 'Failed to get call');
        }
    };
    /**
     * PATCH /api/calls/:id
     * Update call notes and disposition
     */
    updateCall = async (req, res) => {
        try {
            if (!req.user) {
                responses_1.ResponseHandler.unauthorized(res);
                return;
            }
            const callId = parseInt(req.params.id, 10);
            if (isNaN(callId)) {
                responses_1.ResponseHandler.validationError(res, { id: 'Invalid call ID' });
                return;
            }
            // Validate request body
            const validationResult = callValidation_1.updateCallSchema.safeParse(req.body);
            if (!validationResult.success) {
                responses_1.ResponseHandler.validationError(res, validationResult.error.issues);
                return;
            }
            const call = this.callService.updateCallDetails(callId, req.user.id, validationResult.data);
            if (!call) {
                responses_1.ResponseHandler.notFound(res, 'Call not found');
                return;
            }
            responses_1.ResponseHandler.success(res, call, 'Call updated successfully');
        }
        catch (error) {
            console.error('[CallController] updateCall error:', error);
            responses_1.ResponseHandler.internalError(res, error.message || 'Failed to update call');
        }
    };
    /**
     * DELETE /api/calls/:id
     * Soft delete a call
     */
    deleteCall = async (req, res) => {
        try {
            if (!req.user) {
                responses_1.ResponseHandler.unauthorized(res);
                return;
            }
            const callId = parseInt(req.params.id, 10);
            if (isNaN(callId)) {
                responses_1.ResponseHandler.validationError(res, { id: 'Invalid call ID' });
                return;
            }
            const deleted = this.callService.deleteCall(callId, req.user.id);
            if (!deleted) {
                responses_1.ResponseHandler.notFound(res, 'Call not found');
                return;
            }
            responses_1.ResponseHandler.noContent(res);
        }
        catch (error) {
            console.error('[CallController] deleteCall error:', error);
            responses_1.ResponseHandler.internalError(res, error.message || 'Failed to delete call');
        }
    };
    /**
     * POST /api/calls/end/:id
     * End an active call
     */
    endCall = async (req, res) => {
        try {
            if (!req.user) {
                responses_1.ResponseHandler.unauthorized(res);
                return;
            }
            const callId = parseInt(req.params.id, 10);
            if (isNaN(callId)) {
                responses_1.ResponseHandler.validationError(res, { id: 'Invalid call ID' });
                return;
            }
            const call = await this.callService.endCall(callId, req.user.id);
            if (!call) {
                responses_1.ResponseHandler.notFound(res, 'Call not found');
                return;
            }
            responses_1.ResponseHandler.success(res, call, 'Call ended successfully');
        }
        catch (error) {
            console.error('[CallController] endCall error:', error);
            responses_1.ResponseHandler.internalError(res, error.message || 'Failed to end call');
        }
    };
    /**
     * POST /api/calls/token
     * Generate Twilio client token for browser calling
     */
    generateToken = async (req, res) => {
        try {
            if (!req.user) {
                responses_1.ResponseHandler.unauthorized(res);
                return;
            }
            const tokenResult = this.callService.generateToken(req.user.id, req.user.email);
            responses_1.ResponseHandler.success(res, tokenResult);
        }
        catch (error) {
            console.error('[CallController] generateToken error:', error);
            responses_1.ResponseHandler.internalError(res, error.message || 'Failed to generate token');
        }
    };
    /**
     * GET /api/calls/stats
     * Get call statistics for the current user
     */
    getStats = async (req, res) => {
        try {
            if (!req.user) {
                responses_1.ResponseHandler.unauthorized(res);
                return;
            }
            const { startDate, endDate } = req.query;
            const stats = this.callService.getCallStats(req.user.id, { startDate, endDate });
            responses_1.ResponseHandler.success(res, stats);
        }
        catch (error) {
            console.error('[CallController] getStats error:', error);
            responses_1.ResponseHandler.internalError(res, error.message || 'Failed to get stats');
        }
    };
    /**
     * GET /api/calls/contact/:contactId
     * Get calls for a specific contact
     */
    getCallsForContact = async (req, res) => {
        try {
            if (!req.user) {
                responses_1.ResponseHandler.unauthorized(res);
                return;
            }
            const contactId = parseInt(req.params.contactId, 10);
            if (isNaN(contactId)) {
                responses_1.ResponseHandler.validationError(res, { contactId: 'Invalid contact ID' });
                return;
            }
            const limit = parseInt(req.query.limit, 10) || 10;
            const calls = this.callService.getCallsForContact(contactId, limit);
            responses_1.ResponseHandler.success(res, { calls });
        }
        catch (error) {
            console.error('[CallController] getCallsForContact error:', error);
            responses_1.ResponseHandler.internalError(res, error.message || 'Failed to get calls');
        }
    };
    /**
     * GET /api/calls/deal/:dealId
     * Get calls for a specific deal
     */
    getCallsForDeal = async (req, res) => {
        try {
            if (!req.user) {
                responses_1.ResponseHandler.unauthorized(res);
                return;
            }
            const dealId = parseInt(req.params.dealId, 10);
            if (isNaN(dealId)) {
                responses_1.ResponseHandler.validationError(res, { dealId: 'Invalid deal ID' });
                return;
            }
            const calls = this.callService.getCallsForDeal(dealId);
            responses_1.ResponseHandler.success(res, { calls });
        }
        catch (error) {
            console.error('[CallController] getCallsForDeal error:', error);
            responses_1.ResponseHandler.internalError(res, error.message || 'Failed to get calls');
        }
    };
    /**
     * GET /api/calls/:id/recording
     * Get recording for a call
     */
    getRecording = async (req, res) => {
        try {
            if (!req.user) {
                responses_1.ResponseHandler.unauthorized(res);
                return;
            }
            const callId = parseInt(req.params.id, 10);
            if (isNaN(callId)) {
                responses_1.ResponseHandler.validationError(res, { id: 'Invalid call ID' });
                return;
            }
            // Verify user has access to this call
            const call = this.callService.getCallById(callId, req.user.id);
            if (!call) {
                responses_1.ResponseHandler.notFound(res, 'Call not found');
                return;
            }
            const recording = this.callService.getCallRecording(callId);
            if (!recording) {
                responses_1.ResponseHandler.notFound(res, 'Recording not found');
                return;
            }
            responses_1.ResponseHandler.success(res, recording);
        }
        catch (error) {
            console.error('[CallController] getRecording error:', error);
            responses_1.ResponseHandler.internalError(res, error.message || 'Failed to get recording');
        }
    };
}
exports.CallController = CallController;
//# sourceMappingURL=callController.js.map