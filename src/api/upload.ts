import axios from 'axios';

// 创建 axios 实例
const api = axios.create({
  baseURL: '/api',
  timeout: 300000, // 5分钟超时
});

// 文件信息接口
export interface FileInfo {
  id: number;
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
  url: string;
  createdAt: string;
}

// 上传单个文件
export const uploadSingleFile = (
  file: File,
  onProgress?: (progressEvent: any) => void
) => {
  const formData = new FormData();
  formData.append('file', file);

  return api.post('/upload/single', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: onProgress,
  });
};

// 上传多个文件
export const uploadMultipleFiles = (
  files: File[],
  onProgress?: (progressEvent: any) => void
) => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  return api.post('/upload/multiple', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: onProgress,
  });
};

// 获取文件列表
export const getFileList = (page: number = 1, limit: number = 10) => {
  return api.get<{
    files: FileInfo[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }>('/upload/files', {
    params: { page, limit },
  });
};

// 根据ID获取文件信息
export const getFileById = (id: number) => {
  return api.get<FileInfo>(`/upload/files/${id}`);
};

// 删除文件
export const deleteFile = (id: number) => {
  return api.delete(`/upload/files/${id}`);
};

