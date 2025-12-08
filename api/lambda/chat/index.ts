import mongoose from 'mongoose';
import Conversation from '../../../src/lib/conversation';
import connectToDatabase from '../../../src/lib/dbService';
import { generateMemoryTags, vectorDB } from '../../../src/lib/memoryManager';

// API 路由处理器 - 导出命名函数以符合BFF架构标准

// 豆包 API 配置
const DOUBAO_API_URL =
  'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const DOUBAO_API_KEY = '02e001ce-37e4-4a35-90a5-38407e14524f';

// Tavily API 配置
const TAVILY_API_URL = 'https://api.tavily.com/search';
const TAVILY_API_KEY = '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';

const SYSTEM_PROMPT = `你是一名专业的教练，擅长根据用户的兴趣设定目标并提供指导。请以自然、友好的人类口吻与用户交流，避免使用格式化的标题或生硬的结构。

当用户分享兴趣时，帮助他们设定清晰可行的目标，包含明确的时间框架和可衡量的标准。在用户提问或日常对话时，提供简单实用的回答，确保内容易于理解和执行。

如果有联网搜索结果，请**必须**优先参考这些信息来回答，确保内容的时效性和准确性。你必须使用搜索结果中的信息来回答用户的问题，不能说自己无法获取实时信息或让用户自己去搜索。

当用户需要创建TODO列表时，请返回结构化的JSON格式数据，包含以下字段：
- type: "todo_list"
- title: 列表标题（不超过10个字符）
- items: 任务列表，每个任务包含：
  - id: 唯一标识符
  - text: 任务描述
  - completed: 是否完成（布尔值）
  - priority: 优先级（可选，'high'/'medium'/'low'）

始终保持友好、鼓励的语气，根据用户的反馈灵活调整你的建议，帮助用户保持动力并实现他们的目标。

请直接以连贯的自然语言回答，不要使用任何如"目标设定："、"回答："等格式化的标签，就像与人面对面交流一样。`;

// 决策prompt，用于判断需要执行的行动
const DECISION_PROMPT = `你是智能决策助手，需要根据用户的问题和上下文，判断需要执行的行动类型。请根据以下规则进行判断：

1. 如果问题涉及实时信息（如天气、新闻、体育赛事结果、股票价格、交通状况、最新政策等），需要执行SEARCH行动
2. 如果问题涉及特定领域的专业知识（如医学、法律、技术、金融、教育等）且可能需要最新资料，需要执行SEARCH行动
3. 如果问题是关于设定目标、制定计划或安排任务，需要执行PLAN行动
4. 如果问题是关于用户个人情况、兴趣爱好或历史对话，需要执行RETRIEVE_MEMORY行动
5. 如果问题是关于执行具体任务或操作（如计算、翻译、写作、设计等），需要执行EXECUTE行动
6. 如果问题是关于总结、分析或提供建议，需要执行ANALYZE行动
7. 如果问题涉及多步骤任务或需要综合多种信息，可能需要执行多个行动

请严格按照JSON格式输出，包含以下字段：
- actions: array，需要执行的行动列表，每个行动包含：
  - type: string，行动类型，可选值：SEARCH, PLAN, RETRIEVE_MEMORY, EXECUTE, ANALYZE
  - priority: number，优先级，1-5，数字越大优先级越高
  - reason: string，执行该行动的理由
- goal: string，用户的核心目标

不要输出任何额外内容，只输出JSON。`;

// TypeScript类型定义
interface Message {
  role: string;
  content: string;
  timestamp: number;
  _id?: string;
  thinking?: boolean;
}

// 定义内存存储的会话类型
interface MemoryConversation {
  id: string;
  userId: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  createdAt?: number;
}

interface ChatRequest {
  message?: string;
  useSearch?: boolean;
  chatId?: string;
  action?: string;
  content?: string;
  title?: string;
  // 反馈相关属性
  memoryId?: string;
  type?: 'positive' | 'negative' | 'neutral';
  comment?: string;
}

interface SearchResultItem {
  title: string;
  content: string;
}

// 行动类型定义
type ActionType = 'SEARCH' | 'PLAN' | 'RETRIEVE_MEMORY' | 'EXECUTE' | 'ANALYZE';

// 行动定义
interface Action {
  type: ActionType;
  priority: number;
  reason: string;
}

// 决策结果定义
interface DecisionResult {
  actions: Action[];
  goal: string;
}

// 内存存储（临时替代数据库）
const memoryStorage = {
  conversations: new Map<string, MemoryConversation>(),
  currentId: 1,
};

// AI总结标题函数，将长标题压缩到10字符以内
async function summarizeTitle(message: string): Promise<string> {
  try {
    const summaryResponse = await fetch(DOUBAO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DOUBAO_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'doubao-lite-32k-character-250228',
        messages: [
          {
            role: 'system',
            content:
              '请将用户的问题总结为不超过10个中文字符的标题，必须抓住核心关键词，只返回总结结果，不要添加任何解释或说明。',
          },
          { role: 'user', content: message },
        ],
        stream: false,
      }),
    });

    if (!summaryResponse.ok) {
      console.error(`标题总结API响应错误: ${summaryResponse.status}`);
      // 如果API调用失败，返回原始消息的前10字符
      return message.slice(0, 10);
    }

    const summaryData = await summaryResponse.json();
    const summaryContent = summaryData.choices?.[0]?.message?.content || '';

    // 确保总结结果不超过10字符
    return summaryContent.slice(0, 10);
  } catch (error) {
    console.error('标题总结抛出异常:', error);
    // 异常情况下返回原始消息的前10字符
    return message.slice(0, 10);
  }
}

// 生成会话列表标题
async function generateTitle(message: string): Promise<string> {
  // 如果消息长度≤10字符，直接返回
  if (message.length <= 10) {
    return message;
  }

  // 否则调用AI总结为≤10字符
  return await summarizeTitle(message);
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
        (item: SearchResultItem, i: number) =>
          `[${i + 1}] ${item.title}: ${item.content}`,
      )
      .join('\n\n');
  } catch (error) {
    console.error('搜索抛出异常:', error);
    return '';
  }
}

// 动态行动规划函数
async function planActions(
  message: string,
  userId: string,
): Promise<DecisionResult> {
  try {
    const decisionResponse = await fetch(DOUBAO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DOUBAO_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'doubao-lite-32k-character-250228',
        messages: [
          { role: 'system', content: DECISION_PROMPT },
          { role: 'user', content: message },
        ],
        stream: false,
      }),
    });

    if (!decisionResponse.ok) {
      console.error(`决策API响应错误: ${decisionResponse.status}`);
      // 默认执行搜索和分析行动
      return {
        actions: [
          { type: 'SEARCH', priority: 3, reason: 'API调用失败，默认执行搜索' },
          { type: 'ANALYZE', priority: 5, reason: 'API调用失败，默认执行分析' },
        ],
        goal: message,
      };
    }

    const decisionData = await decisionResponse.json();
    const decisionContent = decisionData.choices?.[0]?.message?.content || '';

    // 解析JSON决策结果
    try {
      const parsedDecision = JSON.parse(decisionContent) as DecisionResult;
      console.log('行动规划结果:', parsedDecision);
      return parsedDecision;
    } catch (parseError) {
      console.error('决策结果解析失败:', parseError);
      // 默认执行搜索和分析行动
      return {
        actions: [
          {
            type: 'SEARCH',
            priority: 3,
            reason: '决策结果格式错误，默认执行搜索',
          },
          {
            type: 'ANALYZE',
            priority: 5,
            reason: '决策结果格式错误，默认执行分析',
          },
        ],
        goal: message,
      };
    }
  } catch (error) {
    console.error('决策过程抛出异常:', error);
    // 默认执行搜索和分析行动
    return {
      actions: [
        { type: 'SEARCH', priority: 3, reason: '决策过程异常，默认执行搜索' },
        { type: 'ANALYZE', priority: 5, reason: '决策过程异常，默认执行分析' },
      ],
      goal: message,
    };
  }
}

// 执行行动函数
async function executeActions(
  actions: Action[],
  message: string,
  userId: string,
  systemPrompt: string,
): Promise<string> {
  let finalPrompt = systemPrompt;

  // 按优先级排序行动
  const sortedActions = [...actions].sort((a, b) => b.priority - a.priority);

  for (const action of sortedActions) {
    switch (action.type) {
      case 'SEARCH': {
        console.log('执行搜索行动...');
        const searchResults = await searchWeb(message);
        if (searchResults) {
          finalPrompt += `\n\n=== 联网搜索资料 ===\n${searchResults}`;
          finalPrompt += '\n\n=== 搜索结束 ===\n';
          finalPrompt +=
            '请**必须**优先参考这些搜索信息来回答，确保内容的时效性和准确性。';
        }
        break;
      }

      case 'RETRIEVE_MEMORY':
        console.log('执行记忆检索行动...');
        // 记忆检索已经在主逻辑中处理，但这里可以添加额外的记忆相关提示
        finalPrompt += '\n\n=== 记忆参考 ===\n';
        finalPrompt += '请参考用户的历史记忆和偏好，提供更加个性化的回答。';
        break;

      case 'PLAN':
        console.log('执行规划行动...');
        finalPrompt += '\n\n=== 行动规划 ===\n';
        finalPrompt += '请帮助用户制定详细的行动计划，包括：\n';
        finalPrompt += '1. 明确的步骤和时间框架\n';
        finalPrompt += '2. 可衡量的目标和成功标准\n';
        finalPrompt += '3. 可能的挑战和应对策略\n';
        finalPrompt += '4. 资源需求和优先级\n';
        finalPrompt += '5. 定期回顾和调整机制\n';
        break;

      case 'ANALYZE':
        console.log('执行分析行动...');
        finalPrompt += '\n\n=== 分析要求 ===\n';
        finalPrompt += '请对用户的问题进行深入分析，包括：\n';
        finalPrompt += '1. 问题的核心本质和关键要素\n';
        finalPrompt += '2. 相关因素和影响关系\n';
        finalPrompt += '3. 不同解决方案的优缺点\n';
        finalPrompt += '4. 基于数据和事实的结论\n';
        finalPrompt += '5. 可行的建议和行动方向\n';
        break;

      case 'EXECUTE':
        console.log('执行执行行动...');
        finalPrompt += '\n\n=== 执行要求 ===\n';
        finalPrompt += '请根据用户的要求，执行具体的任务或操作：\n';
        finalPrompt += '1. 如涉及计算，请提供详细的计算过程和结果\n';
        finalPrompt += '2. 如涉及翻译，请确保准确传达原意，保持语言流畅\n';
        finalPrompt += '3. 如涉及写作，请确保内容结构清晰，逻辑连贯\n';
        finalPrompt += '4. 如涉及设计，请提供具体的设计方案和实施步骤\n';
        finalPrompt += '5. 如涉及其他具体任务，请确保任务完成度和准确性\n';
        break;
    }
  }

  return finalPrompt;
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
        throw new Error(
          `数据库连接状态异常: ${mongoose.connection.readyState}`,
        );
      }
    } catch (e) {
      console.warn(
        '⚠️ 数据库连接失败，使用内存存储:',
        e instanceof Error ? e.message : e,
      );
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
      .sort(
        (a: MemoryConversation, b: MemoryConversation) =>
          b.updatedAt - a.updatedAt,
      )
      .map((conv: MemoryConversation) => ({
        _id: conv.id,
        title: conv.title,
        updatedAt: new Date(conv.updatedAt),
      }));

    console.log(`从内存中找到 ${memoryList.length} 条历史会话`);
    return { code: 200, data: memoryList };
  }

  if (data.action === 'getConversation') {
    const chatId = data.chatId;
    if (!chatId) {
      return { code: 400, error: '缺少chatId参数' };
    }
    console.log(`Action: getConversation, ID: ${chatId}`);

    // 检查 chatId 是否是有效的 MongoDB ObjectId
    const isValidObjectId = mongoose.Types.ObjectId.isValid(chatId);

    // 如果数据库已连接且 chatId 是有效的 ObjectId，尝试从数据库查询
    if (dbConnected && isValidObjectId) {
      try {
        const conv = await Conversation.findById(chatId);
        if (conv) {
          return { code: 200, data: conv };
        }
      } catch (e) {
        console.error('数据库查询失败:', e);
      }
    }

    // 从内存获取
    const conv = memoryStorage.conversations.get(chatId);
    if (conv) {
      return { code: 200, data: conv };
    }
    return { code: 404, error: '会话不存在' };
  }

  if (data.action === 'saveAiMessage') {
    const chatId = data.chatId;
    const content = data.content || '';
    if (!chatId) {
      return { code: 400, error: '缺少chatId参数' };
    }
    console.log(`Action: saveAiMessage, ID: ${chatId}`);

    // 检查 chatId 是否是有效的 MongoDB ObjectId
    const isValidObjectId = mongoose.Types.ObjectId.isValid(chatId);

    // 如果数据库已连接且 chatId 是有效的 ObjectId，尝试保存到数据库
    if (dbConnected && isValidObjectId) {
      try {
        await Conversation.findByIdAndUpdate(chatId, {
          $push: {
            messages: {
              role: 'assistant',
              content: content,
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
    const conv = memoryStorage.conversations.get(chatId);
    if (conv) {
      conv.messages.push({
        role: 'assistant',
        content: content,
        timestamp: Date.now(),
      });
      conv.updatedAt = Date.now();
      console.log('AI消息保存到内存成功');
      return { code: 200, msg: 'Saved' };
    }
    return { code: 404, error: '会话不存在' };
  }

  // 处理用户反馈
  if (data.action === 'feedback') {
    const { memoryId, type, comment } = data;
    if (!memoryId || !type) {
      return { code: 400, error: '缺少必要参数' };
    }

    console.log(`Action: feedback, Memory ID: ${memoryId}, Type: ${type}`);

    // 更新记忆反馈
    await vectorDB.updateMemoryFeedback(memoryId, {
      type: type as 'positive' | 'negative' | 'neutral',
      comment: comment || '',
      timestamp: Date.now(),
    });

    return { code: 200, msg: 'Feedback saved successfully' };
  }

  if (data.action === 'deleteSession') {
    try {
      const chatId = data.chatId;
      if (!chatId) {
        return { code: 400, error: '缺少chatId参数' };
      }
      // 检查 chatId 是否是有效的 MongoDB ObjectId
      const isValidObjectId = mongoose.Types.ObjectId.isValid(chatId);

      // 如果数据库已连接且 chatId 是有效的 ObjectId，尝试从数据库删除
      if (dbConnected && isValidObjectId) {
        try {
          await Conversation.findByIdAndDelete(chatId);
          return { code: 200, msg: 'Deleted' };
        } catch (e) {
          console.error('数据库删除失败:', e);
        }
      }

      // 从内存删除
      memoryStorage.conversations.delete(chatId);
      return { code: 200, msg: 'Deleted' };
    } catch (e) {
      return { code: 500, error: '删除失败' };
    }
  }

  if (data.action === 'renameSession') {
    try {
      const chatId = data.chatId;
      const title = data.title || '';
      if (!chatId) {
        return { code: 400, error: '缺少chatId参数' };
      }
      if (dbConnected) {
        await Conversation.findByIdAndUpdate(chatId, {
          title: title,
        });
      } else {
        const conv = memoryStorage.conversations.get(chatId);
        if (conv) {
          conv.title = title;
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
    const { message = '', chatId } = data;
    let currentConversation:
      | InstanceType<typeof Conversation>
      | MemoryConversation
      | null = null;
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
        const generatedTitle = await generateTitle(message);
        const newConv: MemoryConversation = {
          id: chatId,
          userId: 'user-1',
          title: generatedTitle,
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
      const generatedTitle = await generateTitle(message);
      const newConv: MemoryConversation = {
        id: String(memoryStorage.currentId++),
        userId: 'user-1',
        title: generatedTitle,
        messages: [{ role: 'user', content: message, timestamp: Date.now() }],
        updatedAt: Date.now(),
        createdAt: Date.now(),
      };

      if (dbConnected) {
        try {
          currentConversation = await Conversation.create({
            userId: 'user-1',
            title: generatedTitle,
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

    // 1. 生成当前消息的记忆
    const currentMemory = {
      id: `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: 'user-1',
      content: message,
      timestamp: Date.now(),
      tags: generateMemoryTags(message, finalSystemPrompt),
      context: 'user_query',
    };

    // 2. 存储记忆到向量数据库
    await vectorDB.storeMemory(currentMemory);

    // 3. 检索相关记忆
    const relevantMemories = await vectorDB.retrieveRelevantMemories(
      message,
      'user-1',
      3,
    );

    // 4. 如果有相关记忆，添加到系统提示中
    if (relevantMemories.length > 0) {
      finalSystemPrompt += '\n\n=== 相关记忆 ===\n';
      relevantMemories.forEach((memory, index) => {
        finalSystemPrompt += `${index + 1}. ${memory.content} (${new Date(memory.timestamp).toLocaleString()})\n`;
      });
      finalSystemPrompt += '=== 记忆结束 ===\n';
      finalSystemPrompt +=
        '请根据上述相关记忆来调整你的回答，确保符合用户的历史偏好和需求。';
    }

    // 5. 获取并添加用户偏好到系统提示
    const userPreferences = (await vectorDB.getUserPreferences('user-1')) as {
      pricePreference?: 'affordable' | 'high-end';
      foodAvoid?: string[];
      [key: string]: unknown;
    };
    if (Object.keys(userPreferences).length > 0) {
      finalSystemPrompt += '\n\n=== 用户偏好 ===\n';

      if (userPreferences.pricePreference) {
        finalSystemPrompt += `- 价格偏好: ${userPreferences.pricePreference === 'affordable' ? '平价' : '高端'}\n`;
      }

      if (userPreferences.foodAvoid && userPreferences.foodAvoid.length > 0) {
        finalSystemPrompt += `- 避免食物: ${userPreferences.foodAvoid.map(item => (item === 'seafood' ? '海鲜' : item)).join('、')}\n`;
      }

      // 添加其他偏好...

      finalSystemPrompt += '=== 偏好结束 ===\n';
      finalSystemPrompt += '请严格根据用户偏好调整你的回答，例如：\n';
      finalSystemPrompt += '- 如果用户偏好平价，推荐价格适中的餐厅；\n';
      finalSystemPrompt += '- 如果用户避免海鲜，推荐餐厅时避开海鲜店；\n';
      finalSystemPrompt += '- 始终考虑用户的历史反馈和偏好。';
    }

    // 6. 动态行动规划 - 由Agent自主判断需要执行的行动
    const decisionResult = await planActions(message, 'user-1');

    // 7. 执行规划的行动
    finalSystemPrompt = await executeActions(
      decisionResult.actions,
      message,
      'user-1',
      finalSystemPrompt,
    );

    // 8. 添加用户核心目标到系统提示
    finalSystemPrompt += '\n\n=== 用户核心目标 ===\n';
    finalSystemPrompt += `${decisionResult.goal}\n`;
    finalSystemPrompt +=
      '请确保你的回答始终围绕用户的核心目标，提供有针对性的帮助和建议。';

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

    // 收集AI回复的完整内容
    let aiResponseContent = '';

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

              // 将AI回复内容添加到内存中
              const chunk = new TextDecoder().decode(value);
              aiResponseContent += chunk;

              controller.enqueue(value);
            }
            console.log('流传输完成');

            // 存储AI回复作为记忆
            if (aiResponseContent) {
              const aiMemory = {
                id: `memory-ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                userId: 'user-1',
                content: aiResponseContent,
                timestamp: Date.now(),
                tags: generateMemoryTags(aiResponseContent, finalSystemPrompt),
                context: 'ai_response',
              };
              await vectorDB.storeMemory(aiMemory);
              console.log('AI回复已存储为记忆');
            }
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
  } catch (error: unknown) {
    console.error('❌ 全局错误捕获:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return new Response(
      JSON.stringify({
        error: `服务端错误: ${errorMessage}`,
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
