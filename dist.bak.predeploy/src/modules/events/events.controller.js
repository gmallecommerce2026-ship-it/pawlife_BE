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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsController = void 0;
const common_1 = require("@nestjs/common");
const events_service_1 = require("./events.service");
let EventsController = class EventsController {
    eventsService;
    constructor(eventsService) {
        this.eventsService = eventsService;
    }
    async getUpcomingEvents(limit) {
        return this.eventsService.getUpcomingEvents(limit);
    }
    async getEventDetailOrPreview(id, req, res, userId) {
        const acceptHeader = req.headers['accept'];
        const acceptsHTML = acceptHeader && acceptHeader.includes('text/html');
        if (acceptsHTML) {
            const html = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Sự kiện PawLife</title>
          <style>
              body { 
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                  text-align: center; 
                  padding: 40px 20px; 
                  background-color: #FDF5EF; 
                  margin: 0;
              }
              .container { 
                  background: white; 
                  padding: 40px 30px; 
                  border-radius: 24px; 
                  box-shadow: 0 10px 25px rgba(232, 155, 90, 0.15); 
                  max-width: 400px; 
                  margin: 0 auto; 
              }
              h1 { color: #E89B5A; margin-bottom: 10px; font-size: 28px; }
              p { color: #8E8E93; line-height: 1.6; font-size: 16px; margin-bottom: 20px; }
              .badge {
                  display: inline-block;
                  background-color: #E89B5A;
                  color: white;
                  padding: 8px 16px;
                  border-radius: 20px;
                  font-weight: bold;
                  font-size: 14px;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>🐾 PawLife</h1>
              <p>Chi tiết sự kiện này hiện chỉ có thể xem được bên trong ứng dụng PawLife.</p>
              <div class="badge">Coming Soon</div>
          </div>
      </body>
      </html>
      `;
            res.setHeader('Content-Type', 'text/html');
            res.send(html);
            return;
        }
        return this.eventsService.getEventDetail(id, userId);
    }
    async getInterestedEvents(userId) {
        if (!userId) {
            return { success: false, message: 'Missing userId' };
        }
        return this.eventsService.getInterestedEvents(userId);
    }
    async getEventDetail(id, userId) {
        return this.eventsService.getEventDetail(id, userId);
    }
    async toggleInterest(eventId, userId) {
        return this.eventsService.toggleInterest(eventId, userId);
    }
    async searchEvents(search, limit) {
        return this.eventsService.searchEvents({ search, limit });
    }
};
exports.EventsController = EventsController;
__decorate([
    (0, common_1.Get)('upcoming'),
    __param(0, (0, common_1.Query)('limit', new common_1.DefaultValuePipe(5), common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "getUpcomingEvents", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __param(3, (0, common_1.Query)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, String]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "getEventDetailOrPreview", null);
__decorate([
    (0, common_1.Get)('interested/user'),
    __param(0, (0, common_1.Query)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "getInterestedEvents", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "getEventDetail", null);
__decorate([
    (0, common_1.Post)(':id/interest'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "toggleInterest", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('limit', new common_1.DefaultValuePipe(20), common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "searchEvents", null);
exports.EventsController = EventsController = __decorate([
    (0, common_1.Controller)('events'),
    __metadata("design:paramtypes", [events_service_1.EventsService])
], EventsController);
//# sourceMappingURL=events.controller.js.map