import { db } from './index.js';
import { categories, quickActions } from '@finanz/db/schema';
import { eq, isNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface ParsedTransaction {
  amountCents: number;
  date: Date;
  direction: 'expense' | 'income';
  merchant: string | null;
  category: string | null;
  note: string | null;
  confidence: number;
}

// Amount regex patterns
const AMOUNT_PATTERNS = [
  // "14,80 text" or "14.80 text" or "14 text" or "1,2k text"
  /^(\d+(?:[.,]\d{1,2})?k?)\s*€?\s+(.+)$/i,
  // "text 14,80" or "text 14.80" or "text 1,2k"
  /^(.+?)\s+(\d+(?:[.,]\d{1,2})?k?)\s*€?$/i,
  // Date prefix: "gestern 14,80 text"
  /^(gestern|heute|vorgestern)\s+(\d+(?:[.,]\d{1,2})?k?)\s*€?\s+(.+)$/i,
];

function parseAmount(str: string): number | null {
  let cleaned = str.trim().toLowerCase();

  // Handle k suffix
  if (cleaned.endsWith('k')) {
    cleaned = cleaned.slice(0, -1);
    const num = parseFloat(cleaned.replace(',', '.'));
    if (isNaN(num)) return null;
    return Math.round(num * 1000 * 100);
  }

  // German to decimal
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return Math.round(num * 100);
}

function parseDate(text: string): Date {
  const now = new Date();
  const lower = text.toLowerCase();

  if (lower === 'gestern') {
    now.setDate(now.getDate() - 1);
  } else if (lower === 'vorgestern') {
    now.setDate(now.getDate() - 2);
  }

  return now;
}

const INCOME_KEYWORDS = ['gehalt', 'lohn', 'kindergeld', 'überstunden', 'überweisung', 'einnahme', 'zinsen', 'dividende', 'rückzahlung'];

function detectDirection(text: string): 'expense' | 'income' {
  const lower = text.toLowerCase();

  // Explicit plus sign indicates income
  if (/\+\s*\d/.test(text) || /^\s*\+/.test(text)) {
    return 'income';
  }

  for (const keyword of INCOME_KEYWORDS) {
    if (lower.includes(keyword)) {
      return 'income';
    }
  }

  return 'expense';
}

async function findCategoryByKeyword(text: string): Promise<string | null> {
  const lower = text.toLowerCase();

  // Check quick actions first
  const allQuickActions = await db.query.quickActions.findMany({
    where: isNull(quickActions.archivedAt),
    with: { category: true },
  });

  for (const qa of allQuickActions) {
    if (!lower.includes(qa.keyword.toLowerCase())) continue;

    if (qa.category) {
      return qa.category.name;
    }
    if (qa.categoryId != null) {
      const cat = await db.query.categories.findFirst({
        where: eq(categories.id, qa.categoryId),
      });
      if (cat) return cat.name;
    }
  }

  // Check category keywords
  const allCategories = await db.query.categories.findMany({
    where: isNull(categories.archivedAt),
  });

  for (const cat of allCategories) {
    if (cat.keywords && cat.keywords.length > 0) {
      for (const keyword of cat.keywords) {
        if (lower.includes(keyword.toLowerCase())) {
          return cat.name;
        }
      }
    }
  }

  return null;
}

export async function parseTransaction(text: string): Promise<ParsedTransaction | null> {
  const direction = detectDirection(text);
  // Strip leading plus sign for amount parsing
  const sanitizedText = text.replace(/^\s*\+/, '').replace(/(\s|^)\+\s*(?=\d)/, '$1');

  let amountCents: number | null = null;
  let restText = sanitizedText;
  let date = new Date();

  // Try date prefix pattern first
  const dateMatch = sanitizedText.match(AMOUNT_PATTERNS[2]);
  if (dateMatch) {
    date = parseDate(dateMatch[1]);
    amountCents = parseAmount(dateMatch[2]);
    restText = dateMatch[3];
  } else {
    // Try amount at start
    const startMatch = sanitizedText.match(AMOUNT_PATTERNS[0]);
    if (startMatch) {
      amountCents = parseAmount(startMatch[1]);
      restText = startMatch[2];
    } else {
      // Try amount at end
      const endMatch = sanitizedText.match(AMOUNT_PATTERNS[1]);
      if (endMatch) {
        restText = endMatch[1];
        amountCents = parseAmount(endMatch[2]);
      }
    }
  }

  if (amountCents === null) {
    // Try LLM fallback
    return await llmParse(text, direction);
  }

  // Find category by keyword
  const category = await findCategoryByKeyword(restText);

  // Extract merchant (first word that might be a name)
  const words = restText.trim().split(/\s+/);
  let merchant: string | null = null;
  let note: string | null = null;

  if (words.length > 0) {
    // Check if first word looks like a merchant
    const firstWord = words[0];
    if (/^[A-ZÄÖÜ]/.test(firstWord) || firstWord.length > 3) {
      merchant = firstWord;
      if (words.length > 1) {
        // Check for "mit" pattern for notes
        const mitIndex = words.findIndex((w) => w.toLowerCase() === 'mit');
        if (mitIndex > 0) {
          note = words.slice(mitIndex).join(' ');
        }
      }
    }
  }

  const confidence = category ? 0.95 : 0.6;

  return {
    amountCents,
    date,
    direction,
    merchant,
    category,
    note,
    confidence,
  };
}

async function llmParse(text: string, fallbackDirection: 'expense' | 'income'): Promise<ParsedTransaction | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('No API key, skipping LLM parse');
    return null;
  }

  const allCategories = await db.query.categories.findMany({
    where: isNull(categories.archivedAt),
  });

  const categoryNames = allCategories.map((c) => c.name).join(', ');

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: process.env.PARSER_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Parse this German financial text and return JSON only. Available categories: ${categoryNames}

Text: "${text}"

Return JSON:
{
  "amount_cents": number,
  "date": "YYYY-MM-DD",
  "direction": "expense" | "income",
  "merchant": string or null,
  "category": one of the available categories or null,
  "note": string or null,
  "confidence": 0.0-1.0
}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') return null;

    const json = JSON.parse(content.text);

    return {
      amountCents: json.amount_cents,
      date: new Date(json.date),
      direction: json.direction === 'income' ? 'income' : fallbackDirection,
      merchant: json.merchant,
      category: json.category,
      note: json.note,
      confidence: json.confidence || 0.7,
    };
  } catch (error) {
    console.error('LLM parse error:', error);
    return null;
  }
}
