/**
 * ICP Validator Tool - Validates ICP structure and completeness
 */

import { tool } from 'ai';
import { z } from 'zod';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  completeness: number;
}

function validateICP(icp: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let fieldCount = 0;
  let filledCount = 0;

  // Required top-level fields
  const requiredFields = [
    'icp_summary',
    'firmographic_criteria',
    'geographic_targeting',
    'industry_targeting',
    'decision_maker_targeting',
    'messaging_framework',
  ];

  for (const field of requiredFields) {
    fieldCount++;
    if (!icp[field]) {
      errors.push(`Missing required field: ${field}`);
    } else {
      filledCount++;
    }
  }

  // Validate firmographic_criteria
  const firmographic = icp.firmographic_criteria as Record<string, unknown> | undefined;
  if (firmographic) {
    const firmographicFields = ['company_size', 'revenue_range', 'company_stage'];
    for (const field of firmographicFields) {
      fieldCount++;
      if (!firmographic[field]) {
        warnings.push(`Firmographic criteria missing: ${field}`);
      } else {
        filledCount++;
      }
    }
  }

  // Validate geographic_targeting
  const geographic = icp.geographic_targeting as Record<string, unknown> | undefined;
  if (geographic) {
    fieldCount++;
    const markets = geographic.markets as unknown[] | undefined;
    if (!markets || markets.length === 0) {
      warnings.push('No target markets defined');
    } else {
      filledCount++;
    }
  }

  // Validate industry_targeting
  const industryTargeting = icp.industry_targeting as Record<string, unknown> | undefined;
  if (industryTargeting) {
    fieldCount++;
    const industries = industryTargeting.industries as unknown[] | undefined;
    if (!industries || industries.length === 0) {
      warnings.push('No target industries defined');
    } else {
      filledCount++;
    }
  }

  // Validate decision_maker_targeting
  const decisionMaker = icp.decision_maker_targeting as Record<string, unknown> | undefined;
  if (decisionMaker) {
    const decisionMakerFields = ['titles', 'seniority_levels'];
    for (const field of decisionMakerFields) {
      fieldCount++;
      const value = decisionMaker[field] as unknown[] | undefined;
      if (!value || value.length === 0) {
        warnings.push(`Decision maker targeting missing: ${field}`);
      } else {
        filledCount++;
      }
    }
  }

  // Validate messaging_framework
  const messaging = icp.messaging_framework as Record<string, unknown> | undefined;
  if (messaging) {
    const messagingFields = ['value_proposition', 'pain_points', 'key_benefits'];
    for (const field of messagingFields) {
      fieldCount++;
      if (!messaging[field]) {
        warnings.push(`Messaging framework missing: ${field}`);
      } else {
        filledCount++;
      }
    }
  }

  const completeness = fieldCount > 0 ? Math.round((filledCount / fieldCount) * 100) : 0;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    completeness,
  };
}

export const icpValidatorTool = tool({
  description: 'Validate an Ideal Customer Profile (ICP) for completeness and correctness',
  inputSchema: z.object({
    icp: z.record(z.unknown()).describe('The ICP object to validate'),
  }),
  execute: async ({ icp }) => {
    const result = validateICP(icp);

    return {
      success: true,
      validation: result,
      summary: result.isValid
        ? `ICP is valid with ${result.completeness}% completeness`
        : `ICP has ${result.errors.length} errors and ${result.warnings.length} warnings`,
    };
  },
});
