import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import User from '../models/User.js';

export async function login(req, res) {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        message: 'Teléfono y contraseña son obligatorios.',
      });
    }

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(401).json({
        message: 'Teléfono o contraseña incorrectos.',
      });
    }

    const passwordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordCorrect) {
      return res.status(401).json({
        message: 'Teléfono o contraseña incorrectos.',
      });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        phone: user.phone,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '7d',
      }
    );

    return res.status(200).json({
      message: 'Inicio de sesión exitoso.',
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        businessName: user.businessName,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Error interno del servidor.',
    });
  }
}

