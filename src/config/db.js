const dns = require('dns');
const mongoose = require('mongoose');

// Usar DNS públicos para resolver MongoDB Atlas
dns.setServers(['1.1.1.1', '8.8.8.8']);

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log('MongoDB conectado correctamente');
  } catch (error) {
    console.error('Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
}

module.exports = connectDB;