import { Router, Request, Response } from 'express';
import { createUser, authenticateUser, generateToken, updateUser, findUserById } from './auth';
import { authMiddleware, AuthenticatedRequest } from './middleware';
import db from './db';

const router = Router();

// Register new user
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Create user
    const user = await createUser(db, email, name, password);
    const token = generateToken(user);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Authenticate user
    const user = await authenticateUser(db, email, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/profile', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        createdAt: req.user.createdAt
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/profile', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { name, email } = req.body;
    const updates: Partial<{ name: string; email: string }> = {};

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      updates.name = name.trim();
    }

    if (email !== undefined) {
      if (!email.includes('@')) {
        return res.status(400).json({ error: 'Please enter a valid email address' });
      }
      
      // Check if email is already taken by another user
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.toLowerCase(), req.user.id);
      if (existingUser) {
        return res.status(409).json({ error: 'Email is already taken' });
      }
      
      updates.email = email.toLowerCase();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    const updatedUser = updateUser(db, req.user.id, updates);
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        createdAt: updatedUser.createdAt
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.put('/change-password', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Get current user with password hash
    const user = findUserById(db, req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const { comparePassword, hashPassword } = await import('./auth');
    const isValid = await comparePassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password and update
    const newPasswordHash = await hashPassword(newPassword);
    const now = new Date().toISOString();
    
    db.prepare('UPDATE users SET passwordHash = ?, updatedAt = ? WHERE id = ?').run(
      newPasswordHash, now, req.user.id
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
