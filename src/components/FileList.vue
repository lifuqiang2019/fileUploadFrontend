<template>
  <div class="file-list-container">
    <div class="list-header">
      <h2>📋 已上传文件列表</h2>
      <button @click="refreshList" class="btn-refresh" :disabled="loading">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
        刷新
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading && files.length === 0" class="loading">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <!-- 文件列表 -->
    <div v-else-if="files.length > 0" class="file-list">
      <div
        v-for="file in files"
        :key="file.id"
        class="file-item"
      >
        <div class="file-icon-wrapper">
          <span class="file-icon">{{ getFileIcon(file.mimetype) }}</span>
        </div>
        
        <div class="file-info">
          <div class="file-name" :title="file.originalname">
            {{ file.originalname }}
          </div>
          <div class="file-meta">
            <span class="file-size">{{ formatFileSize(file.size) }}</span>
            <span class="separator">•</span>
            <span class="file-type">{{ getFileType(file.mimetype) }}</span>
            <span class="separator">•</span>
            <span class="file-date">{{ formatDate(file.createdAt) }}</span>
          </div>
        </div>

        <div class="file-actions">
          <a
            :href="getFileUrl(file.url)"
            target="_blank"
            class="btn-action btn-download"
            title="下载"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </a>
          <button
            @click="handleDelete(file.id)"
            class="btn-action btn-delete"
            :disabled="deleting === file.id"
            title="删除"
          >
            <svg v-if="deleting !== file.id" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            <div v-else class="mini-spinner"></div>
          </button>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <div class="empty-icon">📭</div>
      <h3>暂无文件</h3>
      <p>上传您的第一个文件吧！</p>
    </div>

    <!-- 分页 -->
    <div v-if="pagination && pagination.pages > 1" class="pagination">
      <button
        @click="goToPage(pagination.page - 1)"
        :disabled="pagination.page === 1"
        class="btn-page"
      >
        上一页
      </button>
      
      <div class="page-info">
        第 {{ pagination.page }} / {{ pagination.pages }} 页
        <span class="total-files">(共 {{ pagination.total }} 个文件)</span>
      </div>
      
      <button
        @click="goToPage(pagination.page + 1)"
        :disabled="pagination.page === pagination.pages"
        class="btn-page"
      >
        下一页
      </button>
    </div>

    <!-- 提示消息 -->
    <div v-if="message" class="message" :class="messageType">
      {{ message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getFileList, deleteFile, type FileInfo } from '../api/upload';

const files = ref<FileInfo[]>([]);
const loading = ref(false);
const deleting = ref<number | null>(null);
const message = ref('');
const messageType = ref<'success' | 'error'>('success');
const pagination = ref<{
  page: number;
  limit: number;
  total: number;
  pages: number;
} | null>(null);

// 加载文件列表
const loadFiles = async (page: number = 1) => {
  loading.value = true;
  message.value = '';
  
  try {
    const response = await getFileList(page, 10);
    files.value = response.data.files;
    pagination.value = response.data.pagination;
  } catch (error: any) {
    message.value = '加载文件列表失败：' + (error.response?.data?.message || error.message);
    messageType.value = 'error';
  } finally {
    loading.value = false;
  }
};

// 刷新列表
const refreshList = () => {
  loadFiles(pagination.value?.page || 1);
};

// 翻页
const goToPage = (page: number) => {
  loadFiles(page);
};

// 删除文件
const handleDelete = async (id: number) => {
  if (!confirm('确定要删除这个文件吗？')) {
    return;
  }

  deleting.value = id;
  message.value = '';

  try {
    await deleteFile(id);
    message.value = '文件删除成功！';
    messageType.value = 'success';
    
    // 刷新列表
    await loadFiles(pagination.value?.page || 1);
    
    // 3秒后清除消息
    setTimeout(() => {
      message.value = '';
    }, 3000);
  } catch (error: any) {
    message.value = '删除失败：' + (error.response?.data?.message || error.message);
    messageType.value = 'error';
  } finally {
    deleting.value = null;
  }
};

// 获取文件图标
const getFileIcon = (mimetype: string): string => {
  if (mimetype.startsWith('image/')) return '🖼️';
  if (mimetype.startsWith('video/')) return '🎬';
  if (mimetype.startsWith('audio/')) return '🎵';
  if (mimetype.includes('pdf')) return '📕';
  if (mimetype.includes('word')) return '📘';
  if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return '📊';
  if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) return '📙';
  if (mimetype.includes('zip') || mimetype.includes('rar') || mimetype.includes('compressed')) return '📦';
  if (mimetype.includes('text')) return '📝';
  return '📄';
};

// 获取文件类型
const getFileType = (mimetype: string): string => {
  const parts = mimetype.split('/');
  return parts[parts.length - 1].toUpperCase();
};

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

// 格式化日期
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes === 0 ? '刚刚' : `${minutes}分钟前`;
    }
    return `${hours}小时前`;
  } else if (days === 1) {
    return '昨天';
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    return date.toLocaleDateString('zh-CN');
  }
};

// 获取文件URL
const getFileUrl = (url: string): string => {
  // 如果是相对路径，添加后端服务器地址
  if (url.startsWith('/')) {
    return `http://localhost:3000${url}`;
  }
  return url;
};

// 组件挂载时加载文件列表
onMounted(() => {
  loadFiles();
});

// 导出刷新方法供父组件调用
defineExpose({
  refreshList,
});
</script>

<style scoped>
.file-list-container {
  max-width: 800px;
  margin: 40px auto 0;
  padding: 20px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.list-header h2 {
  font-size: 24px;
  color: #fff;
}

.btn-refresh {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  color: #4b5563;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-refresh:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #3b82f6;
  color: #3b82f6;
}

.btn-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading {
  text-align: center;
  padding: 60px 20px;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading p {
  color: #6b7280;
  font-size: 16px;
}

.file-list {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  border-bottom: 1px solid #f3f4f6;
  transition: all 0.3s ease;
}

.file-item:last-child {
  border-bottom: none;
}

.file-item:hover {
  background: #f9fafb;
}

.file-icon-wrapper {
  flex-shrink: 0;
}

.file-icon {
  font-size: 40px;
  display: block;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #6b7280;
}

.separator {
  color: #d1d5db;
}

.file-actions {
  display: flex;
  gap: 8px;
}

.btn-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: transparent;
}

.btn-download {
  color: #3b82f6;
  text-decoration: none;
}

.btn-download:hover {
  background: #eff6ff;
}

.btn-delete {
  color: #ef4444;
}

.btn-delete:hover:not(:disabled) {
  background: #fee2e2;
}

.btn-delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mini-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #fee2e2;
  border-top-color: #ef4444;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

.empty-icon {
  font-size: 80px;
  margin-bottom: 20px;
  opacity: 0.5;
}

.empty-state h3 {
  font-size: 20px;
  color: #1f2937;
  margin-bottom: 10px;
}

.empty-state p {
  color: #6b7280;
  font-size: 14px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-top: 30px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

.btn-page {
  padding: 10px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-page:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-2px);
}

.btn-page:disabled {
  background: #e5e7eb;
  color: #9ca3af;
  cursor: not-allowed;
  transform: none;
}

.page-info {
  font-size: 14px;
  color: #4b5563;
  font-weight: 600;
}

.total-files {
  color: #6b7280;
  font-weight: 400;
  margin-left: 8px;
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

