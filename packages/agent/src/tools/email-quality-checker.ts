/**
 * Email Quality Checker Tool - Validates email quality and deliverability
 */

import { tool } from 'ai';
import { z } from 'zod';

// Spam trigger words to avoid
const SPAM_TRIGGERS = [
  'act now', 'limited time', 'urgent', 'click here', 'buy now',
  'free', 'guarantee', 'no obligation', 'winner', 'congratulations',
  '100%', 'amazing deal', 'best price', 'bonus', 'cash',
  'cheap', 'credit', 'discount', 'double your', 'earn money',
  'extra income', 'fast cash', 'for free', 'get paid', 'incredible',
  'info you requested', 'limited offer', 'make money', 'million',
  'no cost', 'offer', 'opportunity', 'order now', 'please read',
  'promise', 'pure profit', 'risk-free', 'satisfaction', 'save big',
  'special promotion', "this isn't spam", 'unbelievable', 'unlimited',
  'while supplies last', 'why pay more',
];

// Generic phrases to avoid
const GENERIC_PHRASES = [
  'hope this email finds you well',
  "i hope you're doing well",
  'i wanted to reach out',
  'just following up',
  'touching base',
  'circling back',
  'per my last email',
  'as discussed',
  'i am writing to',
  'my name is',
  "i'm reaching out because",
  'we are a leading',
  'industry-leading',
  'best-in-class',
  'synergy',
  'leverage',
  'paradigm',
  'disruptive',
];

interface QualityResult {
  score: number;
  grade: string;
  feedback: string[];
  warnings: string[];
  recommendations: string[];
}

function checkSpamScore(text: string): { penalty: number; triggers: string[] } {
  const textLower = text.toLowerCase();
  const foundTriggers = SPAM_TRIGGERS.filter(trigger => textLower.includes(trigger));
  const penalty = Math.min(foundTriggers.length * 10, 50);
  return { penalty, triggers: foundTriggers };
}

function checkGenericPhrases(text: string): { penalty: number; phrases: string[] } {
  const textLower = text.toLowerCase();
  const foundPhrases = GENERIC_PHRASES.filter(phrase => textLower.includes(phrase));
  const penalty = Math.min(foundPhrases.length * 5, 30);
  return { penalty, phrases: foundPhrases };
}

function checkLength(text: string, maxLength = 150): { penalty: number; feedback: string } {
  const words = text.split(/\s+/).length;

  if (words <= maxLength) {
    return { penalty: 0, feedback: `${words} words (good)` };
  } else if (words <= maxLength * 1.5) {
    return { penalty: 10, feedback: `${words} words (slightly long)` };
  } else {
    return { penalty: 25, feedback: `${words} words (too long, aim for ${maxLength})` };
  }
}

function checkPersonalization(text: string, subject: string): { bonus: number; indicators: string[] } {
  const indicators: string[] = [];
  let bonus = 0;

  // Check for placeholders
  if (text.includes('{{') || text.includes('{')) {
    indicators.push('Has dynamic placeholders');
    bonus += 5;
  }

  // Check for specific company mentions
  if (/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/.test(text)) {
    indicators.push('Contains proper nouns');
    bonus += 5;
  }

  // Check subject line personalization
  if (subject.includes('{{') || /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/.test(subject)) {
    indicators.push('Subject line personalized');
    bonus += 10;
  }

  if (indicators.length === 0) {
    return { bonus: -15, indicators: ['No personalization detected'] };
  }

  return { bonus, indicators };
}

function checkCTA(text: string): { penalty: number; feedback: string } {
  const textLower = text.toLowerCase();

  const ctaPatterns = [
    /\?$/m,
    /(let me know|let's|would you|are you|can we|shall we)/,
    /(reply|respond|get back|reach out)/,
    /(schedule|book|set up|arrange)/,
    /(interested|curious|open to)/,
  ];

  for (const pattern of ctaPatterns) {
    if (pattern.test(textLower)) {
      return { penalty: 0, feedback: 'Has clear CTA' };
    }
  }

  return { penalty: 15, feedback: 'Missing clear call-to-action' };
}

function checkSubjectLine(subject: string): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 0;

  const words = subject.split(/\s+/).length;

  if (words < 3) {
    issues.push('Subject too short');
    score -= 10;
  } else if (words > 10) {
    issues.push('Subject too long');
    score -= 10;
  }

  if (subject === subject.toUpperCase() && subject.length > 3) {
    issues.push('Subject is all caps (looks spammy)');
    score -= 15;
  }

  if ((subject.match(/!/g) || []).length > 1) {
    issues.push('Too many exclamation marks');
    score -= 10;
  }

  if (/^(re:|fwd?:)/i.test(subject)) {
    issues.push('Fake RE:/FWD: prefix (unethical)');
    score -= 20;
  }

  if (issues.length === 0) {
    return { score: 5, issues: ['Subject line looks good'] };
  }

  return { score, issues };
}

function getGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function getRecommendations(score: number, warnings: string[], feedback: string[]): string[] {
  const recommendations: string[] = [];

  if (score < 80) {
    if (warnings.some(w => w.toLowerCase().includes('spam'))) {
      recommendations.push('Remove spam trigger words to improve deliverability');
    }

    if (warnings.some(w => w.toLowerCase().includes('generic'))) {
      recommendations.push('Replace generic phrases with specific, personalized content');
    }

    if (feedback.some(f => f.toLowerCase().includes('long'))) {
      recommendations.push('Shorten the email - aim for 100-150 words');
    }

    if (feedback.some(f => f.toLowerCase().includes('no personalization'))) {
      recommendations.push("Add specific details about the prospect's company");
    }

    if (feedback.some(f => f.toLowerCase().includes('missing') && f.toLowerCase().includes('cta'))) {
      recommendations.push('Add a clear call-to-action (question or specific ask)');
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('Email looks good! Consider A/B testing subject lines.');
  }

  return recommendations;
}

function calculateQualityScore(subject: string, body: string): QualityResult {
  const fullText = `${subject}\n${body}`;
  let score = 100;
  const feedback: string[] = [];
  const warnings: string[] = [];

  // Spam check
  const { penalty: spamPenalty, triggers } = checkSpamScore(fullText);
  score -= spamPenalty;
  if (triggers.length > 0) {
    warnings.push(`Spam triggers found: ${triggers.join(', ')}`);
  }

  // Generic phrases check
  const { penalty: genericPenalty, phrases } = checkGenericPhrases(fullText);
  score -= genericPenalty;
  if (phrases.length > 0) {
    warnings.push(`Generic phrases found: ${phrases.join(', ')}`);
  }

  // Length check
  const { penalty: lengthPenalty, feedback: lengthFeedback } = checkLength(body);
  score -= lengthPenalty;
  feedback.push(`Length: ${lengthFeedback}`);

  // Personalization check
  const { bonus: persBonus, indicators } = checkPersonalization(body, subject);
  score += persBonus;
  feedback.push(...indicators);

  // CTA check
  const { penalty: ctaPenalty, feedback: ctaFeedback } = checkCTA(body);
  score -= ctaPenalty;
  feedback.push(`CTA: ${ctaFeedback}`);

  // Subject line check
  const { score: subjScore, issues: subjIssues } = checkSubjectLine(subject);
  score += subjScore;
  feedback.push(...subjIssues);

  // Ensure score is between 0 and 100
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    grade: getGrade(score),
    feedback,
    warnings,
    recommendations: getRecommendations(score, warnings, feedback),
  };
}

export const emailQualityCheckerTool = tool({
  description: 'Check email quality including spam triggers, generic phrases, length, personalization, and CTA',
  inputSchema: z.object({
    subject: z.string().describe('Email subject line'),
    body: z.string().describe('Email body content'),
    minScore: z.number().default(70).describe('Minimum acceptable score'),
  }),
  execute: async ({ subject, body, minScore }) => {
    const result = calculateQualityScore(subject, body);
    const passed = result.score >= minScore;

    return {
      success: true,
      passed,
      quality: result,
      summary: `Score: ${result.score}/100 (Grade: ${result.grade}) - ${passed ? 'PASSED' : 'FAILED'}`,
    };
  },
});
