import mongoose, { type Document, type Model } from 'mongoose';

// MongoDB连接配置
const MONGODB_URI =
  'mongodb+srv://2061997293_db_user:159357yyt@cluster0.mgbpuot.mongodb.net/?appName=Cluster0';

// 消息接口定义
export interface MessageDocument extends Document {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  thinking?: boolean;
}

// 聊天历史接口定义
export interface ChatHistoryDocument extends Document {
  title: string;
  messages: MessageDocument[];
  createdAt: Date;
  updatedAt: Date;
}

// 消息模式定义
const MessageSchema: mongoose.Schema<MessageDocument> = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  thinking: {
    type: Boolean,
    default: false,
  },
});

// 聊天历史模式定义
const ChatHistorySchema: mongoose.Schema<ChatHistoryDocument> =
  new mongoose.Schema({
    title: {
      type: String,
      required: true,
      default: '新对话',
    },
    messages: [MessageSchema],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  });

// 更新时间戳中间件
ChatHistorySchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// 数据库服务类
export class DatabaseService {
  private ChatHistoryModel: Model<ChatHistoryDocument>;
  private isConnected = false;

  constructor() {
    this.ChatHistoryModel = mongoose.model<ChatHistoryDocument>(
      'ChatHistory',
      ChatHistorySchema,
    );
  }

  // 连接到MongoDB
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await mongoose.connect(MONGODB_URI);
      this.isConnected = true;
      console.log('成功连接到MongoDB数据库');
    } catch (error) {
      console.error('MongoDB连接失败:', error);
      throw new Error('数据库连接失败');
    }
  }

  // 创建新的聊天历史
  async createChatHistory(title?: string): Promise<ChatHistoryDocument> {
    await this.connect();
    const chatHistory = new this.ChatHistoryModel({
      title: title || '新对话',
    });
    return chatHistory.save();
  }

  // 获取所有聊天历史
  async getAllChatHistories(): Promise<ChatHistoryDocument[]> {
    await this.connect();
    return this.ChatHistoryModel.find().sort({ updatedAt: -1 });
  }

  // 获取指定ID的聊天历史
  async getChatHistoryById(id: string): Promise<ChatHistoryDocument | null> {
    await this.connect();
    return this.ChatHistoryModel.findById(id);
  }

  // 更新聊天历史
  async updateChatHistory(
    id: string,
    data: Partial<ChatHistoryDocument>,
  ): Promise<ChatHistoryDocument | null> {
    await this.connect();
    return this.ChatHistoryModel.findByIdAndUpdate(id, data, { new: true });
  }

  // 添加消息到聊天历史
  async addMessageToChatHistory(
    chatId: string,
    message: Omit<MessageDocument, '_id'>,
  ): Promise<ChatHistoryDocument | null> {
    await this.connect();
    return this.ChatHistoryModel.findByIdAndUpdate(
      chatId,
      {
        $push: { messages: message },
        $set: { updatedAt: new Date() },
      },
      { new: true },
    );
  }

  // 删除聊天历史
  async deleteChatHistory(id: string): Promise<boolean> {
    await this.connect();
    const result = await this.ChatHistoryModel.findByIdAndDelete(id);
    return result !== null;
  }
}
if (!MONGODB_URI) {
  throw new Error('请在环境变量中定义 MONGODB_URI');
}

declare const global: typeof globalThis & {
  mongoose?: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
};

const cached = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

async function connectToDatabase() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000, // 5秒超时
        socketTimeoutMS: 45000, // 45秒socket超时
      } as mongoose.ConnectOptions)
      .then(mongoose => {
        return mongoose;
      });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectToDatabase;
// 导出数据库服务实例
export const dbService = new DatabaseService();
