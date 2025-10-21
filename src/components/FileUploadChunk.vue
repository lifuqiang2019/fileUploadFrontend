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
        <div class="upload-status" :class="file.status">
          <template v-if="file.status === 'uploading'">上传中</template>
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
import { ref } from 'vue';
import {
  checkFileExists,
  checkUploadedChunks,
  uploadChunk,
  mergeChunks,
} from '../api/upload';
import {
  calculateFileHash,
  createFileChunks,
  uploadChunksWithConcurrency,
  formatFileSize,
  type FileChunk,
} from '../utils/fileChunk';

interface UploadingFile {
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'instant' | 'merging' | 'success' | 'error';
  chunkInfo?: {
    completed: number;
    total: number;
  };
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

// 上传单个文件（切片上传）
const uploadSingleFileWithChunks = async (file: File, fileIndex: number) => {
  try {
    // 1. 计算文件 hash
    isCalculatingHash.value = true;
    hashProgress.value = 0;
    
    const fileHash = await calculateFileHash(file, (percent) => {
      hashProgress.value = percent;
    });
    
    isCalculatingHash.value = false;

    console.log('文件 Hash:', fileHash);

    // 2. 检查文件是否已存在（秒传）
    const checkResult = await checkFileExists(fileHash);
    
    if (checkResult.data.exists && checkResult.data.file) {
      // 秒传成功
      uploadingFiles.value[fileIndex]!.status = 'instant';
      uploadingFiles.value[fileIndex]!.progress = 100;
      message.value = `文件"${file.name}"秒传成功！`;
      messageType.value = 'success';
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
    
    // 过滤出未上传的切片
    const chunksToUpload = chunks.filter(chunk => !uploadedChunks.has(chunk.index));
    
    if (uploadedChunks.size > 0) {
      console.log(`检测到已上传 ${uploadedChunks.size} 个切片，继续上传剩余切片`);
      uploadingFiles.value[fileIndex]!.chunkInfo.completed = uploadedChunks.size;
    }

    // 5. 并发上传切片
    if (chunksToUpload.length > 0) {
      await uploadChunksWithConcurrency(
        chunksToUpload,
        async (chunk) => {
          return await uploadChunk(
            chunk.file,
            chunk.hash,
            chunk.index,
            chunk.chunkHash
          );
        },
        3, // 并发数
        (progress) => {
          const totalCompleted = uploadedChunks.size + progress.completed;
          uploadingFiles.value[fileIndex]!.chunkInfo!.completed = totalCompleted;
          uploadingFiles.value[fileIndex]!.progress = Math.floor(
            (totalCompleted / chunks.length) * 100
          );
        }
      );
    }

    // 6. 合并切片
    uploadingFiles.value[fileIndex]!.status = 'merging';
    uploadingFiles.value[fileIndex]!.progress = 100;
    
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

  } catch (error: any) {
    console.error('上传失败:', error);
    uploadingFiles.value[fileIndex]!.status = 'error';
    message.value = `上传失败：${error.response?.data?.message || error.message}`;
    messageType.value = 'error';
    throw error;
  }
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
      uploadingFiles.value = [];
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

.upload-status.uploading {
  color: #3b82f6;
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

