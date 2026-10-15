import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { AnswerService } from '../services/answering/AnswerService';

const querySchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, 'Question must be at least 3 characters')
    .max(1_000, 'Question must be at most 1,000 characters'),
});

type QueryBody = z.infer<typeof querySchema>;

export function buildQueryRouter(answerService: AnswerService, rateLimiter?: RequestHandler): Router {
  const router = Router();

  router.post(
    '/query',
    ...(rateLimiter !== undefined ? [rateLimiter] : []),
    validate(querySchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { question } = req.body as QueryBody;
        const result = await answerService.answer(question);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
