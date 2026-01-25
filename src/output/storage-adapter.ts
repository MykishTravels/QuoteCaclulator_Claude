/**
 * Local Filesystem Storage Adapter
 * 
 * v1 implementation of StoragePort using local filesystem.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { StoragePort } from './types';

/**
 * Local filesystem storage implementation.
 */
export class LocalFileStorage implements StoragePort {
  constructor(private readonly baseDir: string) {
    // Ensure base directory exists
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
  }

  async store(filename: string, content: Buffer): Promise<string> {
    const reference = this.generateReference(filename);
    const fullPath = this.getFullPath(reference);
    
    // Ensure directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(fullPath, content);
    return reference;
  }

  async retrieve(reference: string): Promise<Buffer> {
    const fullPath = this.getFullPath(reference);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${reference}`);
    }
    
    return fs.readFileSync(fullPath);
  }

  async delete(reference: string): Promise<void> {
    const fullPath = this.getFullPath(reference);
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  async getSize(reference: string): Promise<number> {
    const fullPath = this.getFullPath(reference);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${reference}`);
    }
    
    const stats = fs.statSync(fullPath);
    return stats.size;
  }

  private generateReference(filename: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    
    // Format: YYYY/MM/base-timestamp-random.ext
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    return `${year}/${month}/${base}-${timestamp}-${random}${ext}`;
  }

  private getFullPath(reference: string): string {
    return path.join(this.baseDir, reference);
  }
}

/**
 * Factory function to create local file storage.
 */
export function createLocalFileStorage(baseDir: string): StoragePort {
  return new LocalFileStorage(baseDir);
}
