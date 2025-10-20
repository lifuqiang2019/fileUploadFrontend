# 文件上传系统 - 前端项目

基于 Vue 3 + TypeScript + Vite 构建的现代化文件上传前端应用。

## ✨ 功能特性

- 📤 **单文件/多文件上传**：支持一次选择多个文件上传
- 🎯 **拖拽上传**：支持拖拽文件到上传区域
- 📊 **实时进度**：显示文件上传进度条
- 📋 **文件列表**：查看已上传的文件列表
- 🗑️ **文件删除**：删除不需要的文件
- 📄 **分页功能**：支持文件列表分页显示
- 🎨 **美观UI**：现代化、响应式设计

## 🛠 技术栈

- **Vue 3** - 渐进式JavaScript框架
- **TypeScript** - 类型安全
- **Vite** - 下一代前端构建工具
- **Axios** - HTTP客户端

## 📦 安装依赖

```bash
# 使用 pnpm
pnpm install

# 或使用 npm
npm install

# 或使用 yarn
yarn install
```

## 🚀 运行项目

### 开发模式

```bash
pnpm dev
```

访问 http://localhost:5173

### 生产构建

```bash
pnpm build
```

### 预览构建

```bash
pnpm preview
```

## ⚙️ 配置说明

### API代理配置

项目已在 `vite.config.ts` 中配置了API代理：

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
  '/uploads': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
}
```

### 后端接口

确保后端服务运行在 `http://localhost:3000`

后端接口文档：
- `POST /upload/single` - 单文件上传
- `POST /upload/multiple` - 多文件上传
- `GET /upload/files` - 获取文件列表
- `GET /upload/files/:id` - 获取文件详情
- `DELETE /upload/files/:id` - 删除文件

## 📁 项目结构

```
frontend/
├── src/
│   ├── api/
│   │   └── upload.ts          # API接口封装
│   ├── components/
│   │   ├── FileUpload.vue     # 文件上传组件
│   │   └── FileList.vue       # 文件列表组件
│   ├── App.vue                # 根组件
│   ├── main.ts                # 入口文件
│   └── style.css              # 全局样式
├── public/                    # 静态资源
├── index.html                 # HTML模板
├── vite.config.ts            # Vite配置
├── tsconfig.json             # TypeScript配置
└── package.json              # 项目配置
```

## 🎨 组件说明

### FileUpload 组件

文件上传组件，支持：
- 点击选择文件
- 拖拽上传
- 实时上传进度显示
- 上传状态提示

**事件：**
- `@uploadSuccess` - 上传成功时触发

### FileList 组件

文件列表组件，支持：
- 分页显示文件列表
- 文件下载
- 文件删除
- 自动刷新

**方法：**
- `refreshList()` - 刷新文件列表

## 🔧 开发建议

1. 确保后端服务已启动
2. 检查API接口地址是否正确
3. 使用浏览器开发者工具查看网络请求

## 📝 注意事项

- 单个文件大小限制：10MB
- 支持任意文件格式
- 需要确保后端服务已启用CORS

## 🌟 特性预览

- ✅ 拖拽上传
- ✅ 进度条显示
- ✅ 响应式设计
- ✅ 优雅的错误处理
- ✅ 文件类型图标
- ✅ 相对时间显示

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
