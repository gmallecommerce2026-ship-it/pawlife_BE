"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const jwt_1 = require("@nestjs/jwt");
const common_1 = require("@nestjs/common");
const redis_service_1 = require("../../database/redis/redis.service");
let NotificationsGateway = class NotificationsGateway {
    jwtService;
    redisService;
    server;
    logger = new common_1.Logger('NotificationsGateway');
    constructor(jwtService, redisService) {
        this.jwtService = jwtService;
        this.redisService = redisService;
    }
    async handleConnection(client) {
        try {
            const authHeader = client.handshake.auth.token || client.handshake.headers['authorization'];
            if (!authHeader) {
                throw new Error('No token provided');
            }
            const token = authHeader.replace('Bearer ', '');
            const payload = this.jwtService.verify(token);
            const userId = payload.id || payload.sub || payload.userId;
            client.data.userId = userId;
            client.join(`user_${userId}`);
            await this.redisService.addSocket(userId, client.id);
            this.logger.log(`[Online] Client connected: ${client.id} - User: ${userId}`);
        }
        catch (error) {
            this.logger.error(`Connection failed: ${error.message}`);
            client.disconnect();
        }
    }
    async handleDisconnect(client) {
        const userId = client.data.userId;
        if (userId) {
            await this.redisService.removeSocket(userId, client.id);
            const isStillOnline = await this.redisService.isUserOnline(userId);
            if (!isStillOnline) {
                this.logger.log(`[Offline] User ${userId} is fully offline.`);
            }
            else {
                this.logger.log(`[Partial Disconnect] Socket ${client.id} closed, but User ${userId} is still online on another device.`);
            }
        }
        else {
            this.logger.log(`Client disconnected before authentication: ${client.id}`);
        }
    }
    sendNotificationToUser(userId, notification) {
        this.server.to(`user_${userId}`).emit('new_notification', notification);
    }
    async notifyUserSmartly(userId, eventName, payload) {
        const isOnline = await this.redisService.isUserOnline(userId);
        if (isOnline) {
            this.server.to(`user_${userId}`).emit(eventName, payload);
        }
        else {
            this.logger.debug(`User ${userId} is offline. Target for Push Notification (FCM).`);
        }
    }
};
exports.NotificationsGateway = NotificationsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], NotificationsGateway.prototype, "server", void 0);
exports.NotificationsGateway = NotificationsGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: '*' },
        namespace: '/notifications',
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        redis_service_1.RedisService])
], NotificationsGateway);
//# sourceMappingURL=notifications.gateway.js.map