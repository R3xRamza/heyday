import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    totalRevenue: 4280000,
    activeClosings: 142,
    marketVelocity: 18,
  });
});

export default router;
