import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { IngestService } from '../services/ingestion/IngestService';

const noteSchema = z.object({
  type: z.literal('note'),
  content: z
    .string()
    .trim()
    .min(1, 'Note content must not be empty')
    .max(20_000, 'Note content must be at most 20,000 characters'),
});

const urlSchema = z.object({
  type: z.literal('url'),
  content: z
    .string()
    .url('Must be a valid URL')
    .max(2_048, 'URL must be at most 2,048 characters')
    .refine(
      (val) => val.startsWith('http://') || val.startsWith('https://'),
      'Only http and https URLs are allowed'
    ),
});

const ingestSchema = z.discriminatedUnion('type', [noteSchema, urlSchema]);

type IngestBody = z.infer<typeof ingestSchema>;

export function buildIngestRouter(ingestService: IngestService, rateLimiter?: RequestHandler): Router {
  const router = Router();

  router.post(
    '/ingest',
    ...(rateLimiter !== undefined ? [rateLimiter] : []),
    validate(ingestSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = req.body as IngestBody;
        const { item } = await ingestService.ingest(body.type, body.content);

        // Notes get 201 (item saved synchronously); URLs get 202 (async processing)
        const statusCode = body.type === 'note' ? 201 : 202;
        res.status(statusCode).json({ item });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
