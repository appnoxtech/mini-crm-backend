"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallSocketService = void 0;
exports.getCallSocketService = getCallSocketService;
const socket_io_1 = require("socket.io");
const authService_1 = require("../../auth/services/authService");
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
class CallSocketService {
    io = null;
    // Track connected agents and their status
    agentStatus = new Map();
    // Track pending incoming calls for queue management
    pendingCalls = new Map();
    /**
     * Initialize the Socket.io server
     */
    initialize(server) {
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: '*', // Configure based on your frontend URLs in production
                methods: ['GET', 'POST']
            },
            path: '/socket.io/calls'
        });
        this.setupMiddleware();
        this.setupEventHandlers();
        console.log('[CallSocket] WebSocket server initialized');
        return this.io;
    }
    /**
     * Get the Socket.io instance
     */
    getIO() {
        return this.io;
    }
    /**
     * Set up authentication middleware
     */
    setupMiddleware() {
        if (!this.io)
            return;
        // Authentication middleware
        this.io.use((socket, next) => {
            const token = socket.handshake.auth.token ||
                socket.handshake.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                return next(new Error('Authentication required'));
            }
            const user = (0, authService_1.verifyToken)(token);
            if (!user) {
                return next(new Error('Invalid or expired token'));
            }
            // Attach user to socket
            socket.user = user;
            next();
        });
    }
    /**
     * Set up event handlers for client connections
     */
    setupEventHandlers() {
        if (!this.io)
            return;
        this.io.on('connection', (socket) => {
            const user = socket.user;
            console.log(`[CallSocket] User ${user.id} (${user.email}) connected`);
            // Join user-specific room
            socket.join(`user:${user.id}`);
            // Update agent status on connection
            this.updateAgentStatus(user.id, socket.id, 'online');
            // Set up event listeners for this socket
            this.setupClientEventListeners(socket, user);
            // Handle disconnection
            socket.on('disconnect', (reason) => {
                console.log(`[CallSocket] User ${user.id} disconnected: ${reason}`);
                this.updateAgentStatus(user.id, socket.id, 'offline');
                // Notify others that this agent went offline
                this.broadcastAgentStatus(user.id, 'offline');
            });
        });
    }
    /**
     * Set up listeners for client-to-server events
     */
    setupClientEventListeners(socket, user) {
        // Agent accepts an incoming call
        socket.on('call:accept', (payload) => {
            console.log(`[CallSocket] User ${user.id} accepting call ${payload.callId}`);
            // Mark agent as busy
            this.updateAgentStatus(user.id, socket.id, 'busy', payload.callId);
            // Remove from pending calls
            this.pendingCalls.delete(payload.callId);
            // Notify other agents that call was accepted
            this.io?.emit('call:accepted', {
                callId: payload.callId,
                acceptedBy: user.id,
                timestamp: new Date().toISOString()
            });
        });
        // Agent rejects an incoming call
        socket.on('call:reject', (payload) => {
            console.log(`[CallSocket] User ${user.id} rejecting call ${payload.callId}`);
            // Record rejection in pending calls
            const pendingCall = this.pendingCalls.get(payload.callId);
            if (pendingCall) {
                pendingCall.notifiedAgents.add(user.id);
                // TODO: Route to next available agent or voicemail
            }
        });
        // Add note during active call
        socket.on('call:note', (payload) => {
            console.log(`[CallSocket] User ${user.id} adding note to call ${payload.callId}`);
            // Emit to all connected clients for this user (in case of multiple tabs)
            this.io?.to(`user:${user.id}`).emit('call:note-added', {
                callId: payload.callId,
                note: payload.note,
                addedBy: user.id,
                timestamp: new Date().toISOString()
            });
        });
        // Agent sets their availability status
        socket.on('agent:status', (payload) => {
            console.log(`[CallSocket] User ${user.id} setting status to ${payload.status}`);
            this.updateAgentStatus(user.id, socket.id, payload.status);
            this.broadcastAgentStatus(user.id, payload.status);
        });
        // Join a specific call room (for multi-party or supervisor monitoring)
        socket.on('call:join-room', (callId) => {
            socket.join(`call:${callId}`);
            console.log(`[CallSocket] User ${user.id} joined call room ${callId}`);
        });
        // Leave a call room
        socket.on('call:leave-room', (callId) => {
            socket.leave(`call:${callId}`);
            console.log(`[CallSocket] User ${user.id} left call room ${callId}`);
        });
        // Request current agent list (for presence)
        socket.on('agents:list', () => {
            const agents = this.getOnlineAgents();
            socket.emit('agents:list', agents);
        });
    }
    /**
     * Update agent status in our tracking map
     */
    updateAgentStatus(userId, socketId, status, currentCallId) {
        if (status === 'offline') {
            this.agentStatus.delete(userId);
        }
        else {
            const existing = this.agentStatus.get(userId);
            this.agentStatus.set(userId, {
                socketId,
                status,
                currentCallId,
                connectedAt: existing?.connectedAt || new Date(),
                lastActivity: new Date()
            });
        }
    }
    /**
     * Broadcast agent status change to all connected clients
     */
    broadcastAgentStatus(userId, status) {
        this.io?.emit('agent:status', {
            type: 'agent:status',
            userId,
            status,
            timestamp: new Date().toISOString()
        });
    }
    /**
     * Get list of online agents
     */
    getOnlineAgents() {
        const agents = [];
        this.agentStatus.forEach((info, userId) => {
            agents.push({
                userId,
                status: info.status,
                currentCallId: info.currentCallId
            });
        });
        return agents;
    }
    /**
     * Get available agents (online and not busy)
     */
    getAvailableAgents() {
        const available = [];
        this.agentStatus.forEach((info, userId) => {
            if (info.status === 'online') {
                available.push(userId);
            }
        });
        return available;
    }
    /**
     * Check if a specific user is online
     */
    isUserOnline(userId) {
        const status = this.agentStatus.get(userId);
        return status !== undefined && status.status !== 'offline';
    }
    // ============================================
    // Server-to-Client Event Emitters
    // ============================================
    /**
     * Emit incoming call notification to available agents
     */
    emitIncomingCall(data) {
        // Track pending call
        this.pendingCalls.set(data.callId, {
            callId: data.callId,
            fromNumber: data.fromNumber,
            createdAt: new Date(),
            notifiedAgents: new Set()
        });
        // Get available agents
        const availableAgents = this.getAvailableAgents();
        if (availableAgents.length === 0) {
            console.warn('[CallSocket] No available agents for incoming call');
            // Could emit to a supervisor or queue
        }
        // Notify all (or available) agents
        this.io?.emit('call:incoming', {
            type: 'call:incoming',
            ...data,
            timestamp: new Date().toISOString()
        });
        console.log(`[CallSocket] Incoming call ${data.callId} broadcast to ${availableAgents.length} agents`);
    }
    /**
     * Emit call status update
     */
    emitCallStatus(data) {
        this.io?.to(`call:${data.callId}`).emit('call:status', {
            type: 'call:status',
            ...data,
            timestamp: new Date().toISOString()
        });
        // Also emit to all (for call history updates)
        this.io?.emit('call:status', {
            type: 'call:status',
            ...data,
            timestamp: new Date().toISOString()
        });
    }
    /**
     * Emit call started (connected) event
     */
    emitCallStarted(data) {
        this.io?.emit('call:started', {
            type: 'call:started',
            ...data,
            timestamp: new Date().toISOString()
        });
    }
    /**
     * Emit call ended event
     */
    emitCallEnded(data) {
        // Update agent status if they were on this call
        this.agentStatus.forEach((info, userId) => {
            if (info.currentCallId === data.callId) {
                this.updateAgentStatus(userId, info.socketId, 'online');
                this.broadcastAgentStatus(userId, 'online');
            }
        });
        this.io?.emit('call:ended', {
            type: 'call:ended',
            ...data,
            timestamp: new Date().toISOString()
        });
    }
    /**
     * Emit recording ready event
     */
    emitRecordingReady(data) {
        this.io?.emit('call:recording-ready', {
            type: 'call:recording-ready',
            ...data,
            timestamp: new Date().toISOString()
        });
    }
    /**
     * Send event to a specific user
     */
    emitToUser(userId, event, data) {
        this.io?.to(`user:${userId}`).emit(event, data);
    }
    /**
     * Send event to users in a call room
     */
    emitToCallRoom(callId, event, data) {
        this.io?.to(`call:${callId}`).emit(event, data);
    }
}
exports.CallSocketService = CallSocketService;
// Singleton instance
let callSocketServiceInstance = null;
function getCallSocketService() {
    if (!callSocketServiceInstance) {
        callSocketServiceInstance = new CallSocketService();
    }
    return callSocketServiceInstance;
}
//# sourceMappingURL=callSocketService.js.map