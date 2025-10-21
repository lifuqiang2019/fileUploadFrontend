import SparkMD5 from 'spark-md5';

// 切片大小：2MB
export const CHUNK_SIZE = 2 * 1024 * 1024;

// 文件切片接口
export interface FileChunk {
  file: Blob;
  index: number;
  hash: string;
  chunkHash: string;
}

// 切片上传进度接口
export interface ChunkProgress {
  index: number;
  loaded: number;
  total: number;
  percent: number;
}

/**
 * 计算文件 MD5 hash
 * @param file 文件对象
 * @param onProgress 进度回调
 * @returns Promise<string> 文件的 MD5 hash
 */
export const calculateFileHash = (
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const chunks = Math.ceil(file.size / CHUNK_SIZE);
    let currentChunk = 0;
    const spark = new SparkMD5.ArrayBuffer();
    const fileReader = new FileReader();

    fileReader.onload = (e) => {
      if (e.target?.result) {
        spark.append(e.target.result as ArrayBuffer);
        currentChunk++;

        // 计算进度
        const progress = Math.floor((currentChunk / chunks) * 100);
        onProgress?.(progress);

        if (currentChunk < chunks) {
          loadNext();
        } else {
          // 完成计算
          const hash = spark.end();
          resolve(hash);
        }
      }
    };

    fileReader.onerror = () => {
      reject(new Error('文件读取失败'));
    };

    const loadNext = () => {
      const start = currentChunk * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const blob = file.slice(start, end);
      fileReader.readAsArrayBuffer(blob);
    };

    loadNext();
  });
};

/**
 * 生成切片 hash
 * @param fileHash 文件hash
 * @param index 切片索引
 * @returns 切片hash
 */
export const generateChunkHash = (fileHash: string, index: number): string => {
  return `${fileHash}-${index}`;
};

/**
 * 将文件切片
 * @param file 文件对象
 * @param fileHash 文件hash
 * @returns FileChunk[] 切片数组
 */
export const createFileChunks = (file: File, fileHash: string): FileChunk[] => {
  const chunks: FileChunk[] = [];
  const chunkCount = Math.ceil(file.size / CHUNK_SIZE);

  for (let i = 0; i < chunkCount; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    chunks.push({
      file: chunk,
      index: i,
      hash: fileHash,
      chunkHash: generateChunkHash(fileHash, i),
    });
  }

  return chunks;
};

/**
 * 并发上传切片
 * @param chunks 切片数组
 * @param uploadFn 上传函数
 * @param concurrency 并发数
 * @param onProgress 进度回调
 */
export const uploadChunksWithConcurrency = async <T>(
  chunks: FileChunk[],
  uploadFn: (chunk: FileChunk, onProgress?: (progress: ChunkProgress) => void) => Promise<T>,
  concurrency: number = 3,
  onProgress?: (overall: { completed: number; total: number; percent: number }) => void
): Promise<T[]> => {
  const results: T[] = [];
  let completed = 0;
  const total = chunks.length;

  // 创建并发池
  const pool: Promise<void>[] = [];
  let index = 0;

  const uploadNext = async (): Promise<void> => {
    if (index >= chunks.length) return;

    const currentIndex = index++;
    const chunk = chunks[currentIndex];

    try {
      const result = await uploadFn(chunk, (chunkProgress) => {
        // 单个切片上传进度（可选处理）
      });
      results[currentIndex] = result;
      completed++;

      // 更新整体进度
      onProgress?.({
        completed,
        total,
        percent: Math.floor((completed / total) * 100),
      });

      // 继续上传下一个
      await uploadNext();
    } catch (error) {
      throw error;
    }
  };

  // 启动并发上传
  for (let i = 0; i < Math.min(concurrency, chunks.length); i++) {
    pool.push(uploadNext());
  }

  await Promise.all(pool);
  return results;
};

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的字符串
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * 格式化时间（秒）
 * @param seconds 秒数
 * @returns 格式化后的字符串
 */
export const formatTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.floor(seconds)}秒`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}分${secs}秒`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}小时${minutes}分`;
  }
};

