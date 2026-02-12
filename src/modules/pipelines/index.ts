// Export models
export type { Pipeline } from './models/Pipeline';
export { PipelineModel } from './models/Pipeline';
export type { PipelineStage } from './models/PipelineStage';
export { PipelineStageModel } from './models/PipelineStage';
export type { Deal } from './models/Deal';
export { DealModel } from './models/Deal';
export type { DealHistory } from './models/DealHistory';
export { DealHistoryModel } from './models/DealHistory';
export type { DealActivity } from './models/DealActivity';
export { DealActivityModel } from './models/DealActivity';

// Export services
export { PipelineService } from './services/pipelineService';
export { PipelineStageService } from './services/pipelineStageService';
export { DealService } from './services/dealService';
export { DealActivityService } from './services/dealActivityService';
export { emailDealLinkingService } from './services/emailDealLinkingService';

// Export controllers
export { PipelineController } from './controllers/pipelineController';
export { DealController } from './controllers/dealController';
export { ActivityController } from './controllers/activityController';
export { dealEmailController } from './controllers/dealEmailController';

// Export routes
export { createPipelineRoutes } from './routes/pipelineRoutes';
export { createDealRoutes } from './routes/dealRoutes';
export { createActivityRoutes } from './routes/activityRoutes';
export { default as dealEmailRoutes } from './routes/dealEmailRoutes';
