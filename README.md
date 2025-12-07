# AI Agent 应用系统

## 项目概述
本项目是一个基于 Modern.js 构建的 AI Agent 智能应用系统，集成了大语言模型能力、联网搜索功能和会话管理系统。系统采用前后端一体化架构，使用 BFF (Backend For Frontend) 模式提供统一的 API 接口服务。

## 主要功能特性

### 核心 AI 功能
- 🤖 **智能对话交互**：集成豆包 AI 模型，提供流畅的对话体验
- 🔍 **联网搜索能力**：通过 Tavily 搜索引擎获取实时信息，增强回答准确性
- � **会话持久化**：支持多会话管理和历史记录保存
- 📊 **流式输出**：支持 AI 响应的流式展示，提升交互体验

### 用户体验设计
- 🌓 **主题切换**：支持深色/浅色模式切换
- 📱 **响应式设计**：适配不同屏幕尺寸的设备
- 📝 **Markdown 渲染**：支持富文本内容展示
- 🔄 **交互反馈**：包含加载动画、错误提示和操作确认
- 📁 **会话管理**：创建、重命名、删除会话功能

## 技术栈

### 前端
- **框架**：React.js + Modern.js
- **样式**：Tailwind CSS + CSS Modules
- **状态管理**：React Context API
- **构建工具**：Vite

### 后端 (BFF)
- **运行环境**：Node.js
- **API 架构**：BFF (Backend For Frontend)
- **数据库**：MongoDB
- **API 集成**：豆包 AI API、Tavily Search API

### 开发工具
- **TypeScript**：静态类型检查
- **ESLint & Prettier**：代码规范和格式化
- **Biome**：代码质量工具

## 项目结构

```
my-agent-master/
├── api/                    # BFF API 实现
│   ├── lambda/             # API 路由处理器
│   │   ├── chat/           # 聊天相关 API
│   │   │   └── index.ts    # 聊天 API 主入口
│   │   ├── health.ts       # 健康检查 API
│   │   └── hello.ts        # 示例 API
│   └── routes.ts           # 路由配置
├── src/                    # 前端源代码
│   ├── api/                # 前端 API 调用封装
│   │   ├── chat.ts         # 聊天 API 客户端
│   │   ├── health.ts       # 健康检查 API 客户端
│   │   ├── hello.ts        # 示例 API 客户端
│   │   └── index.ts        # API 导出索引
│   ├── components/         # React 组件
│   ├── contexts/           # React Context
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # 工具库
│   ├── pages/              # 页面组件
│   │   └── Home.tsx        # 主页面
│   ├── App.tsx             # 应用入口组件
│   ├── index.css           # 全局样式
│   └── main.tsx            # 应用入口文件
├── modern.config.ts        # Modern.js 配置
├── package.json            # 项目依赖
├── tailwind.config.js      # Tailwind CSS 配置
└── tsconfig.json           # TypeScript 配置
```

## API 文档

### BFF API 接口

#### 1. 健康检查
- **URL**: `/api/health`
- **方法**: `GET`
- **描述**: 检查服务状态
- **响应**: 
  ```json
  {
    "status": "healthy",
    "timestamp": "2023-12-01T06:53:28.296Z",
    "service": "llmAgent",
    "version": "0.1.0",
    "dependencies": {
      "database": "connected",
      "api": "operational"
    }
  }
  ```

#### 2. 示例 API
- **URL**: `/api/hello`
- **方法**: `GET`
- **描述**: 测试 API 连接
- **响应**: 
  ```json
  {
    "message": "Hello Modern.js",
    "timestamp": "2023-12-01T06:57:25.566Z",
    "status": "success"
  }
  ```

#### 3. 聊天 API
- **URL**: `/api/chat`
- **方法**: `GET`, `POST`, `DELETE`
- **描述**: 聊天功能接口
- **功能**: 
  - `GET`: 获取聊天历史
  - `POST`: 发送聊天消息
  - `DELETE`: 清除聊天历史

## 快速开始

### 环境要求
- Node.js 16.x 或更高版本
- pnpm 包管理器
- MongoDB 数据库 (本地或远程)

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd my-agent-master
   ```

2. **安装依赖**
   ```bash
   pnpm install
   ```

3. **配置环境变量**
   复制 `.env.example` 文件为 `.env` 并填写相关配置:
   ```
   # AI 模型配置
   DOUBAO_API_KEY=your_doubao_api_key
   
   # 搜索引擎配置
   TAVILY_API_KEY=your_tavily_api_key
   
   # 数据库配置
   MONGODB_URI=mongodb://localhost:27017/ai-agent
   
   # 应用配置
   APP_PORT=3001
   ```

4. **启动开发服务器**
   ```bash
   pnpm run dev
   ```

5. **构建生产版本**
   ```bash
   pnpm run build
   ```

6. **运行生产版本**
   ```bash
   pnpm run start
   ```

## 开发指南

### 添加新的 API 端点

1. 在 `api/lambda/` 目录下创建新的处理器文件
2. 实现符合 BFF 架构的 API 函数
3. API 会自动根据文件路径映射到对应的路由

### 前端 API 调用

1. 在 `src/api/` 目录下创建对应的客户端文件
2. 导出 API 调用函数
3. 在 `src/api/index.ts` 中导出新的 API 模块

## 部署说明

### 本地部署
按照「快速开始」部分的步骤操作即可。

### 生产环境部署

1. **构建项目**
   ```bash
   pnpm run build
   ```

2. **部署选项**
   - **Docker**: 创建 Dockerfile 构建镜像
   - **云服务**: 可部署到 Vercel、Netlify、AWS 等平台
   - **传统服务器**: 上传构建产物并配置 Node.js 环境

3. **环境变量**
   确保生产环境中配置了正确的环境变量，特别是 API 密钥和数据库连接信息。

## 已知问题与待优化项

### 已知问题
- 创建新会话偶尔会创建重复会话
- 加载过程中未禁止切换会话
- Markdown 表格渲染问题

### 未来优化计划
- 会话重命名样式优化
- 多语言支持 (i18n)
- 深度思考模式实现
- 用户系统 (注册/登录)
- 模型微调与智能 Agent 架构升级


