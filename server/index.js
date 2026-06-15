import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import './db.js';
import { authMiddleware } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import crmRoutes from './routes/crm.js';
import gmailRoutes from './routes/gmail.js';
import tasksRoutes from './routes/tasks.js';
import revenueRoutes from './routes/revenue.js';
import transactionsRoutes from './routes/transactions.js';
import marketingRoutes from './routes/marketing.js';
import teamRoutes from './routes/team.js';
import checklistsRoutes from './routes/checklists.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser());
app.use(express.json());

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

app.use('/api/auth', authRoutes);

app.use('/api/gmail', gmailRoutes);
app.use('/api/crm', authMiddleware, crmRoutes);
app.use('/api/tasks', authMiddleware, tasksRoutes);
app.use('/api/revenue', authMiddleware, revenueRoutes);
app.use('/api/transactions', authMiddleware, transactionsRoutes);
app.use('/api/marketing', authMiddleware, marketingRoutes);
app.use('/api/team', authMiddleware, teamRoutes);
app.use('/api/checklists', authMiddleware, checklistsRoutes);

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`HEYDAY server running on http://localhost:${PORT}`);
});
