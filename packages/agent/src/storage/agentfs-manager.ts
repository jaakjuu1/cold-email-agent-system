import { createClient, type Client as LibsqlClient } from '@libsql/client';
import { nanoid } from 'nanoid';

export interface AgentFSConfig {
  url: string;
  authToken?: string;
}

interface ToolCallRecord {
  id: string;
  tool_name: string;
  input: string;
  output: string;
  start_time: number;
  end_time: number;
  created_at: string;
}

/**
 * AgentFS Manager - Persistent storage for agent data
 * Uses Turso (libsql) for both KV store and filesystem operations
 */
export class AgentFSManager {
  private db: LibsqlClient;
  private clientId: string;
  private initialized = false;

  constructor(config?: AgentFSConfig) {
    const url = config?.url || process.env.TURSO_DATABASE_URL || 'file:local.db';
    const authToken = config?.authToken || process.env.TURSO_AUTH_TOKEN;

    this.db = createClient({
      url,
      authToken,
    });
    this.clientId = '';
  }

  /**
   * Initialize the AgentFS for a specific client
   */
  async initialize(clientId: string): Promise<void> {
    this.clientId = clientId;

    // Create tables if they don't exist
    await this.db.batch([
      // KV Store
      `CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        client_id TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      // Filesystem
      `CREATE TABLE IF NOT EXISTS filesystem (
        path TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        client_id TEXT NOT NULL,
        is_directory INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      // Tool Call History
      `CREATE TABLE IF NOT EXISTS tool_calls (
        id TEXT PRIMARY KEY,
        tool_name TEXT NOT NULL,
        input TEXT,
        output TEXT,
        start_time REAL NOT NULL,
        end_time REAL NOT NULL,
        client_id TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      // Create indexes
      `CREATE INDEX IF NOT EXISTS idx_kv_client ON kv_store(client_id)`,
      `CREATE INDEX IF NOT EXISTS idx_fs_client ON filesystem(client_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tc_client ON tool_calls(client_id)`,
    ]);

    // Setup default directories
    await this.setupDirectories();
    this.initialized = true;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('AgentFSManager not initialized. Call initialize() first.');
    }
  }

  /**
   * Setup default directory structure
   */
  private async setupDirectories(): Promise<void> {
    const dirs = [
      '/clients',
      '/icp',
      '/prospects',
      '/campaigns',
      '/emails',
      '/tracking',
      '/research',
    ];

    for (const dir of dirs) {
      await this.mkdir(dir).catch(() => {
        // Directory may already exist
      });
    }
  }

  // ===========================================
  // KV Store Operations
  // ===========================================

  /**
   * Set a key-value pair
   */
  async kvSet(key: string, value: unknown): Promise<void> {
    this.ensureInitialized();
    const serialized = JSON.stringify(value);
    const now = new Date().toISOString();

    await this.db.execute({
      sql: `INSERT INTO kv_store (key, value, client_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`,
      args: [key, serialized, this.clientId, now, now, serialized, now],
    });
  }

  /**
   * Get a value by key
   */
  async kvGet<T = unknown>(key: string): Promise<T | null> {
    this.ensureInitialized();

    const result = await this.db.execute({
      sql: `SELECT value FROM kv_store WHERE key = ? AND client_id = ?`,
      args: [key, this.clientId],
    });

    if (result.rows.length === 0) return null;
    return JSON.parse(result.rows[0]!.value as string) as T;
  }

  /**
   * Delete a key
   */
  async kvDelete(key: string): Promise<void> {
    this.ensureInitialized();

    await this.db.execute({
      sql: `DELETE FROM kv_store WHERE key = ? AND client_id = ?`,
      args: [key, this.clientId],
    });
  }

  /**
   * List all keys with a prefix
   */
  async kvList(prefix: string): Promise<string[]> {
    this.ensureInitialized();

    const result = await this.db.execute({
      sql: `SELECT key FROM kv_store WHERE key LIKE ? AND client_id = ?`,
      args: [`${prefix}%`, this.clientId],
    });

    return result.rows.map((row) => row.key as string);
  }

  // ===========================================
  // Filesystem Operations
  // ===========================================

  /**
   * Create a directory
   */
  async mkdir(path: string): Promise<void> {
    this.ensureInitialized();
    const now = new Date().toISOString();

    await this.db.execute({
      sql: `INSERT INTO filesystem (path, content, client_id, is_directory, created_at, updated_at)
            VALUES (?, '', ?, 1, ?, ?)
            ON CONFLICT(path) DO NOTHING`,
      args: [path, this.clientId, now, now],
    });
  }

  /**
   * Write a file
   */
  async writeFile(path: string, content: string): Promise<void> {
    this.ensureInitialized();
    const now = new Date().toISOString();

    await this.db.execute({
      sql: `INSERT INTO filesystem (path, content, client_id, is_directory, created_at, updated_at)
            VALUES (?, ?, ?, 0, ?, ?)
            ON CONFLICT(path) DO UPDATE SET content = ?, updated_at = ?`,
      args: [path, content, this.clientId, now, now, content, now],
    });
  }

  /**
   * Read a file
   */
  async readFile(path: string): Promise<string | null> {
    this.ensureInitialized();

    const result = await this.db.execute({
      sql: `SELECT content FROM filesystem WHERE path = ? AND client_id = ? AND is_directory = 0`,
      args: [path, this.clientId],
    });

    if (result.rows.length === 0) return null;
    return result.rows[0]!.content as string;
  }

  /**
   * List files in a directory
   */
  async readdir(path: string): Promise<string[]> {
    this.ensureInitialized();

    const prefix = path.endsWith('/') ? path : `${path}/`;

    const result = await this.db.execute({
      sql: `SELECT path FROM filesystem 
            WHERE path LIKE ? AND client_id = ? AND path != ?`,
      args: [`${prefix}%`, this.clientId, path],
    });

    return result.rows.map((row) => {
      const fullPath = row.path as string;
      const relativePath = fullPath.slice(prefix.length);
      const firstSegment = relativePath.split('/')[0];
      return firstSegment || '';
    }).filter((p, i, arr) => p && arr.indexOf(p) === i);
  }

  /**
   * Check if a path exists
   */
  async exists(path: string): Promise<boolean> {
    this.ensureInitialized();

    const result = await this.db.execute({
      sql: `SELECT 1 FROM filesystem WHERE path = ? AND client_id = ?`,
      args: [path, this.clientId],
    });

    return result.rows.length > 0;
  }

  /**
   * Delete a file or directory
   */
  async unlink(path: string): Promise<void> {
    this.ensureInitialized();

    await this.db.execute({
      sql: `DELETE FROM filesystem WHERE (path = ? OR path LIKE ?) AND client_id = ?`,
      args: [path, `${path}/%`, this.clientId],
    });
  }

  // ===========================================
  // Tool Call History
  // ===========================================

  /**
   * Record a tool call
   */
  async recordToolCall(
    toolName: string,
    startTime: number,
    endTime: number,
    input: unknown,
    output: unknown
  ): Promise<string> {
    this.ensureInitialized();

    const id = `tc-${nanoid(10)}`;

    await this.db.execute({
      sql: `INSERT INTO tool_calls (id, tool_name, input, output, start_time, end_time, client_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        toolName,
        JSON.stringify(input),
        JSON.stringify(output),
        startTime,
        endTime,
        this.clientId,
      ],
    });

    return id;
  }

  /**
   * Get tool call history
   */
  async getToolCallHistory(
    options: { toolName?: string; limit?: number } = {}
  ): Promise<ToolCallRecord[]> {
    this.ensureInitialized();

    const { toolName, limit = 100 } = options;

    let sql = `SELECT * FROM tool_calls WHERE client_id = ?`;
    const args: (string | number)[] = [this.clientId];

    if (toolName) {
      sql += ` AND tool_name = ?`;
      args.push(toolName);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    args.push(limit);

    const result = await this.db.execute({ sql, args });

    return result.rows.map((row) => ({
      id: row.id as string,
      tool_name: row.tool_name as string,
      input: row.input as string,
      output: row.output as string,
      start_time: row.start_time as number,
      end_time: row.end_time as number,
      created_at: row.created_at as string,
    }));
  }

  // ===========================================
  // High-Level Operations
  // ===========================================

  /**
   * Save client profile
   */
  async saveClientProfile(profile: unknown): Promise<void> {
    await this.kvSet(`client:${this.clientId}`, profile);
    await this.writeFile(
      `/clients/${this.clientId}.json`,
      JSON.stringify(profile, null, 2)
    );
  }

  /**
   * Get client profile
   */
  async getClientProfile<T = unknown>(): Promise<T | null> {
    return this.kvGet<T>(`client:${this.clientId}`);
  }

  /**
   * Save ICP
   */
  async saveICP(icp: unknown): Promise<void> {
    await this.kvSet(`icp:${this.clientId}`, icp);
    await this.writeFile(
      `/icp/${this.clientId}_icp.json`,
      JSON.stringify(icp, null, 2)
    );
  }

  /**
   * Get ICP
   */
  async getICP<T = unknown>(): Promise<T | null> {
    return this.kvGet<T>(`icp:${this.clientId}`);
  }

  /**
   * Save prospects for a location/industry
   */
  async saveProspects(
    location: string,
    industry: string,
    prospects: unknown[]
  ): Promise<void> {
    const path = `/prospects/${location}/${industry}/prospects.json`;
    await this.writeFile(path, JSON.stringify(prospects, null, 2));
    
    // Also update KV for quick lookup
    await this.kvSet(`prospects:${location}:${industry}`, {
      count: prospects.length,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Load prospects
   */
  async loadProspects(location: string, industry: string): Promise<unknown[]> {
    const path = `/prospects/${location}/${industry}/prospects.json`;
    const content = await this.readFile(path);
    if (!content) return [];
    return JSON.parse(content);
  }

  /**
   * Save campaign
   */
  async saveCampaign(campaignId: string, campaign: unknown): Promise<void> {
    await this.kvSet(`campaign:${campaignId}`, campaign);
    await this.mkdir(`/campaigns/${campaignId}`);
    await this.writeFile(
      `/campaigns/${campaignId}/config.json`,
      JSON.stringify(campaign, null, 2)
    );
  }

  /**
   * Get campaign
   */
  async getCampaign<T = unknown>(campaignId: string): Promise<T | null> {
    return this.kvGet<T>(`campaign:${campaignId}`);
  }

  /**
   * Save email for a prospect
   */
  async saveEmail(
    campaignId: string,
    prospectId: string,
    sequence: number,
    email: unknown
  ): Promise<void> {
    await this.mkdir(`/campaigns/${campaignId}/emails/${prospectId}`);
    await this.writeFile(
      `/campaigns/${campaignId}/emails/${prospectId}/email_${sequence}.json`,
      JSON.stringify(email, null, 2)
    );
  }

  /**
   * Save tracking data
   */
  async saveTracking(
    campaignId: string,
    prospectId: string,
    tracking: unknown
  ): Promise<void> {
    await this.mkdir(`/tracking/${campaignId}`);
    await this.writeFile(
      `/tracking/${campaignId}/${prospectId}.json`,
      JSON.stringify(tracking, null, 2)
    );
    await this.kvSet(`tracking:${campaignId}:${prospectId}`, tracking);
  }

  /**
   * Get tracking data
   */
  async getTracking<T = unknown>(
    campaignId: string,
    prospectId: string
  ): Promise<T | null> {
    return this.kvGet<T>(`tracking:${campaignId}:${prospectId}`);
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}

