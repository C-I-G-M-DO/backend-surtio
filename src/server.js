import 'dotenv/config';

import express from 'express';
import cors from 'cors';

import imageRoutes from './routes/image.routes.js';
import saleRoutes from './routes/saleRoutes.js';
import productRoutes from './routes/product.routes.js';
import authRoutes from './routes/auth.routes.js';
import customerRoutes from "./routes/customer.routes.js";

import connectDB from './config/db.js';

const app = express();

connectDB();

app.use(cors());

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'API de Surtío funcionando',
  });
});

app.use('/api/auth', authRoutes);

app.use('/api/products', productRoutes);

// Obtener imágenes
app.use('/api', imageRoutes);

// Ventas
app.use('/api/sales', saleRoutes);

//clientes
app.use("/api/customers", customerRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});

