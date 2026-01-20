import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
/**
 * CallSocketService
 *
 * Manages real-time WebSocket connections for call-related events.
 * Features:
 * - User authentication via JWT
 * - Room management (per user, per team)
 * - Agent presence tracking
 * - Call queue management
 */
export declare class CallSocketService {
    private io;
    private agentStatus;
    private pendingCalls;
    /**
     * Initialize the Socket.io server
     */
    initialize(server: HTTPServer): SocketIOServer;
    /**
     * Get the Socket.io instance
     */
    getIO(): SocketIOServer | null;
    /**
     * Set up authentication middleware
     */
    private setupMiddleware;
    /**
     * Set up event handlers for client connections
     */
    private setupEventHandlers;
    /**
     * Set up listeners for client-to-server events
     */
    private setupClientEventListeners;
    /**
     * Update agent status in our tracking map
     */
    private updateAgentStatus;
    /**
     * Broadcast agent status change to all connected clients
     */
    private broadcastAgentStatus;
    /**
     * Get list of online agents
     */
    getOnlineAgents(): Array<{
        userId: number;
        status: string;
        currentCallId?: number;
    }>;
    /**
     * Get available agents (online and not busy)
     */
    getAvailableAgents(): number[];
    /**
     * Check if a specific user is online
     */
    isUserOnline(userId: number): boolean;
    /**
     * Emit incoming call notification to available agents
     */
    emitIncomingCall(data: {
        callId: number;
        twilioCallSid: string;
        fromNumber: string;
        toNumber: string;
        contact?: {
            id: number;
            name: string;
            company?: string;
        };
    }): void;
    /**
     * Emit call status update
     */
    emitCallStatus(data: {
        callId: number;
        twilioCallSid: string;
        previousStatus: string;
        currentStatus: string;
        duration?: number;
    }): void;
    /**
     * Emit call started (connected) event
     */
    emitCallStarted(data: {
        callId: number;
        twilioCallSid: string;
        direction: 'inbound' | 'outbound';
    }): void;
    /**
     * Emit call ended event
     */
    emitCallEnded(data: {
        callId: number;
        twilioCallSid: string;
        duration: number;
        disposition?: string;
    }): void;
    /**
     * Emit recording ready event
     */
    emitRecordingReady(data: {
        callId: number;
        recordingId: number;
        recordingUrl: string;
        duration: number;
    }): void;
    /**
     * Send event to a specific user
     */
    emitToUser(userId: number, event: string, data: any): void;
    /**
     * Send event to users in a call room
     */
    emitToCallRoom(callId: number, event: string, data: any): void;
}
export declare function getCallSocketService(): CallSocketService;
//# sourceMappingURL=callSocketService.d.ts.map