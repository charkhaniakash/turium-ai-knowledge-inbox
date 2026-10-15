import { Router, Request, Response, NextFunction } from 'express';
import { ItemRepository } from '../domain/interfaces';

export function buildItemsRouter(itemRepository: ItemRepository): Router {
  const router = Router();

  router.get('/items', (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = itemRepository.findAll();
      res.status(200).json({ items });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
