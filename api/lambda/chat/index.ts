import mongoose from 'mongoose';
import Conversation from '../../../src/lib/conversation';
import connectToDatabase from '../../../src/lib/dbService';

// API 路由处理器 - 导出命名函数以符合BFF架构标准

// 豆包 API 配置
const DOUBAO_API_URL =
  'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const DOUBAO_API_KEY = '02e001ce-37e4-4a35-90a5-38407e14524f';

// Tavily API 配置
const TAVILY_API_URL = 'https://api.tavily.com/search';
const TAVILY_API_KEY = '17bdbd2e-bb81-4969-9d53-bfcd1e85abea';

const SYSTEM_PROMPT = `你是一名专业的教练，擅长根据用户的兴趣设定目标并提供指导。请以自然、友好的人类口吻与用户交流，避免使用格式化的标题或生硬的结构。

当用户分享兴趣时，帮助他们设定清晰可行的目标，包含明确的时间框架和可衡量的标准。在用户提问或日常对话时，提供简单实用的回答，确保内容易于理解和执行。

如果有联网搜索结果，请优先参考这些信息来回答，确保内容的时效性和准确性。始终保持友好、鼓励的语气，根据用户的反馈灵活调整你的建议，帮助用户保持动力并实现他们的目标。

请直接以连贯的自然语言回答，不要使用任何如"目标设定："、"回答："等格式化的标签，就像与人面对面交流一样。`;

// TypeScript类型定义
interface Message {
  role: string;
  content: string;
  timestamp: number;
  _id?: string;
  thinking?: boolean;
}

interface Conversation {
  id: string;
  userId: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  createdAt?: number;
  _id?: string;
}

interface ChatRequest {
  message?: string;
  useSearch?: boolean;
  chatId?: string;
  action?: string;
  content?: string;
  title?: string;
}

interface SearchResultItem {
  title: string;
  content: string;
}

// 内存存储（临时替代数据库）
const memoryStorage = {
  conversations: new Map<string, Conversation>(),
  currentId: 1,
};

// 生成会话列表标题
function generateTitle(message: string) {
  return message.slice(0, 15) + (message.length > 15 ? '...' : '');
}

// 搜索工具
async function searchWeb(query: string) {
  console.log(`正在执行搜索: ${query}`);
  try {
    const response = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: 'basic',
        include_answer: false,
        max_results: 5,
      }),
    });
    if (!response.ok) {
      console.error(`搜索API响应错误: ${response.status}`);
      return '';
    }
    const data = await response.json();
    console.log(`搜索成功，结果数量: ${data.results?.length || 0}`);
    return (data.results || [])
      .map(
        (item: SearchResultItem, i: number) => `[${i + 1}] ${item.title}: ${item.content}`,
      )
      .join('\n\n');
  } catch (error) {
    console.error('搜索抛出异常:', error);
    return '';
  }
}

// 检查数据库连接状态
let dbConnected = false;
let connectionPromise: Promise<void> | null = null;

async function checkDatabaseConnection() {
  // 如果已经连接，直接返回
  if (dbConnected && mongoose.connection.readyState === 1) {
    return true;
  }

  // 如果正在连接，等待连接完成
  if (connectionPromise) {
    try {
      await connectionPromise;
      return dbConnected;
    } catch (e) {
      return false;
    }
  }

  // 开始新的连接
  connectionPromise = (async () => {
    try {
      await connectToDatabase();
      
      // 检查连接状态（1 = connected）
      if (mongoose.connection.readyState === 1) {
        dbConnected = true;
        console.log('✅ 数据库连接成功');
      } else {
        throw new Error(`数据库连接状态异常: ${mongoose.connection.readyState}`);
      }
    } catch (e) {
      console.warn('⚠️ 数据库连接失败，使用内存存储:', e instanceof Error ? e.message : e);
      dbConnected = false;
      throw e;
    } finally {
      connectionPromise = null;
    }
  })();

  try {
    await connectionPromise;
    return dbConnected;
  } catch (e) {
    // 连接失败，但不抛出错误，让应用继续使用内存存储
    return false;
  }
}

export const post = async ({ data }: { data: ChatRequest }) => {
  console.log('==========收到请求 ==========');
  console.log('请求参数:', JSON.stringify(data, null, 2));

  // 检查数据库连接
  await checkDatabaseConnection();

  // 处理不同 Action
  if (data.action === 'getHistory') {
    console.log('Action: getHistory');

    if (dbConnected) {
      try {
        const list = await Conversation.find({ userId: 'user-1' })
          .sort({ updatedAt: -1 })
          .select('title updatedAt');
        console.log(`找到 ${list.length} 条历史会话`);
        return { code: 200, data: list };
      } catch (e) {
        console.error('数据库查询失败:', e);
      }
    }

    // 返回内存中的会话
    const memoryList = Array.from(memoryStorage.conversations.values())
      .sort((a: any, b: any) => b.updatedAt - a.updatedAt)
      .map((conv: any) => ({
        _id: conv.id,
        title: conv.title,
        updatedAt: new Date(conv.updatedAt),
      }));

    console.log(`从内存中找到 ${memoryList.length} 条历史会话`);
    return { code: 200, data: memoryList };
  }

  if (data.action === 'getConversation') {
    console.log(`Action: getConversation, ID: ${data.chatId}`);

    // 检查 chatId 是否是有效的 MongoDB ObjectId
    const isValidObjectId = mongoose.Types.ObjectId.isValid(data.chatId);

    // 如果数据库已连接且 chatId 是有效的 ObjectId，尝试从数据库查询
    if (dbConnected && isValidObjectId) {
      try {
        const conv = await Conversation.findById(data.chatId);
        if (conv) {
          return { code: 200, data: conv };
        }
      } catch (e) {
        console.error('数据库查询失败:', e);
      }
    }

    // 从内存获取
    const conv = memoryStorage.conversations.get(data.chatId);
    if (conv) {
      return { code: 200, data: conv };
    } else {
      return { code: 404, error: '会话不存在' };
    }
  }

  if (data.action === 'saveAiMessage') {
    console.log(`Action: saveAiMessage, ID: ${data.chatId}`);

    // 检查 chatId 是否是有效的 MongoDB ObjectId
    const isValidObjectId = mongoose.Types.ObjectId.isValid(data.chatId);

    // 如果数据库已连接且 chatId 是有效的 ObjectId，尝试保存到数据库
    if (dbConnected && isValidObjectId) {
      try {
        await Conversation.findByIdAndUpdate(data.chatId, {
          $push: {
            messages: {
              role: 'assistant',
              content: data.content,
              timestamp: Date.now(),
            },
          },
        });
        console.log('AI消息保存到数据库成功');
        return { code: 200, msg: 'Saved' };
      } catch (e) {
        console.error('保存AI消息到数据库失败:', e);
        // 如果数据库保存失败，继续尝试保存到内存
      }
    }

    // 内存保存（如果 chatId 不是有效的 ObjectId，或者数据库保存失败）
    const conv = memoryStorage.conversations.get(data.chatId);
    if (conv) {
      conv.messages.push({
        role: 'assistant',
        content: data.content,
        timestamp: Date.now(),
      });
      conv.updatedAt = Date.now();
      console.log('AI消息保存到内存成功');
      return { code: 200, msg: 'Saved' };
    } else {
      return { code: 404, error: '会话不存在' };
    }
  }

  if (data.action === 'deleteSession') {
    try {
      // 检查 chatId 是否是有效的 MongoDB ObjectId
      const isValidObjectId = mongoose.Types.ObjectId.isValid(data.chatId);

      // 如果数据库已连接且 chatId 是有效的 ObjectId，尝试从数据库删除
      if (dbConnected && isValidObjectId) {
        try {
          await Conversation.findByIdAndDelete(data.chatId);
          return { code: 200, msg: 'Deleted' };
        } catch (e) {
          console.error('数据库删除失败:', e);
        }
      }

      // 从内存删除
      memoryStorage.conversations.delete(data.chatId);
      return { code: 200, msg: 'Deleted' };
    } catch (e) {
      return { code: 500, error: '删除失败' };
    }
  }

  if (data.action === 'renameSession') {
    try {
      if (dbConnected) {
        await Conversation.findByIdAndUpdate(data.chatId, {
          title: data.title,
        });
      } else {
        const conv = memoryStorage.conversations.get(data.chatId);
        if (conv) {
          conv.title = data.title;
        }
      }
      return { code: 200, msg: 'Renamed' };
    } catch (e) {
      return { code: 500, error: '重命名失败' };
    }
  }

  // 核心聊天逻辑
  try {
    console.log('进入聊天逻辑...');
    const { message, useSearch, chatId } = data;
    let currentConversation;
    let finalSystemPrompt = SYSTEM_PROMPT;

    // 处理会话存储
    if (chatId) {
      console.log(`更新已有会话: ${chatId}`);

      // 检查 chatId 是否是有效的 MongoDB ObjectId
      const isValidObjectId = mongoose.Types.ObjectId.isValid(chatId);

      // 尝试从数据库获取
      if (dbConnected && isValidObjectId) {
        try {
          currentConversation = await Conversation.findById(chatId);
          if (currentConversation) {
            currentConversation.messages.push({
              role: 'user',
              content: message,
              timestamp: Date.now(),
            });
            currentConversation.updatedAt = new Date();
            await currentConversation.save();
            console.log('用户消息已保存到数据库');
          }
        } catch (e) {
          console.error('数据库操作失败:', e);
        }
      }

      // 尝试从内存获取
      currentConversation = memoryStorage.conversations.get(chatId);
      if (currentConversation) {
        currentConversation.messages.push({
          role: 'user',
          content: message,
          timestamp: Date.now(),
        });
        currentConversation.updatedAt = Date.now();
        console.log('用户消息已保存到内存');
      } else {
        // 如果找不到，但传入了 chatId，说明应该使用这个 chatId 创建新对话
        // 这通常发生在内存被清空但前端还保留 chatId 的情况
        console.warn(`未找到指定ID的会话 ${chatId}，将使用该ID创建新对话`);
        const newConv = {
          id: chatId, // 使用传入的 chatId
          userId: 'user-1',
          title: generateTitle(message),
          messages: [{ role: 'user', content: message, timestamp: Date.now() }],
          updatedAt: Date.now(),
          createdAt: Date.now(),
        };
        currentConversation = newConv;
        memoryStorage.conversations.set(chatId, newConv);
        console.log(`使用指定ID创建新会话: ${chatId}`);
      }
    }

    // 只有在没有传入 chatId 时才创建全新的会话
    if (!currentConversation && !chatId) {
      console.log('创建新会话');
      const newConv = {
        id: String(memoryStorage.currentId++),
        userId: 'user-1',
        title: generateTitle(message),
        messages: [{ role: 'user', content: message, timestamp: Date.now() }],
        updatedAt: Date.now(),
        createdAt: Date.now(),
      };

      if (dbConnected) {
        try {
          currentConversation = await Conversation.create({
            userId: 'user-1',
            title: generateTitle(message),
            messages: [
              { role: 'user', content: message, timestamp: Date.now() },
            ],
          });
          console.log(`新会话创建成功 ID: ${currentConversation._id}`);
        } catch (e) {
          console.error('数据库创建失败，使用内存:', e);
        }
      }

      if (!currentConversation) {
        currentConversation = newConv;
        memoryStorage.conversations.set(
          currentConversation.id,
          currentConversation,
        );
        console.log(`新会话创建到内存成功 ID: ${currentConversation.id}`);
      }
    }

    // 联网搜索
    if (useSearch) {
      const searchResults = await searchWeb(message);
      if (searchResults) {
        finalSystemPrompt += `\n\n联网搜索资料:\n${searchResults}`;
      }
    }

    // 调用豆包 API
    console.log('正在请求豆包 API...');

    const requestBody = {
      model: 'doubao-lite-32k-character-250228',
      messages: [
        { role: 'system', content: finalSystemPrompt },
        { role: 'user', content: message },
      ],
      stream: true,
    };

    console.log('请求体:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(DOUBAO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DOUBAO_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`豆包API错误: ${response.status} - ${errText}`);

      return new Response(
        JSON.stringify({
          error: `API请求失败: ${response.status}`,
          details: errText,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    console.log('豆包API请求成功，准备流式返回');

    // 返回流
    return new Response(
      new ReadableStream({
        async start(controller) {
          const reader = response.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
            console.log('流传输完成');
          } catch (error) {
            console.error('流读取错误:', error);
          } finally {
            controller.close();
            reader.releaseLock();
          }
        },
      }),
      {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'x-chat-id':
            currentConversation.id ||
            currentConversation._id?.toString() ||
            'memory-id',
        },
      },
    );
  } catch (error: any) {
    console.error('❌ 全局错误捕获:', error);
    return new Response(
      JSON.stringify({
        error: `服务端错误: ${error.message}`,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
};
