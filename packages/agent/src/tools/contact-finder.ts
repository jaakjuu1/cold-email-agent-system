/**
 * Contact Finder Tool - Discovers decision maker contact information using Hunter.io and Apollo
 */

import { tool } from 'ai';
import { z } from 'zod';

interface Contact {
  name: string;
  title: string;
  email?: string;
  linkedin_url?: string;
  confidence: number;
  source: string;
  is_primary?: boolean;
}

interface Prospect {
  id: string;
  company_name: string;
  domain?: string;
  [key: string]: unknown;
}

interface ProspectWithContacts extends Prospect {
  contacts: Contact[];
}

async function searchHunter(domain: string, apiKey: string): Promise<Contact[]> {
  try {
    const params = new URLSearchParams({
      domain,
      api_key: apiKey,
      limit: '5',
    });

    const response = await fetch(
      `https://api.hunter.io/v2/domain-search?${params}`,
      { signal: AbortSignal.timeout(30000) }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json() as { data?: { emails?: Array<{
      first_name?: string;
      last_name?: string;
      position?: string;
      value?: string;
      confidence?: number;
    }> } };
    const emails = data.data?.emails || [];

    return emails.map((email: {
      first_name?: string;
      last_name?: string;
      position?: string;
      value?: string;
      confidence?: number;
    }) => ({
      name: `${email.first_name || ''} ${email.last_name || ''}`.trim(),
      title: email.position || '',
      email: email.value,
      confidence: email.confidence || 0,
      source: 'hunter',
    }));
  } catch {
    return [];
  }
}

async function searchApollo(
  domain: string,
  apiKey: string,
  titles: string[]
): Promise<Contact[]> {
  try {
    const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        q_organization_domains: domain,
        person_titles: titles,
        per_page: 5,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json() as { people?: Array<{
      name?: string;
      title?: string;
      email?: string;
      linkedin_url?: string;
    }> };
    const people = data.people || [];

    return people.map((person: {
      name?: string;
      title?: string;
      email?: string;
      linkedin_url?: string;
    }) => ({
      name: person.name || '',
      title: person.title || '',
      email: person.email,
      linkedin_url: person.linkedin_url,
      confidence: person.email ? 90 : 50,
      source: 'apollo',
    }));
  } catch {
    return [];
  }
}

async function findContactsForProspect(
  prospect: Prospect,
  hunterKey: string | undefined,
  apolloKey: string | undefined,
  targetTitles: string[]
): Promise<ProspectWithContacts> {
  const domain = prospect.domain;

  if (!domain) {
    return { ...prospect, contacts: [] };
  }

  const contacts: Contact[] = [];

  // Search Hunter.io
  if (hunterKey) {
    const hunterContacts = await searchHunter(domain, hunterKey);
    contacts.push(...hunterContacts);
  }

  // Search Apollo
  if (apolloKey) {
    const apolloContacts = await searchApollo(domain, apolloKey, targetTitles);
    contacts.push(...apolloContacts);
  }

  // Deduplicate by email
  const seenEmails = new Set<string>();
  const uniqueContacts: Contact[] = [];

  for (const contact of contacts) {
    if (contact.email && seenEmails.has(contact.email)) {
      continue;
    }
    if (contact.email) {
      seenEmails.add(contact.email);
    }
    uniqueContacts.push(contact);
  }

  // Sort by confidence
  uniqueContacts.sort((a, b) => b.confidence - a.confidence);

  // Mark primary contact
  if (uniqueContacts.length > 0 && uniqueContacts[0]) {
    uniqueContacts[0].is_primary = true;
    for (let i = 1; i < uniqueContacts.length; i++) {
      const contact = uniqueContacts[i];
      if (contact) {
        contact.is_primary = false;
      }
    }
  }

  return {
    ...prospect,
    contacts: uniqueContacts.slice(0, 5), // Keep top 5
  };
}

export const contactFinderTool = tool({
  description: 'Find decision maker contacts for prospects using Hunter.io and Apollo APIs',
  inputSchema: z.object({
    prospects: z.array(z.object({
      id: z.string(),
      company_name: z.string(),
      domain: z.string().optional(),
    }).passthrough()).describe('Array of prospects to find contacts for'),
    targetTitles: z.array(z.string()).default([
      'CEO', 'CTO', 'VP Engineering', 'Director of Engineering', 'Founder',
    ]).describe('Job titles to search for'),
    maxProcess: z.number().default(20).describe('Maximum number of prospects to process'),
    delayMs: z.number().default(1000).describe('Delay between API calls in milliseconds'),
  }),
  execute: async ({ prospects, targetTitles, maxProcess, delayMs }) => {
    const hunterKey = process.env.HUNTER_API_KEY;
    const apolloKey = process.env.APOLLO_API_KEY;

    if (!hunterKey && !apolloKey) {
      return {
        success: false,
        error: 'Neither HUNTER_API_KEY nor APOLLO_API_KEY configured',
      };
    }

    const results: ProspectWithContacts[] = [];
    let totalContacts = 0;

    for (let i = 0; i < prospects.length; i++) {
      const prospect = prospects[i] as Prospect;

      if (i < maxProcess && prospect.domain) {
        const withContacts = await findContactsForProspect(
          prospect,
          hunterKey,
          apolloKey,
          targetTitles
        );
        results.push(withContacts);
        totalContacts += withContacts.contacts.length;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        results.push({ ...prospect, contacts: [] });
      }
    }

    return {
      success: true,
      total_prospects: results.length,
      contacts_found: totalContacts,
      prospects: results,
    };
  },
});
