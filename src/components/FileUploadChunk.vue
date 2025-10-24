<template>
  <div class="file-upload-container">
    <div class="upload-header">
      <h2>📁 文件上传系统（支持大文件切片上传）</h2>
      <p class="subtitle">支持拖拽上传、切片上传、断点续传、秒传功能</p>
    </div>

    <!-- 上传区域 -->
    <div
      class="upload-area"
      :class="{ 'drag-over': isDragging, 'uploading': isUploading }"
      @drop.prevent="handleDrop"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @click="triggerFileInput"
    >
      <input
        ref="fileInputRef"
        type="file"
        @change="handleFileSelect"
        style="display: none"
      />
      
      <div class="upload-content">
        <div class="upload-icon">
          <svg viewBox="0 0 24 24" width="64" height="64" stroke="currentColor" stroke-width="2" fill="none">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </div>
        <h3>点击或拖拽文件到此处上传</h3>
        <p>支持任意格式文件，自动切片上传大文件</p>
      </div>
    </div>

    <!-- Hash计算进度 -->
    <div v-if="isCalculatingHash" class="hash-progress">
      <div class="hash-info">
        <span class="hash-icon">🔐</span>
        <span>正在计算文件指纹 (MD5)...</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: hashProgress + '%' }"></div>
      </div>
      <span class="progress-text">{{ hashProgress }}%</span>
    </div>

    <!-- 上传进度 -->
    <div v-if="uploadingFiles.length > 0" class="uploading-list">
      <h3>上传中...</h3>
      <div
        v-for="(file, index) in uploadingFiles"
        :key="index"
        class="upload-item"
      >
        <div class="file-info">
          <span class="file-icon">📄</span>
          <div class="file-details">
            <div class="file-name">{{ file.name }}</div>
            <div class="file-size">{{ formatFileSize(file.size) }}</div>
            <div v-if="file.status === 'instant'" class="instant-upload">
              ⚡ 秒传成功！文件已存在
            </div>
            <div v-else-if="file.chunkInfo" class="chunk-info">
              切片: {{ file.chunkInfo.completed }}/{{ file.chunkInfo.total }}
            </div>
          </div>
        </div>
        <div class="progress-container">
          <div class="progress-bar">
            <div
              class="progress-fill"
              :class="{ 'instant': file.status === 'instant' }"
              :style="{ width: file.progress + '%' }"
            ></div>
          </div>
          <span class="progress-text">{{ file.progress }}%</span>
        </div>
        <div class="upload-actions">
          <template v-if="file.status === 'uploading' && file.isPausable">
            <button @click="pauseUpload(index)" class="action-btn pause-btn" title="暂停上传">
              ⏸️ 暂停
            </button>
          </template>
          <template v-else-if="file.status === 'paused'">
            <button @click="resumeUpload(index)" class="action-btn resume-btn" title="继续上传">
              ▶️ 继续
            </button>
            <button @click="cancelUpload(index)" class="action-btn cancel-btn" title="取消上传">
              ✖️ 取消
            </button>
          </template>
        </div>
        <div class="upload-status" :class="file.status">
          <template v-if="file.status === 'uploading'">上传中</template>
          <template v-else-if="file.status === 'paused'">⏸️ 已暂停</template>
          <template v-else-if="file.status === 'instant'">⚡ 秒传</template>
          <template v-else-if="file.status === 'merging'">🔄 合并中</template>
          <template v-else-if="file.status === 'success'">✓ 完成</template>
          <template v-else-if="file.status === 'error'">✗ 失败</template>
        </div>
      </div>
    </div>

    <!-- 提示消息 -->
    <div v-if="message" class="message" :class="messageType">
      {{ message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import {
  checkFileExists,
  checkUploadedChunks,
  uploadChunk,
  mergeChunks,
} from '../api/upload';
import {
  calculateFileHash,
  createFileChunks,
  formatFileSize,
  type FileChunk,
} from '../utils/fileChunk';
import { uploadDB, type UploadTaskData } from '../utils/uploadDB';

interface UploadingFile {
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'paused' | 'instant' | 'merging' | 'success' | 'error';
  chunkInfo?: {
    completed: number;
    total: number;
  };
  fileHash?: string;
  file?: File;
  isPausable?: boolean; // 是否可以暂停
}

// 上传任务缓存（用于暂停/继续）- 与 IndexedDB 中的结构对应
interface UploadTask {
  fileHash: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  totalChunks: number;
  uploadedChunks: Set<number>;
  status: 'uploading' | 'paused' | 'success' | 'error';
  file?: File;
}

const emit = defineEmits<{
  uploadSuccess: [];
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const isUploading = ref(false);
const isCalculatingHash = ref(false);
const hashProgress = ref(0);
const selectedFiles = ref<File[]>([]);
const uploadingFiles = ref<UploadingFile[]>([]);
const message = ref('');
const messageType = ref<'success' | 'error'>('success');

// 上传任务控制
const uploadTasks = ref<Map<string, UploadTask>>(new Map());
const pauseFlags = ref<Map<string, boolean>>(new Map()); // 暂停标记

// 触发文件选择
const triggerFileInput = () => {
  if (!isUploading.value && !isCalculatingHash.value && fileInputRef.value) {
    fileInputRef.value.click();
  }
};

// 处理文件选择
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    selectedFiles.value = Array.from(target.files);
    uploadFiles();
  }
};

// 处理拖拽文件
const handleDrop = (event: DragEvent) => {
  isDragging.value = false;
  if (isUploading.value || isCalculatingHash.value) return;

  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    selectedFiles.value = Array.from(files);
    uploadFiles();
  }
};

// 上传单个文件（切片上传）- 支持断点续传
const uploadSingleFileWithChunks = async (file: File, fileIndex: number) => {
  let fileHash = '';
  
  try {
    // 1. 计算文件 hash
    isCalculatingHash.value = true;
    hashProgress.value = 0;
    
    fileHash = await calculateFileHash(file, (percent) => {
      hashProgress.value = percent;
    });
    
    isCalculatingHash.value = false;

    console.log('文件 Hash:', fileHash);
    
    // 保存文件hash到上传文件信息
    uploadingFiles.value[fileIndex]!.fileHash = fileHash;
    uploadingFiles.value[fileIndex]!.file = file;
    uploadingFiles.value[fileIndex]!.isPausable = true;

    // 2. 检查文件是否已存在（秒传）
    const checkResult = await checkFileExists(fileHash);
    
    if (checkResult.data.exists && checkResult.data.file) {
      // 秒传成功
      uploadingFiles.value[fileIndex]!.status = 'instant';
      uploadingFiles.value[fileIndex]!.progress = 100;
      uploadingFiles.value[fileIndex]!.isPausable = false;
      message.value = `文件"${file.name}"秒传成功！`;
      messageType.value = 'success';
      
      // 清除 IndexedDB 中的上传任务
      await removeUploadTask(fileHash);
      return;
    }

    // 3. 创建文件切片
    const chunks = createFileChunks(file, fileHash);
    console.log(`文件切片数量: ${chunks.length}`);

    uploadingFiles.value[fileIndex]!.chunkInfo = {
      completed: 0,
      total: chunks.length,
    };

    // 4. 检查已上传的切片（断点续传）
    const uploadedResult = await checkUploadedChunks(fileHash);
    const uploadedChunks = new Set(uploadedResult.data.uploadedChunks || []);
    
    // 初始化上传任务
    const task: UploadTask = {
      fileHash,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'application/octet-stream',
      totalChunks: chunks.length,
      uploadedChunks: uploadedChunks,
      status: 'uploading',
      file: file, // 保存 File 对象
    };
    uploadTasks.value.set(fileHash, task);
    pauseFlags.value.set(fileHash, false);
    
    // 保存任务到 IndexedDB
    await saveUploadTask(task);
    
    // 过滤出未上传的切片
    const chunksToUpload = chunks.filter(chunk => !uploadedChunks.has(chunk.index));
    
    if (uploadedChunks.size > 0) {
      console.log(`检测到已上传 ${uploadedChunks.size} 个切片，继续上传剩余切片`);
      uploadingFiles.value[fileIndex]!.chunkInfo.completed = uploadedChunks.size;
      uploadingFiles.value[fileIndex]!.progress = Math.floor(
        (uploadedChunks.size / chunks.length) * 100
      );
    }

    // 5. 上传切片（支持暂停）
    if (chunksToUpload.length > 0) {
      await uploadChunksWithPause(
        chunksToUpload,
        fileHash,
        fileIndex,
        chunks.length,
        uploadedChunks.size
      );
    }
    
    // 检查是否被暂停
    if (pauseFlags.value.get(fileHash)) {
      console.log('上传已暂停');
      return;
    }

    // 6. 合并切片
    uploadingFiles.value[fileIndex]!.status = 'merging';
    uploadingFiles.value[fileIndex]!.progress = 100;
    uploadingFiles.value[fileIndex]!.isPausable = false;
    
    await mergeChunks(
      fileHash,
      file.name,
      file.size,
      file.type || 'application/octet-stream'
    );

    // 7. 上传成功
    uploadingFiles.value[fileIndex]!.status = 'success';
    message.value = `文件"${file.name}"上传成功！`;
    messageType.value = 'success';
    
    // 清除 IndexedDB 中的上传任务
    await removeUploadTask(fileHash);
    uploadTasks.value.delete(fileHash);
    pauseFlags.value.delete(fileHash);

  } catch (error: any) {
    console.error('上传失败:', error);
    
    // 只有不是暂停操作才标记为失败
    if (!pauseFlags.value.get(fileHash)) {
      uploadingFiles.value[fileIndex]!.status = 'error';
      message.value = `上传失败：${error.response?.data?.message || error.message}`;
      messageType.value = 'error';
      
      // 更新任务状态
      const task = uploadTasks.value.get(fileHash);
      if (task) {
        task.status = 'error';
        await saveUploadTask(task);
      }
    }
    throw error;
  }
};

// 支持暂停的切片上传
const uploadChunksWithPause = async (
  chunks: FileChunk[],
  fileHash: string,
  fileIndex: number,
  totalChunks: number,
  initialCompleted: number
): Promise<void> => {
  const concurrency = 3; // 并发数
  let completed = initialCompleted;
  let index = 0;

  const uploadNext = async (): Promise<void> => {
    while (index < chunks.length) {
      // 检查是否暂停
      if (pauseFlags.value.get(fileHash)) {
        throw new Error('Upload paused');
      }

      const currentIndex = index++;
      const chunk = chunks[currentIndex];
      
      // 安全检查
      if (!chunk) {
        console.error(`切片 ${currentIndex} 不存在`);
        continue;
      }

      try {
        await uploadChunk(
          chunk.file,
          chunk.hash,
          chunk.index,
          chunk.chunkHash
        );

        completed++;

        // 更新进度
        if (uploadingFiles.value[fileIndex]) {
          uploadingFiles.value[fileIndex]!.chunkInfo!.completed = completed;
          uploadingFiles.value[fileIndex]!.progress = Math.floor(
            (completed / totalChunks) * 100
          );
        }

        // 更新任务进度
        const task = uploadTasks.value.get(fileHash);
        if (task) {
          task.uploadedChunks.add(chunk.index);
          await saveUploadTask(task);
        }
      } catch (error) {
        // 如果是暂停导致的错误，直接抛出
        if (pauseFlags.value.get(fileHash)) {
          throw error;
        }
        // 否则记录错误但继续上传其他切片
        console.error(`切片 ${chunk.index} 上传失败:`, error);
        throw error;
      }
    }
  };

  // 启动并发上传
  const pool: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, chunks.length); i++) {
    pool.push(uploadNext());
  }

  await Promise.all(pool);
};

// 上传文件
const uploadFiles = async () => {
  if (selectedFiles.value.length === 0) return;

  isUploading.value = true;
  message.value = '';

  // 初始化上传文件列表
  uploadingFiles.value = selectedFiles.value.map((file) => ({
    name: file.name,
    size: file.size,
    progress: 0,
    status: 'uploading' as const,
    isPausable: false,
  }));

  try {
    // 顺序上传每个文件
    for (let i = 0; i < selectedFiles.value.length; i++) {
      await uploadSingleFileWithChunks(selectedFiles.value[i]!, i);
    }

    // 通知父组件刷新列表
    emit('uploadSuccess');

    // 3秒后清空上传列表
    setTimeout(() => {
      uploadingFiles.value = uploadingFiles.value.filter(
        f => f.status === 'paused' // 保留暂停的任务
      );
      selectedFiles.value = [];
      if (fileInputRef.value) {
        fileInputRef.value.value = '';
      }
    }, 3000);

  } catch (error) {
    console.error('上传过程出错:', error);
  } finally {
    isUploading.value = false;
    isCalculatingHash.value = false;
  }
};

// ==================== IndexedDB 存储相关 ====================

// 保存上传任务到 IndexedDB
const saveUploadTask = async (task: UploadTask) => {
  try {
    const taskData: UploadTaskData = {
      fileHash: task.fileHash,
      fileName: task.fileName,
      fileSize: task.fileSize,
      fileType: task.fileType,
      totalChunks: task.totalChunks,
      uploadedChunks: Array.from(task.uploadedChunks), // Set转Array
      status: task.status,
      file: task.file, // 存储 File 对象
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await uploadDB.saveTask(taskData);
  } catch (error) {
    console.error('保存上传任务失败:', error);
  }
};

// 从 IndexedDB 移除任务
const removeUploadTask = async (fileHash: string) => {
  try {
    await uploadDB.deleteTask(fileHash);
  } catch (error) {
    console.error('删除上传任务失败:', error);
  }
};

// ==================== 暂停/继续/取消功能 ====================

// 暂停上传
const pauseUpload = async (fileIndex: number) => {
  const file = uploadingFiles.value[fileIndex];
  if (!file || !file.fileHash) return;

  pauseFlags.value.set(file.fileHash, true);
  file.status = 'paused';

  const task = uploadTasks.value.get(file.fileHash);
  if (task) {
    task.status = 'paused';
    await saveUploadTask(task);
  }

  message.value = `文件"${file.name}"已暂停上传`;
  messageType.value = 'success';
};

// 继续上传
const resumeUpload = async (fileIndex: number) => {
  const uploadFile = uploadingFiles.value[fileIndex];
  if (!uploadFile || !uploadFile.fileHash) return;

  // IndexedDB 已经保存了 File 对象，直接使用即可
  if (!uploadFile.file) {
    message.value = '文件对象丢失，无法继续上传';
    messageType.value = 'error';
    return;
  }

  uploadFile.status = 'uploading';
  pauseFlags.value.set(uploadFile.fileHash, false);

  const task = uploadTasks.value.get(uploadFile.fileHash);
  if (task) {
    task.status = 'uploading';
    task.file = uploadFile.file;
    await saveUploadTask(task);
  }

  message.value = `继续上传文件"${uploadFile.name}"`;
  messageType.value = 'success';

  // 重新开始上传
  try {
    await uploadSingleFileWithChunks(uploadFile.file, fileIndex);
    
    // 上传成功后通知父组件
    emit('uploadSuccess');
  } catch (error) {
    console.error('继续上传失败:', error);
  }
};

// 取消上传
const cancelUpload = async (fileIndex: number) => {
  const file = uploadingFiles.value[fileIndex];
  if (!file || !file.fileHash) return;

  pauseFlags.value.set(file.fileHash, true);
  
  // 从列表中移除
  uploadingFiles.value.splice(fileIndex, 1);

  // 清除任务数据
  uploadTasks.value.delete(file.fileHash);
  pauseFlags.value.delete(file.fileHash);
  await removeUploadTask(file.fileHash);

  message.value = `已取消上传文件"${file.name}"`;
  messageType.value = 'success';
};

// ==================== 页面加载时恢复未完成的任务 ====================

onMounted(async () => {
  try {
    // 初始化 IndexedDB
    await uploadDB.init();

    // 获取所有未完成的任务（paused 和 uploading 状态）
    const allTasks = await uploadDB.getAllTasks();
    const pausedTasks: UploadingFile[] = [];

    for (const taskData of allTasks) {
      if (taskData.status === 'paused' || taskData.status === 'uploading') {
        const uploadedChunks = new Set(taskData.uploadedChunks || []);
        const progress = Math.floor(
          (uploadedChunks.size / taskData.totalChunks) * 100
        );

        pausedTasks.push({
          name: taskData.fileName,
          size: taskData.fileSize,
          progress,
          status: 'paused',
          fileHash: taskData.fileHash,
          isPausable: true,
          file: taskData.file, // IndexedDB 中保存的 File 对象
          chunkInfo: {
            completed: uploadedChunks.size,
            total: taskData.totalChunks,
          },
        });

        // 恢复任务数据
        const task: UploadTask = {
          fileHash: taskData.fileHash,
          fileName: taskData.fileName,
          fileSize: taskData.fileSize,
          fileType: taskData.fileType,
          totalChunks: taskData.totalChunks,
          uploadedChunks: uploadedChunks,
          status: 'paused',
          file: taskData.file, // 包含 File 对象
        };
        uploadTasks.value.set(taskData.fileHash, task);
        pauseFlags.value.set(taskData.fileHash, true);
      }
    }

    if (pausedTasks.length > 0) {
      uploadingFiles.value = pausedTasks;
      message.value = `检测到 ${pausedTasks.length} 个未完成的上传任务，点击"继续"即可恢复上传`;
      messageType.value = 'success';
    }
  } catch (error) {
    console.error('恢复上传任务失败:', error);
  }
});

// 组件卸载时关闭数据库连接
onUnmounted(() => {
  uploadDB.close();
});
</script>

<style scoped>
.file-upload-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.upload-header {
  text-align: center;
  margin-bottom: 30px;
}

.upload-header h2 {
  font-size: 28px;
  color: #2c3e50;
  margin-bottom: 10px;
}

.subtitle {
  color: #7f8c8d;
  font-size: 14px;
}

.upload-area {
  border: 3px dashed #d1d5db;
  border-radius: 16px;
  padding: 60px 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.upload-area:hover {
  border-color: #3b82f6;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(59, 130, 246, 0.1);
}

.upload-area.drag-over {
  border-color: #10b981;
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  transform: scale(1.02);
}

.upload-area.uploading {
  pointer-events: none;
  opacity: 0.6;
}

.upload-content {
  pointer-events: none;
}

.upload-icon {
  color: #3b82f6;
  margin-bottom: 20px;
  display: inline-block;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

.upload-area h3 {
  font-size: 20px;
  color: #1f2937;
  margin-bottom: 10px;
}

.upload-area p {
  color: #6b7280;
  font-size: 14px;
}

/* Hash计算进度 */
.hash-progress {
  margin-top: 20px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

.hash-info {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  font-weight: 600;
  color: #3b82f6;
}

.hash-icon {
  font-size: 24px;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* 上传列表 */
.uploading-list {
  margin-top: 30px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

.uploading-list h3 {
  font-size: 18px;
  color: #2c3e50;
  margin-bottom: 20px;
}

.upload-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 12px;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.file-icon {
  font-size: 32px;
}

.file-details {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

.chunk-info {
  font-size: 12px;
  color: #3b82f6;
  margin-top: 2px;
}

.instant-upload {
  font-size: 12px;
  color: #10b981;
  font-weight: 600;
  margin-top: 2px;
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
  transition: width 0.3s ease;
  border-radius: 4px;
}

.progress-fill.instant {
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
}

.progress-text {
  font-size: 14px;
  font-weight: 600;
  color: #3b82f6;
  min-width: 45px;
}

.upload-status {
  font-size: 14px;
  font-weight: 600;
  min-width: 80px;
  text-align: right;
}

.upload-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.action-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.action-btn:active {
  transform: translateY(0);
}

.pause-btn {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
}

.pause-btn:hover {
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
}

.resume-btn {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.resume-btn:hover {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
}

.cancel-btn {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
}

.cancel-btn:hover {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
}

.upload-status {
  font-size: 14px;
  font-weight: 600;
  min-width: 80px;
  text-align: right;
}

.upload-status.uploading {
  color: #3b82f6;
}

.upload-status.paused {
  color: #f59e0b;
}

.upload-status.instant {
  color: #10b981;
}

.upload-status.merging {
  color: #f59e0b;
}

.upload-status.success {
  color: #10b981;
}

.upload-status.error {
  color: #ef4444;
}

.message {
  margin-top: 20px;
  padding: 16px 20px;
  border-radius: 8px;
  font-weight: 500;
  text-align: center;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message.success {
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #10b981;
}

.message.error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #ef4444;
}
</style>

