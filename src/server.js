import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import reportRoutes from './routes/reportRoutes.js';
import { iniciarReporteDiario } from './jobs/dailyReportJob.js';

import imageRoutes from './routes/image.routes.js';
import saleRoutes from './routes/saleRoutes.js';
import productRoutes from './routes/product.routes.js';
import authRoutes from './routes/auth.routes.js';
import customerRoutes from './routes/customer.routes.js';
import orderRoutes from './routes/orderRoutes.js';

import connectDB from './config/db.js';

const app = express();

// Configuración CORS
const allowedOrigins = [
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:19006',
  'https://surtio.netlify.app',
];

app.use(cors({
  origin: (origin, callback) => {
    // Permite clientes nativos y solicitudes sin Origin.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`Origen bloqueado por CORS: ${origin}`);
    return callback(new Error('Origen no permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Procesar JSON
app.use(express.json());

// Ruta principal
app.get('/', (req, res) => {
  res.json({
    message: 'API de Surtío funcionando',
  });
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api', imageRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/orders', orderRoutes);

// Conexión a MongoDB
connectDB();

// Iniciar reportes automáticos
iniciarReporteDiario();

// Puerto del servidor
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});