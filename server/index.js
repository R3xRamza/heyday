import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import './db.js';
import db from './db.js';
import { closePastDueTransactions } from './lib/transactionAutoClose.js';
import { authMiddleware } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import crmRoutes from './routes/crm.js';
import gmailRoutes from './routes/gmail.js';
import tasksRoutes from './routes/tasks.js';
import revenueRoutes from './routes/revenue.js';
import transactionsRoutes from './routes/transactions.js';
import marketingRoutes from './routes/marketing.js';
import teamRoutes from './routes/team.js';
import teamHubRoutes from './routes/team-hub.js';
import checklistsRoutes from './routes/checklists.js';
import projectsRoutes from './routes/projects.js';
import userTodosRoutes from './routes/user-todos.js';
import addressRoutes from './routes/address.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const autoClosed = closePastDueTransactions(db);
if (autoClosed.closed > 0) {
  console.log(`Auto-closed ${autoClosed.closed} transaction(s) past close date`);
}
const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

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
app.use('/api/team-hub', authMiddleware, teamHubRoutes);
app.use('/api/checklists', authMiddleware, checklistsRoutes);
app.use('/api/projects', authMiddleware, projectsRoutes);
app.use('/api/user-todos', authMiddleware, userTodosRoutes);
app.use('/api/address', authMiddleware, addressRoutes);

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
