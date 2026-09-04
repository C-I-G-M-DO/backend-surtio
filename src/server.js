require('dotenv').config();

const express = require('express');
const cors = require('cors');

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth.routes');

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});