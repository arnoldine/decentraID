import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import Datastore from 'nedb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Databases ──────────────────────────────────────────────────────────────
const dataDir = path.join(__dirname, 'data');

const usersDb = new Datastore({ filename: path.join(dataDir, 'users.db'), autoload: true });
const settingsDb = new Datastore({ filename: path.join(dataDir, 'settings.db'), autoload: true });
const reportsDb = new Datastore({ filename: path.join(dataDir, 'reports.db'), autoload: true });

// ── In-memory token store ──────────────────────────────────────────────────
interface TokenEntry {
  userId: string;
  role: string;
  createdAt: number;
}
const tokenStore = new Map<string, TokenEntry>();

function generateToken(userId: string, role: string): string {
  const token = `token-${userId}-${Date.now()}`;
  tokenStore.set(token, { userId, role, createdAt: Date.now() });
  return token;
}

function validateToken(token: string): TokenEntry | null {
  return tokenStore.get(token) ?? null;
}

// ── Auth middleware ────────────────────────────────────────────────────────
function authMiddleware(requiredRole?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }
    const token = authHeader.slice(7);
    const entry = validateToken(token);
    if (!entry) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    if (requiredRole && entry.role !== requiredRole) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    (req as any).tokenEntry = entry;
    next();
  };
}

// ── DB helpers ─────────────────────────────────────────────────────────────
function dbFindOne<T>(db: Datastore, query: object): Promise<T | null> {
  return new Promise((resolve, reject) => {
    db.findOne(query, (err: Error | null, doc: T) => {
      if (err) reject(err);
      else resolve(doc ?? null);
    });
  });
}

function dbFind<T>(db: Datastore, query: object, options?: { sort?: object; skip?: number; limit?: number }): Promise<T[]> {
  return new Promise((resolve, reject) => {
    let cursor = db.find(query);
    if (options?.sort) cursor = cursor.sort(options.sort);
    if (options?.skip !== undefined) cursor = cursor.skip(options.skip);
    if (options?.limit !== undefined) cursor = cursor.limit(options.limit);
    cursor.exec((err: Error | null, docs: T[]) => {
      if (err) reject(err);
      else resolve(docs);
    });
  });
}

function dbInsert<T>(db: Datastore, doc: object): Promise<T> {
  return new Promise((resolve, reject) => {
    db.insert(doc, (err: Error | null, newDoc: T) => {
      if (err) reject(err);
      else resolve(newDoc);
    });
  });
}

function dbUpdate(db: Datastore, query: object, update: object, options?: { multi?: boolean; upsert?: boolean }): Promise<number> {
  return new Promise((resolve, reject) => {
    db.update(query, update, options ?? {}, (err: Error | null, numAffected: number) => {
      if (err) reject(err);
      else resolve(numAffected);
    });
  });
}

function dbRemove(db: Datastore, query: object, options?: { multi?: boolean }): Promise<number> {
  return new Promise((resolve, reject) => {
    db.remove(query, options ?? {}, (err: Error | null, numRemoved: number) => {
      if (err) reject(err);
      else resolve(numRemoved);
    });
  });
}

function dbCount(db: Datastore, query: object): Promise<number> {
  return new Promise((resolve, reject) => {
    db.count(query, (err: Error | null, count: number) => {
      if (err) reject(err);
      else resolve(count);
    });
  });
}

// ── Seed data ──────────────────────────────────────────────────────────────
async function seedData(): Promise<void> {
  const userCount = await dbCount(usersDb, {});
  if (userCount === 0) {
    await dbInsert(usersDb, { username: 'admin', password: 'password', role: 'admin', createdAt: new Date().toISOString() });
    await dbInsert(usersDb, { username: 'mobile', password: 'mobile123', role: 'mobile', createdAt: new Date().toISOString() });
    console.log('Seeded default users');
  }

  const settingsCount = await dbCount(settingsDb, {});
  if (settingsCount === 0) {
    await dbInsert(settingsDb, {
      apiBaseUrl: '',
      merchantCode: '',
      merchantKey: '',
      defaultVerificationType: 'kyc',
      updatedAt: new Date().toISOString(),
    });
    console.log('Seeded default settings');
  }
}

// ── Routes: Health ─────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// ── Routes: Mobile Login ───────────────────────────────────────────────────
app.post('/api/mobile/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body as { username: string; password: string };
    if (!username || !password) {
      res.status(400).json({ error: 'username and password required' });
      return;
    }
    const user = await dbFindOne<any>(usersDb, { username, password });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const token = generateToken(user._id, user.role);
    res.json({ token, role: user.role, username: user.username });
  } catch (err) {
    console.error('Mobile login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Routes: Mobile Settings ────────────────────────────────────────────────
app.get('/api/mobile/settings', authMiddleware(), async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await dbFindOne<any>(settingsDb, {});
    if (!settings) {
      res.status(404).json({ error: 'Settings not found' });
      return;
    }
    res.json({
      apiBaseUrl: settings.apiBaseUrl,
      merchantCode: settings.merchantCode,
      defaultVerificationType: settings.defaultVerificationType,
    });
  } catch (err) {
    console.error('Get mobile settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Routes: Mobile Verify ──────────────────────────────────────────────────
app.post('/api/mobile/verify', authMiddleware(), async (req: Request, res: Response): Promise<void> => {
  try {
    const { pinNumber, image, livenessPassed } = req.body as {
      pinNumber: string;
      image: string;
      livenessPassed?: boolean;
    };

    if (!pinNumber || !image) {
      res.status(400).json({ error: 'pinNumber and image are required' });
      return;
    }

    const settings = await dbFindOne<any>(settingsDb, {});
    if (!settings) {
      res.status(500).json({ error: 'Settings not configured' });
      return;
    }

    if (!settings.apiBaseUrl) {
      res.status(500).json({ error: 'API Base URL not configured in settings' });
      return;
    }

    const verificationType = settings.defaultVerificationType ?? 'kyc';
    let upstreamUrl: string;
    if (verificationType === 'kyc') {
      upstreamUrl = `${settings.apiBaseUrl}/base_64/verification/kyc/face`;
    } else {
      upstreamUrl = `${settings.apiBaseUrl}/yes_no/face`;
    }

    const requestBody = {
      pinNumber,
      image,
      dataType: 'PNG',
      center: 'BRANCHLESS',
      userID: settings.merchantCode,
      merchantKey: settings.merchantKey,
    };

    let upstreamResult: any;
    try {
      const upstreamResponse = await fetch(upstreamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      upstreamResult = await upstreamResponse.json();
    } catch (fetchErr) {
      console.error('Upstream API error:', fetchErr);
      res.status(502).json({ error: 'Failed to reach upstream verification API' });
      return;
    }

    const tokenEntry = (req as any).tokenEntry as TokenEntry;
    const report = {
      pinNumber,
      livenessPassed: livenessPassed ?? false,
      verificationType,
      result: upstreamResult,
      verified: upstreamResult?.data?.verified === 'TRUE' || upstreamResult?.success === true,
      transactionId: upstreamResult?.data?.transactionGuid ?? null,
      userId: tokenEntry.userId,
      createdAt: new Date().toISOString(),
    };

    const savedReport = await dbInsert<any>(reportsDb, report);
    res.json({ reportId: savedReport._id, ...upstreamResult });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Routes: Admin Login ────────────────────────────────────────────────────
app.post('/api/admin/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body as { username: string; password: string };
    if (!username || !password) {
      res.status(400).json({ error: 'username and password required' });
      return;
    }
    const user = await dbFindOne<any>(usersDb, { username, password, role: 'admin' });
    if (!user) {
      res.status(401).json({ error: 'Invalid admin credentials' });
      return;
    }
    const token = generateToken(user._id, user.role);
    res.json({ token, role: user.role, username: user.username });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Routes: Admin Reports ──────────────────────────────────────────────────
app.get('/api/admin/verification-reports', authMiddleware('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt((req.query.page as string) ?? '1', 10);
    const limit = parseInt((req.query.limit as string) ?? '20', 10);
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};
    if (req.query.verified !== undefined) {
      query.verified = req.query.verified === 'true';
    }
    if (req.query.pinNumber) {
      query.pinNumber = { $regex: new RegExp(req.query.pinNumber as string, 'i') };
    }

    const [reports, total] = await Promise.all([
      dbFind<any>(reportsDb, query, { sort: { createdAt: -1 }, skip, limit }),
      dbCount(reportsDb, query),
    ]);

    res.json({ reports, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Get reports error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Routes: Admin Stats ────────────────────────────────────────────────────
app.get('/api/admin/verification-stats', authMiddleware('admin'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const [total, successful, failed] = await Promise.all([
      dbCount(reportsDb, {}),
      dbCount(reportsDb, { verified: true }),
      dbCount(reportsDb, { verified: false }),
    ]);
    res.json({ total, successful, failed });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Routes: Admin Settings ─────────────────────────────────────────────────
app.get('/api/admin/verification-settings', authMiddleware('admin'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await dbFindOne<any>(settingsDb, {});
    if (!settings) {
      res.status(404).json({ error: 'Settings not found' });
      return;
    }
    res.json(settings);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/admin/verification-settings', authMiddleware('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { apiBaseUrl, merchantCode, merchantKey, defaultVerificationType } = req.body as {
      apiBaseUrl?: string;
      merchantCode?: string;
      merchantKey?: string;
      defaultVerificationType?: string;
    };

    const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (apiBaseUrl !== undefined) updateData.apiBaseUrl = apiBaseUrl;
    if (merchantCode !== undefined) updateData.merchantCode = merchantCode;
    if (merchantKey !== undefined) updateData.merchantKey = merchantKey;
    if (defaultVerificationType !== undefined) updateData.defaultVerificationType = defaultVerificationType;

    await dbUpdate(settingsDb, {}, { $set: updateData }, { upsert: true });
    const updated = await dbFindOne<any>(settingsDb, {});
    res.json(updated);
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Routes: Admin Users ────────────────────────────────────────────────────
app.get('/api/admin/users', authMiddleware('admin'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await dbFind<any>(usersDb, {}, { sort: { createdAt: 1 } });
    const sanitized = users.map(({ password: _p, ...rest }: any) => rest);
    res.json(sanitized);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/users', authMiddleware('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, role } = req.body as { username: string; password: string; role: string };
    if (!username || !password || !role) {
      res.status(400).json({ error: 'username, password, and role are required' });
      return;
    }
    if (!['admin', 'mobile'].includes(role)) {
      res.status(400).json({ error: 'role must be admin or mobile' });
      return;
    }
    const existing = await dbFindOne<any>(usersDb, { username });
    if (existing) {
      res.status(409).json({ error: 'Username already exists' });
      return;
    }
    const newUser = await dbInsert<any>(usersDb, { username, password, role, createdAt: new Date().toISOString() });
    const { password: _p, ...sanitized } = newUser;
    res.status(201).json(sanitized);
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/admin/users/:id', authMiddleware('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { username, password, role } = req.body as { username?: string; password?: string; role?: string };

    const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (username !== undefined) updateData.username = username;
    if (password !== undefined) updateData.password = password;
    if (role !== undefined) {
      if (!['admin', 'mobile'].includes(role)) {
        res.status(400).json({ error: 'role must be admin or mobile' });
        return;
      }
      updateData.role = role;
    }

    const numAffected = await dbUpdate(usersDb, { _id: id }, { $set: updateData });
    if (numAffected === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const updated = await dbFindOne<any>(usersDb, { _id: id });
    if (!updated) {
      res.status(404).json({ error: 'User not found after update' });
      return;
    }
    const { password: _p, ...sanitized } = updated;
    res.json(sanitized);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/admin/users/:id', authMiddleware('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const numRemoved = await dbRemove(usersDb, { _id: id });
    if (numRemoved === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Routes: APK Releases ──────────────────────────────────────────────────
const STORAGE_ACCOUNT = 'decentraidstore';
const APK_CONTAINER = 'apk-releases';
const BLOB_BASE_URL = `https://${STORAGE_ACCOUNT}.blob.core.windows.net/${APK_CONTAINER}`;

app.get('/api/admin/apk-releases', authMiddleware('admin'), async (_req: Request, res: Response): Promise<void> => {
  try {
    // Fetch latest.json pointer
    const latestRes = await fetch(`${BLOB_BASE_URL}/latest.json?${Date.now()}`);
    const latest = latestRes.ok ? await latestRes.json() : null;

    // List all APK blobs via Azure Blob Storage List API
    const listUrl = `${BLOB_BASE_URL}?restype=container&comp=list&prefix=decentraid-`;
    const listRes = await fetch(listUrl);
    const xml = await listRes.text();

    // Parse blob names + metadata from XML
    const blobs: Array<{ name: string; url: string; size: number; lastModified: string; metadata: Record<string, string> }> = [];
    const blobMatches = xml.matchAll(/<Blob>([\s\S]*?)<\/Blob>/g);
    for (const match of blobMatches) {
      const block = match[1];
      const name = block.match(/<Name>([^<]+)<\/Name>/)?.[1] ?? '';
      const size = parseInt(block.match(/<Content-Length>([^<]+)<\/Content-Length>/)?.[1] ?? '0', 10);
      const lastModified = block.match(/<Last-Modified>([^<]+)<\/Last-Modified>/)?.[1] ?? '';
      const metaBlock = block.match(/<Metadata>([\s\S]*?)<\/Metadata>/)?.[1] ?? '';
      const metadata: Record<string, string> = {};
      const metaMatches = metaBlock.matchAll(/<([^>]+)>([^<]*)<\/[^>]+>/g);
      for (const m of metaMatches) metadata[m[1]] = m[2];
      blobs.push({ name, url: `${BLOB_BASE_URL}/${name}`, size, lastModified, metadata });
    }

    // Sort newest first
    blobs.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    res.json({ latest, releases: blobs });
  } catch (err) {
    console.error('APK releases error:', err);
    res.status(500).json({ error: 'Failed to fetch APK releases' });
  }
});

// ── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3002;

seedData()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to seed data:', err);
    process.exit(1);
  });
