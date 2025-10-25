import express, { Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';
import prisma from './prisma';
import fs from 'fs/promises';
import path from 'path';

//ROUTES IMPORTS
import countryRoutes from './routes/country.routes';

// EXPRESS APP SETUP
const app = express();
const PORT = process.env.PORT || 3000;

// MIDDLEWARES
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API ROUTES
app.use('/', countryRoutes);

// 404 HANDLER
app.use((req: Request, res: Response) => {
    res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});

// START SERVER
async function startServer() {
    try {
        await prisma.$connect();
        console.log('✅ Database connected');

        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Startup failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

export default app;
