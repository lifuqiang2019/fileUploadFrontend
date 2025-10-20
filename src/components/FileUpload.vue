<template>
  <div class="file-upload-container">
    <div class="upload-header">
      <h2>📁 文件上传系统</h2>
      <p class="subtitle">支持拖拽上传、单文件或多文件上传</p>
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
        multiple
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
        <p>支持任意格式文件，单个文件不超过 10MB</p>
      </div>
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
          </div>
        </div>
        <div class="progress-container">
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: file.progress + '%' }"
            ></div>
          </div>
          <span class="progress-text">{{ file.progress }}%</span>
        </div>
        <div class="upload-status" :class="file.status">
          {{ file.status === 'uploading' ? '上传中' : file.status === 'success' ? '✓ 完成' : '✗ 失败' }}
        </div>
      </div>
    </div>

    <!-- 上传按钮 -->
    <div v-if="selectedFiles.length > 0 && !isUploading" class="action-buttons">
      <button @click="uploadFiles" class="btn btn-primary">
        上传 {{ selectedFiles.length }} 个文件
      </button>
      <button @click="clearFiles" class="btn btn-secondary">清空</button>
    </div>

    <!-- 提示消息 -->
    <div v-if="message" class="message" :class="messageType">
      {{ message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { uploadSingleFile, uploadMultipleFiles } from '../api/upload';

interface UploadingFile {
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'success' | 'error';
}

const emit = defineEmits<{
  uploadSuccess: [];
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const isUploading = ref(false);
const selectedFiles = ref<File[]>([]);
const uploadingFiles = ref<UploadingFile[]>([]);
const message = ref('');
const messageType = ref<'success' | 'error'>('success');

// 触发文件选择
const triggerFileInput = () => {
  if (!isUploading.value && fileInputRef.value) {
    fileInputRef.value.click();
  }
};

// 处理文件选择
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    selectedFiles.value = Array.from(target.files);
    uploadFiles();
  }
};

// 处理拖拽文件
const handleDrop = (event: DragEvent) => {
  isDragging.value = false;
  if (isUploading.value) return;

  const files = event.dataTransfer?.files;
  if (files) {
    selectedFiles.value = Array.from(files);
    uploadFiles();
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
    if (selectedFiles.value.length === 1) {
      // 单文件上传
      const file = selectedFiles.value[0];
      await uploadSingleFile(file, (progressEvent) => {
        const progress = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        uploadingFiles.value[0].progress = progress;
      });

      uploadingFiles.value[0].status = 'success';
      message.value = '文件上传成功！';
      messageType.value = 'success';
    } else {
      // 多文件上传
      await uploadMultipleFiles(selectedFiles.value, (progressEvent) => {
        const progress = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        // 为所有文件更新相同的进度
        uploadingFiles.value.forEach((file) => {
          file.progress = progress;
        });
      });

      uploadingFiles.value.forEach((file) => {
        file.status = 'success';
      });
      message.value = `成功上传 ${selectedFiles.value.length} 个文件！`;
      messageType.value = 'success';
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
  } catch (error: any) {
    uploadingFiles.value.forEach((file) => {
      file.status = 'error';
    });
    message.value = '上传失败：' + (error.response?.data?.message || error.message);
    messageType.value = 'error';
  } finally {
    isUploading.value = false;
  }
};

// 清空文件
const clearFiles = () => {
  selectedFiles.value = [];
  uploadingFiles.value = [];
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
};

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
  font-size: 32px;
  color: #fff;
  margin-bottom: 10px;
}

.subtitle {
  color: #fff;
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

.progress-text {
  font-size: 14px;
  font-weight: 600;
  color: #3b82f6;
  min-width: 45px;
}

.upload-status {
  font-size: 14px;
  font-weight: 600;
  min-width: 60px;
  text-align: right;
}

.upload-status.uploading {
  color: #3b82f6;
}

.upload-status.success {
  color: #10b981;
}

.upload-status.error {
  color: #ef4444;
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  justify-content: center;
}

.btn {
  padding: 12px 32px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
}

.btn-secondary {
  background: #e5e7eb;
  color: #4b5563;
}

.btn-secondary:hover {
  background: #d1d5db;
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

