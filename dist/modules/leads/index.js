"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLeadRoutes = exports.LeadController = exports.LeadService = exports.LeadModel = void 0;
// Leads module exports
var Lead_1 = require("./models/Lead");
Object.defineProperty(exports, "LeadModel", { enumerable: true, get: function () { return Lead_1.LeadModel; } });
var leadService_1 = require("./services/leadService");
Object.defineProperty(exports, "LeadService", { enumerable: true, get: function () { return leadService_1.LeadService; } });
var leadController_1 = require("./controllers/leadController");
Object.defineProperty(exports, "LeadController", { enumerable: true, get: function () { return leadController_1.LeadController; } });
var leadRoutes_1 = require("./routes/leadRoutes");
Object.defineProperty(exports, "createLeadRoutes", { enumerable: true, get: function () { return leadRoutes_1.createLeadRoutes; } });
//# sourceMappingURL=index.js.map