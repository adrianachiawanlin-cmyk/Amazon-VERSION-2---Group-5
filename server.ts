import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { PRODUCTS } from './src/data/catalog.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

interface MoodRecommendationItem {
  productId: string;
  reason: string;
}

interface MoodRecommendationPayload {
  affirmation: string;
  summary: string;
  recommendations: MoodRecommendationItem[];
}

async function generateWithRetry(moodText: string): Promise<MoodRecommendationPayload> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Object.assign(
      new Error('GEMINI_API_KEY is not configured. Check your Settings > Secrets panel.'),
      { statusCode: 500 }
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const catalogContext = PRODUCTS.map((p) => ({
    id: p.id,
    title: p.title,
    brand: p.brand,
    category: p.category,
    priceSGD: p.price,
    description: p.description,
  }));

  const prompt = `A shopper on Amazon.sg entered their mood/plan for the day: "${moodText}".
Write one uplifting daily positive affirmation tailored to their mood, then select 3 or 4 suitable products exclusively from the catalog below and explain briefly why each fits their mood today.

Catalog JSON:
${JSON.stringify(catalogContext)}`;

  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are a helpful Singapore retail merchandiser for Amazon.sg. Return concise, natural recommendations using only product IDs present in the provided catalog.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              affirmation: {
                type: Type.STRING,
                description:
                  'One warm, uplifting daily positive affirmation tailored to the user mood, plain text without emojis or hashtags.',
              },
              summary: {
                type: Type.STRING,
                description:
                  'One warm, natural sentence acknowledging the user mood and framing the picks.',
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    productId: {
                      type: Type.STRING,
                      description: 'Exact id of a product from the provided catalog.',
                    },
                    reason: {
                      type: Type.STRING,
                      description: 'One short sentence explaining why this product fits their mood today.',
                    },
                  },
                  required: ['productId', 'reason'],
                },
              },
            },
            required: ['affirmation', 'summary', 'recommendations'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new Error('Empty response from recommendation service.');
      }

      const parsed = JSON.parse(rawText) as MoodRecommendationPayload;
      const validIds = new Set(PRODUCTS.map((p) => p.id));
      const seen = new Set<string>();
      const validRecs = (parsed.recommendations || []).filter((item) => {
        if (!item?.productId || !validIds.has(item.productId) || seen.has(item.productId)) {
          return false;
        }
        seen.add(item.productId);
        return true;
      });

      return {
        affirmation:
          parsed.affirmation ||
          'Today holds steady moments of comfort, focus, and simple joys.',
        summary: parsed.summary || 'Here are curated Amazon.sg picks tailored to your day.',
        recommendations: validRecs.slice(0, 4),
      };
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      const isTransient =
        message.includes('429') ||
        message.includes('503') ||
        message.includes('RESOURCE_EXHAUSTED') ||
        message.includes('UNAVAILABLE');
      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * Math.pow(2, attempt - 1)));
    }
  }

  throw lastError;
}

interface ChatMessageInput {
  role: 'user' | 'model';
  text: string;
}

interface ShopperChatPayload {
  reply: string;
  suggestedProductIds: string[];
}

async function generateChatWithRetry(
  messages: ChatMessageInput[],
  deliveryLocation?: string,
  cartSummary?: { title: string; quantity: number }[]
): Promise<ShopperChatPayload> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Object.assign(
      new Error('GEMINI_API_KEY is not configured. Check your Settings > Secrets panel.'),
      { statusCode: 500 }
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const catalogContext = PRODUCTS.map((p) => ({
    id: p.id,
    title: p.title,
    brand: p.brand,
    category: p.category,
    priceSGD: p.price,
    originalPriceSGD: p.originalPrice ?? null,
    discountPercent: p.discountPercent ?? null,
    isPrime: p.isPrime,
    isDeal: Boolean(p.isDeal),
    stockLeft: p.stockLeft,
    activeViewers: p.activeViewers,
    deliveryText: p.deliveryText,
    description: p.description,
  }));

  const contents = messages.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.text }],
  }));

  const systemInstruction = `You are the Amazon.sg Live Shopper Assistant helping shoppers on the Amazon.sg storefront.
Be warm, concise, accurate, and helpful. Answer questions about product specs, prices in SGD (S$), stock left, deals, Prime benefits, Singapore delivery slots (Morning 9am-12pm, Afternoon 12pm-3pm, Evening 3pm-6pm, Night 6pm-10pm, and 2-Hour Express), free delivery over S$40 (or free with Prime, S$60 for Amazon Fresh), and returns.
Only reference products, prices, and stock levels that exist in the provided catalog JSON. Never invent products or fake prices.
If relevant products help answer the shopper's query, include up to 3 exact product IDs in suggestedProductIds; otherwise return an empty array.

Shopper context:
- Delivery location: ${deliveryLocation || 'Singapore'}
- Current cart: ${cartSummary && cartSummary.length > 0 ? JSON.stringify(cartSummary) : 'Empty'}

Amazon.sg Catalog JSON:
${JSON.stringify(catalogContext)}`;

  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description:
                  'Helpful, concise plain-text reply to the shopper query without markdown code blocks.',
              },
              suggestedProductIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  'Up to 3 exact product ids from the catalog that directly help the shopper, or empty array.',
              },
            },
            required: ['reply', 'suggestedProductIds'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new Error('Empty response from shopper assistant.');
      }

      const parsed = JSON.parse(rawText) as ShopperChatPayload;
      const validIds = new Set(PRODUCTS.map((p) => p.id));
      const seen = new Set<string>();
      const validProductIds = (parsed.suggestedProductIds || []).filter((id) => {
        if (!id || !validIds.has(id) || seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      return {
        reply: parsed.reply || 'How can I help you find something on Amazon.sg today?',
        suggestedProductIds: validProductIds.slice(0, 3),
      };
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      const isTransient =
        message.includes('429') ||
        message.includes('503') ||
        message.includes('RESOURCE_EXHAUSTED') ||
        message.includes('UNAVAILABLE');
      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * Math.pow(2, attempt - 1)));
    }
  }

  throw lastError;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.post('/api/mood-recommendations', async (req: Request, res: Response) => {
    const moodRaw = typeof req.body?.mood === 'string' ? req.body.mood.trim() : '';
    if (!moodRaw) {
      res.status(400).json({ error: 'Please enter how you are feeling or planning for today.' });
      return;
    }
    if (moodRaw.length > 300) {
      res.status(400).json({ error: 'Please keep your mood prompt under 300 characters.' });
      return;
    }

    try {
      const result = await generateWithRetry(moodRaw);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to generate recommendations right now.';
      let status = 500;
      if (
        typeof err === 'object' &&
        err !== null &&
        'statusCode' in err &&
        typeof (err as { statusCode: unknown }).statusCode === 'number'
      ) {
        status = (err as { statusCode: number }).statusCode;
      } else if (message.includes('API_KEY_INVALID') || message.includes('PERMISSION_DENIED')) {
        status = 403;
      } else if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
        status = 429;
      }

      res.status(status).json({
        error:
          status === 403
            ? 'API key verification failed. Please check your key in Settings > Secrets.'
            : message,
      });
    }
  });

  app.post('/api/shopper-chat', async (req: Request, res: Response) => {
    const rawMessages: unknown[] = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const cleanedMessages: ChatMessageInput[] = rawMessages
      .filter(
        (m: unknown): m is ChatMessageInput =>
          typeof m === 'object' &&
          m !== null &&
          ((m as ChatMessageInput).role === 'user' || (m as ChatMessageInput).role === 'model') &&
          typeof (m as ChatMessageInput).text === 'string' &&
          (m as ChatMessageInput).text.trim().length > 0
      )
      .slice(-12)
      .map((m: ChatMessageInput) => ({ role: m.role, text: m.text.trim().slice(0, 600) }));

    if (cleanedMessages.length === 0 || cleanedMessages[cleanedMessages.length - 1].role !== 'user') {
      res.status(400).json({ error: 'Please enter a message for the Amazon.sg assistant.' });
      return;
    }

    const deliveryLocation =
      typeof req.body?.deliveryLocation === 'string' ? req.body.deliveryLocation.slice(0, 80) : undefined;
    const cartSummary = Array.isArray(req.body?.cartSummary)
      ? req.body.cartSummary
          .filter(
            (item: unknown): item is { title: string; quantity: number } =>
              typeof item === 'object' &&
              item !== null &&
              typeof (item as { title: unknown }).title === 'string' &&
              typeof (item as { quantity: unknown }).quantity === 'number'
          )
          .slice(0, 20)
      : undefined;

    try {
      const result = await generateChatWithRetry(cleanedMessages, deliveryLocation, cartSummary);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to reply right now.';
      let status = 500;
      if (
        typeof err === 'object' &&
        err !== null &&
        'statusCode' in err &&
        typeof (err as { statusCode: unknown }).statusCode === 'number'
      ) {
        status = (err as { statusCode: number }).statusCode;
      } else if (message.includes('API_KEY_INVALID') || message.includes('PERMISSION_DENIED')) {
        status = 403;
      } else if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
        status = 429;
      }

      res.status(status).json({
        error:
          status === 403
            ? 'API key verification failed. Please check your key in Settings > Secrets.'
            : message,
      });
    }
  });

  const distDir = path.resolve(__dirname, 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distDir);

  if (isProd) {
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
