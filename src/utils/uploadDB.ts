/**
 * IndexedDB 工具类 - 用于存储上传任务
 */

const DB_NAME = 'UploadTasksDB';
const DB_VERSION = 1;
const STORE_NAME = 'uploadTasks';

export interface UploadTaskData {
  fileHash: string; // 作为主键
  fileName: string;
  fileSize: number;
  fileType: string;
  totalChunks: number;
  uploadedChunks: number[];
  status: 'uploading' | 'paused' | 'success' | 'error';
  file?: File; // 存储 File 对象，这样刷新后不需要重新选择
  createdAt: number;
  updatedAt: number;
}

class UploadDB {
  private db: IDBDatabase | null = null;

  /**
   * 初始化数据库
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB 打开失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB 初始化成功');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 创建对象存储空间
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { 
            keyPath: 'fileHash' 
          });
          
          // 创建索引
          objectStore.createIndex('status', 'status', { unique: false });
          objectStore.createIndex('createdAt', 'createdAt', { unique: false });
          
          console.log('对象存储空间创建成功');
        }
      };
    });
  }

  /**
   * 确保数据库已初始化
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('数据库未初始化');
    }
    return this.db;
  }

  /**
   * 保存或更新上传任务
   */
  async saveTask(task: UploadTaskData): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      
      const taskData: UploadTaskData = {
        ...task,
        updatedAt: Date.now(),
      };
      
      const request = objectStore.put(taskData);

      request.onsuccess = () => {
        console.log('任务保存成功:', task.fileHash);
        resolve();
      };

      request.onerror = () => {
        console.error('任务保存失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取单个任务
   */
  async getTask(fileHash: string): Promise<UploadTaskData | null> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.get(fileHash);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('获取任务失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取所有任务
   */
  async getAllTasks(): Promise<UploadTaskData[]> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('获取所有任务失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取指定状态的任务
   */
  async getTasksByStatus(status: 'uploading' | 'paused' | 'success' | 'error'): Promise<UploadTaskData[]> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const index = objectStore.index('status');
      const request = index.getAll(status);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('获取任务失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 删除任务
   */
  async deleteTask(fileHash: string): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.delete(fileHash);

      request.onsuccess = () => {
        console.log('任务删除成功:', fileHash);
        resolve();
      };

      request.onerror = () => {
        console.error('任务删除失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 清空所有任务
   */
  async clearAllTasks(): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.clear();

      request.onsuccess = () => {
        console.log('所有任务已清空');
        resolve();
      };

      request.onerror = () => {
        console.error('清空任务失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取数据库统计信息
   */
  async getStats(): Promise<{
    total: number;
    uploading: number;
    paused: number;
    success: number;
    error: number;
  }> {
    const tasks = await this.getAllTasks();
    
    return {
      total: tasks.length,
      uploading: tasks.filter(t => t.status === 'uploading').length,
      paused: tasks.filter(t => t.status === 'paused').length,
      success: tasks.filter(t => t.status === 'success').length,
      error: tasks.filter(t => t.status === 'error').length,
    };
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('数据库连接已关闭');
    }
  }
}

// 导出单例
export const uploadDB = new UploadDB();

