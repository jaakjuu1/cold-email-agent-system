/**
 * Tools Index - Export all AI SDK tools
 * These tools replace the Python skills from .claude/skills/
 */

// Client Discovery Tools
export { websiteAnalyzerTool } from './website-analyzer.js';
export { marketResearcherTool } from './market-researcher.js';
export { icpValidatorTool } from './icp-validator.js';

// Lead Discovery Tools
export { googleMapsScraperTool, executeGoogleMapsScraper } from './google-maps-scraper.js';
export { prospectParserTool, executeProspectParser } from './prospect-parser.js';
export { companyEnricherTool, executeCompanyEnricher } from './company-enricher.js';
export { contactFinderTool } from './contact-finder.js';
export { smartContactExtractorTool, executeSmartContactExtractor } from './smart-contact-extractor.js';
export type { ExtractedContact } from './smart-contact-extractor.js';
export { dataValidatorTool, executeDataValidator } from './data-validator.js';

// Email Tools
export { emailQualityCheckerTool } from './email-quality-checker.js';

// Tracking Tools
export { responseClassifierTool, classifyResponse } from './response-classifier.js';
export type { ResponseClassification } from './response-classifier.js';
export { bounceDetectorTool, analyzeBounce, processBounce } from './bounce-detector.js';
export type { BounceAnalysis } from './bounce-detector.js';
export { engagementScorerTool, processEngagement, calculateEngagementScore } from './engagement-scorer.js';
export type { EngagementScore } from './engagement-scorer.js';

// Campaign Management Tools
export { rateLimiterTool } from './rate-limiter.js';

// Deep Research Tools
export { deepResearcherTool, executeDeepResearcher } from './deep-researcher.js';
export type { DeepResearchParams, DeepResearchOutput } from './deep-researcher.js';
