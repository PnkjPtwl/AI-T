import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './configs/env';
import { knowledgeRouter } from './api/routes/knowledgeRoutes';
import { ensureCollection } from './qdrant/operations/QdrantClient';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api/v1/knowledge', knowledgeRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function startServer() {
  await ensureCollection();
  
  app.listen(env.PORT, () => {
    console.log(`Knowledge Platform running on port ${env.PORT}`);
  });
}

startServer().catch(console.error);
