// 记忆模型定义
interface Memory {
  id: string;
  userId: string;
  content: string;
  timestamp: number;
  tags: string[];
  context: string;
  feedback?: {
    type: 'positive' | 'negative' | 'neutral';
    comment: string;
    timestamp: number;
  };
}

// 带相似度的记忆类型
interface MemoryWithSimilarity extends Memory {
  __similarity: number;
}

// 用户偏好类型
type UserPreferences = {
  pricePreference?: 'affordable' | 'high-end';
  foodAvoid?: string[];
  [key: string]: unknown;
};

// 记忆标签生成函数
export function generateMemoryTags(content: string, context: string): string[] {
  // 简单的标签生成逻辑，可以后续替换为更复杂的NLP模型
  const tags: string[] = [];

  // 提取关键词
  const keywords = extractKeywords(content, context);
  tags.push(...keywords);

  // 添加时间标签
  const now = new Date();
  tags.push(`time:${now.toISOString().split('T')[0]}`);

  // 添加场景标签
  const scene = detectScene(content, context);
  tags.push(`scene:${scene}`);

  return [...new Set(tags)];
}

// 简单的关键词提取
function extractKeywords(content: string, context: string): string[] {
  const combined = `${content} ${context}`;
  const words = combined.toLowerCase().split(/\s+/);

  // 过滤常用词
  const stopWords = new Set([
    '的',
    '了',
    '是',
    '在',
    '我',
    '有',
    '和',
    '就',
    '不',
    '人',
    '都',
    '一',
    '一个',
    '上',
    '也',
    '很',
    '到',
    '说',
    '要',
    '去',
    '你',
    '会',
    '着',
    '没有',
    '看',
    '好',
    '自己',
    '这',
  ]);
  const filtered = words.filter(
    word => word.length > 1 && !stopWords.has(word),
  );

  // 统计词频
  const wordCount: Record<string, number> = {};
  for (const word of filtered) {
    wordCount[word] = (wordCount[word] || 0) + 1;
  }

  // 取前5个高频词
  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

// 场景检测
function detectScene(content: string, context: string): string {
  const combined = `${content} ${context}`.toLowerCase();

  if (combined.includes('天气') || combined.includes('气温')) {
    return 'weather';
  }

  if (
    combined.includes('推荐') ||
    combined.includes('餐厅') ||
    combined.includes('食物')
  ) {
    return 'recommendation';
  }

  if (
    combined.includes('过敏') ||
    combined.includes('食物') ||
    combined.includes('不能吃')
  ) {
    return 'health';
  }

  if (
    combined.includes('价格') ||
    combined.includes('贵') ||
    combined.includes('便宜')
  ) {
    return 'price';
  }

  return 'general';
}

// 模拟向量数据库接口
export class MockVectorDB {
  private memories: Map<string, Memory> = new Map();
  // 用户偏好存储
  private userPreferences: Map<string, UserPreferences> = new Map();

  // 存储记忆
  async storeMemory(memory: Memory): Promise<void> {
    this.memories.set(memory.id, memory);
    console.log(`记忆已存储: ${memory.id}`, memory.tags);

    // 更新用户偏好
    this.updateUserPreferences(memory.userId, memory);
  }

  // 检索相关记忆
  async retrieveRelevantMemories(
    query: string,
    userId: string,
    limit = 3,
  ): Promise<Memory[]> {
    const queryTags = generateMemoryTags(query, '');
    const relevantMemories: Memory[] = [];

    // 简单的标签匹配检索
    for (const memory of this.memories.values()) {
      if (memory.userId === userId) {
        let tagMatchCount = 0;

        // 标签匹配
        for (const tag of memory.tags) {
          if (
            queryTags.some(
              queryTag => tag.includes(queryTag) || queryTag.includes(tag),
            )
          ) {
            tagMatchCount++;
          }
        }

        // 考虑用户反馈的权重
        let feedbackWeight = 1.0;
        if (memory.feedback) {
          if (memory.feedback.type === 'positive') {
            feedbackWeight = 1.5; // 正面反馈增加权重
          } else if (memory.feedback.type === 'negative') {
            feedbackWeight = 0.5; // 负面反馈降低权重
          }
        }

        // 计算最终相似度分数
        const similarityScore = tagMatchCount * feedbackWeight;

        if (similarityScore > 0) {
          relevantMemories.push({
            ...memory,
            // 相似度评分（基于标签匹配数和反馈权重）
            __similarity: similarityScore,
          } as MemoryWithSimilarity);
        }
      }
    }

    // 按相似度和时间排序
    return relevantMemories
      .sort((a, b) => {
        // 先按相似度排序，再按时间排序
        const simDiff =
          (b as MemoryWithSimilarity).__similarity -
          (a as MemoryWithSimilarity).__similarity;
        if (simDiff !== 0) return simDiff;
        return b.timestamp - a.timestamp;
      })
      .slice(0, limit)
      .map(memory => {
        // 移除临时相似度字段
        const { __similarity, ...cleanMemory } = memory as MemoryWithSimilarity;
        return cleanMemory;
      });
  }

  // 更新记忆反馈
  async updateMemoryFeedback(
    memoryId: string,
    feedback: Memory['feedback'],
  ): Promise<void> {
    const memory = this.memories.get(memoryId);
    if (memory) {
      memory.feedback = feedback;
      this.memories.set(memoryId, memory);
      console.log(`记忆反馈已更新: ${memoryId}`);

      // 更新用户偏好
      this.updateUserPreferences(memory.userId, memory);
    }
  }

  // 更新用户偏好
  private updateUserPreferences(userId: string, memory: Memory): void {
    const preferences = this.userPreferences.get(userId) || {};

    // 提取用户偏好
    const content = memory.content.toLowerCase();

    // 处理价格偏好
    if (
      content.includes('贵') ||
      content.includes('太贵') ||
      content.includes('价格高')
    ) {
      preferences.pricePreference = 'affordable';
    } else if (
      content.includes('便宜') ||
      content.includes('性价比') ||
      content.includes('经济')
    ) {
      preferences.pricePreference = 'affordable';
    } else if (
      content.includes('高端') ||
      content.includes('豪华') ||
      content.includes('品质')
    ) {
      preferences.pricePreference = 'high-end';
    }

    // 处理食物偏好
    if (
      content.includes('海鲜') &&
      (content.includes('过敏') ||
        content.includes('不能吃') ||
        content.includes('避免'))
    ) {
      preferences.foodAvoid = preferences.foodAvoid || [];
      if (!preferences.foodAvoid.includes('seafood')) {
        preferences.foodAvoid.push('seafood');
      }
    }

    // 处理其他偏好...

    this.userPreferences.set(userId, preferences);
    console.log(`用户偏好已更新: ${userId}`, preferences);
  }

  // 获取用户偏好
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    return this.userPreferences.get(userId) || {};
  }
}

// 创建全局向量数据库实例
export const vectorDB = new MockVectorDB();
