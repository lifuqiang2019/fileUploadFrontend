<script setup lang="ts">
import { ref } from 'vue';
import FileUpload from './components/FileUpload.vue';
import FileList from './components/FileList.vue';

const fileListRef = ref<InstanceType<typeof FileList> | null>(null);

// 上传成功后刷新文件列表
const handleUploadSuccess = () => {
  fileListRef.value?.refreshList();
};
</script>

<template>
  <div class="app-container">
    <div class="hero-section">
      <div class="hero-content">
        <h1 class="hero-title">
          <span class="gradient-text">文件上传系统</span>
        </h1>
        <p class="hero-description">
          基于 Vue 3 + Vite + NestJS 构建的现代化文件上传解决方案
        </p>
      </div>
    </div>

    <div class="main-content">
      <FileUpload @uploadSuccess="handleUploadSuccess" />
      <FileList ref="fileListRef" />
    </div>

    <footer class="app-footer">
      <p>💡 支持任意格式文件上传 | 单个文件限制 10MB</p>
    </footer>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  background-color:#000;
  padding: 20px;
}

.hero-section {
  text-align: center;
  padding: 60px 20px 40px;
}

.hero-content {
  max-width: 800px;
  margin: 0 auto;
}

.hero-title {
  font-size: 56px;
  font-weight: 800;
  margin-bottom: 20px;
  line-height: 1.2;
}

.gradient-text {
  color: #ffffff;
}

.hero-description {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 0;
  font-weight: 500;
}

.main-content {
  background: transparent;
  border-radius: 24px;
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.app-footer {
  text-align: center;
  padding: 40px 20px 20px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
}

@media (max-width: 768px) {
  .hero-title {
    font-size: 36px;
  }

  .hero-description {
    font-size: 16px;
  }
  
  .app-container {
    padding: 10px;
  }
}
</style>
