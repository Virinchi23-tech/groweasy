import { OpenAI } from 'openai';
import { aiLogger } from '../utils/logger';
import { CRM_STATUSES, DATA_SOURCES, LeadValidationSchema } from '@groweasy/shared';

let openai: OpenAI | null = null;

const getOpenAIClient = () => {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here' || apiKey.trim() === '') {
      return null;
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
};

// Heuristic fallback mapper when OpenAI key is not configured
const mapHeuristically = (records: any[]): any[] => {
  aiLogger.info('Using heuristic rule-based mapping fallback.');
  
  return records.map((record) => {
    const keys = Object.keys(record);
    const getVal = (regex: RegExp): string => {
      const match = keys.find(k => regex.test(k.toLowerCase()));
      return match ? String(record[match] || '').trim() : '';
    };

    // Extract emails
    const emails: string[] = [];
    keys.forEach(k => {
      if (/email|mail/i.test(k.toLowerCase()) && record[k]) {
        const emailMatch = String(record[k]).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
        if (emailMatch) emails.push(...emailMatch);
      }
    });

    // Extract phone numbers
    const phones: string[] = [];
    keys.forEach(k => {
      if (/phone|mobile|tel|contact|number/i.test(k.toLowerCase()) && record[k]) {
        const cleaned = String(record[k]).replace(/[^\d+]/g, '');
        if (cleaned.length >= 7) phones.push(cleaned);
      }
    });

    const email = emails[0] || null;
    const mobile_without_country_code = phones[0] || null;
    const extraEmails = emails.slice(1);
    const extraPhones = phones.slice(1);

    // Merge unused columns into notes
    const extraDetails: string[] = [];
    if (extraEmails.length > 0) extraDetails.push(`Extra emails: ${extraEmails.join(', ')}`);
    if (extraPhones.length > 0) extraDetails.push(`Extra phones: ${extraPhones.join(', ')}`);

    keys.forEach(k => {
      const kl = k.toLowerCase();
      if (!/name|email|mail|phone|mobile|tel|contact|number|status|source|time|desc/i.test(kl)) {
        if (record[k]) extraDetails.push(`${k}: ${record[k]}`);
      }
    });

    const crm_note = extraDetails.join(' | ');

    // Guess status
    let crm_status = 'GOOD_LEAD_FOLLOW_UP';
    const statusVal = getVal(/status/i);
    if (statusVal) {
      const matchingStatus = CRM_STATUSES.find(s => s.toLowerCase() === statusVal.toLowerCase() || statusVal.toLowerCase().includes(s.toLowerCase()));
      if (matchingStatus) crm_status = matchingStatus;
    }

    // Guess data source
    let data_source = null;
    const sourceVal = getVal(/source/i);
    if (sourceVal) {
      const matchingSource = DATA_SOURCES.find(s => s.toLowerCase() === sourceVal.toLowerCase() || sourceVal.toLowerCase().includes(s.toLowerCase()));
      if (matchingSource) data_source = matchingSource;
    }

    return {
      created_at: getVal(/date|create|time/i) || new Date().toISOString(),
      name: getVal(/name|client|customer|lead/i) || 'Unknown Lead',
      email,
      country_code: getVal(/country.*code|zip/i) || '91',
      mobile_without_country_code,
      company: getVal(/company|org|firm|business/i) || null,
      city: getVal(/city|town/i) || null,
      state: getVal(/state|region/i) || null,
      country: getVal(/country|nation/i) || null,
      lead_owner: getVal(/owner|agent|assign/i) || 'System',
      crm_status,
      crm_note,
      data_source,
      possession_time: getVal(/possession|move|ready/i) || null,
      description: getVal(/desc|remark|comment|note/i) || null,
    };
  });
};

export interface AIMapResult {
  success: boolean;
  records: any[];
  error?: string;
}

export const mapRecordsWithAI = async (
  records: any[],
  headers: string[]
): Promise<AIMapResult> => {
  const client = getOpenAIClient();

  if (!client) {
    const heuristicResults = mapHeuristically(records);
    return { success: true, records: heuristicResults };
  }

  try {
    aiLogger.info(`Sending batch of ${records.length} records to OpenAI.`);

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const systemPrompt = `You are an AI assistant designed to map CRM leads data from arbitrary CSV columns to a target CRM schema for GrowEasy.
Your task is to analyze the input batch of row records (provided as a JSON array of raw key-value objects) and translate each row into our structured format.

Target CRM Fields to map:
- created_at: Date/time string. Must be parsable using 'new Date(created_at)'.
- name: Full name of the lead. Fallback to 'Unknown' if missing.
- email: First email address. If multiple emails, use the first one, store the remaining emails in 'crm_note'.
- country_code: Telephone country code (e.g. 91, 1).
- mobile_without_country_code: Mobile number. Use the first number, and append any remaining numbers to 'crm_note'.
- company: Organization or company name.
- city: City location.
- state: State/Province/Region location.
- country: Country location.
- lead_owner: CRM Owner assigned to this lead.
- crm_status: Strictly must be one of: [GOOD_LEAD_FOLLOW_UP, DID_NOT_CONNECT, BAD_LEAD, SALE_DONE]. Default to GOOD_LEAD_FOLLOW_UP. Do NOT invent new statuses.
- crm_note: Store any extra notes, observations, remarks, comments, secondary emails, or secondary phone numbers here.
- data_source: Strictly must be one of: [leads_on_demand, meridian_tower, eden_park, varah_swamy, sarjapur_plots] or left blank. Do not invent new sources.
- possession_time: Estimated time of buying/moving/possession.
- description: Lead description or comments.

Mapping Rules:
1. Column independent: The input records will have arbitrary column names. Infer their meanings intelligently (e.g. "Primary Contact" -> mobile_without_country_code, "Cust Name" -> name).
2. Skip rules: If both email AND mobile_without_country_code are missing/blank, do NOT include the record in the 'records' array. The record is skipped.
3. Strict statuses: Normalize status fields to match the crm_status enum exactly.
4. Clean JSON: Your response must be a single, valid JSON object containing a "success": true field and a "records" array of the mapped leads. No markdown wrap, no conversational text.

Response JSON Schema:
{
  "success": true,
  "records": [
    {
      "created_at": "...",
      "name": "...",
      "email": "...",
      "country_code": "...",
      "mobile_without_country_code": "...",
      "company": "...",
      "city": "...",
      "state": "...",
      "country": "...",
      "lead_owner": "...",
      "crm_status": "...",
      "crm_note": "...",
      "data_source": "...",
      "possession_time": "...",
      "description": "..."
    }
  ]
}`;

    const userPrompt = `Headers list: ${JSON.stringify(headers)}
Records batch: ${JSON.stringify(records)}`;

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const text = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(text);

    if (parsed.success && Array.isArray(parsed.records)) {
      aiLogger.info(`Successfully mapped batch of ${parsed.records.length} records.`);
      return { success: true, records: parsed.records };
    } else {
      throw new Error('AI response structure was invalid or marked success: false');
    }
  } catch (err: any) {
    aiLogger.error('AI column mapping error', { error: err.message });
    return { success: false, records: [], error: err.message };
  }
};
