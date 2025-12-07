// 聊天API接口文件

// 获取聊天历史
export async function getChatHistory() {
  try {
    const response = await fetch('/api/chat', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('获取聊天历史失败:', error);
    throw error;
  }
}

// 发送聊天消息
export async function sendChatMessage(message: string) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('发送消息失败:', error);
    throw error;
  }
}

// 获取会话信息
export async function getConversation(conversationId: string) {
  try {
    const response = await fetch(`/api/chat/${conversationId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('获取会话信息失败:', error);
    throw error;
  }
}

// 清除聊天历史
export async function clearChatHistory() {
  try {
    const response = await fetch('/api/chat', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('清除聊天历史失败:', error);
    throw error;
  }
}

// 导出所有聊天相关函数
export default {
  getChatHistory,
  sendChatMessage,
  getConversation,
  clearChatHistory,
};