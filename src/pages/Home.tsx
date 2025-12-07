import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Globe,
  MessageSquare,
  Mic,
  Moon,
  Plus,
  Search,
  Send,
  Settings,
  Sun,
  Trash2,
  User,
} from 'lucide-react';
// Home.tsx
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import './Home.css'; // 导入CSS文件

// 消息类型定义
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: boolean;
  timestamp: Date;
  isSearchResult?: boolean; // 标记是否为联网搜索结果
}

// 对话历史类型定义
interface ChatHistory {
  id: string;
  title: string;
  messages: Message[];
  timestamp: Date;
}

export default function Home() {
  // 状态管理
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // 搜索相关状态
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{
      id: string;
      chatId: string;
      messageId: string;
      content: string;
      role: string;
      snippet: string;
      index: number;
    }>
  >([]);

  // 切换主题
  const toggleTheme = () => {
    setIsDark(!isDark);
    document.body.classList.toggle('dark-mode');
  };

  // 加载聊天历史
  useEffect(() => {
    const loadChatHistories = async () => {
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getHistory' }),
        });

        const data = await response.json();

        if (data.code === 200) {
          const histories = data.data.map(
            (item: { _id: string; title: string; updatedAt: string }) => ({
              id: item._id,
              title: item.title,
              messages: [],
              timestamp: new Date(item.updatedAt),
            }),
          );

          setChatHistories(histories);

          // 只有在初始加载且没有activeChatId时才自动选择第一个对话
          // 避免在新建对话（activeChatId被设为null）时自动跳转
          if (histories.length > 0 && !activeChatId && messages.length === 0) {
            setActiveChatId(histories[0].id);
            loadConversation(histories[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load chat histories:', error);
        const savedHistories = localStorage.getItem('chatHistories');
        if (savedHistories) {
          try {
            const parsedHistories = JSON.parse(savedHistories);
            setChatHistories(parsedHistories);
          } catch (error) {
            console.error('Failed to parse chat histories:', error);
          }
        }
      }
    };

    loadChatHistories();
  }, [activeChatId, messages.length]);

  // 加载特定对话的消息
  const loadConversation = async (chatId: string) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getConversation', chatId }),
      });

      const data = await response.json();

      if (data.code === 200 && data.data) {
        const conversationMessages = data.data.messages.map(
          (msg: {
            _id?: string;
            role: string;
            content: string;
            timestamp: number;
            thinking?: boolean;
          }) => ({
            id: msg._id || `msg-${msg.timestamp}`,
            role: msg.role,
            content: msg.content,
            thinking: msg.thinking || false,
            timestamp: new Date(msg.timestamp),
          }),
        );

        setMessages(conversationMessages);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // 创建新对话
  const createNewChat = async () => {
    setActiveChatId(null);
    setMessages([]);
    // 确保输入框为空
    setInput('');
    // 关闭搜索框（如果打开）
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // 切换对话
  const switchChat = (chatId: string) => {
    setActiveChatId(chatId);
    loadConversation(chatId);
  };

  // 删除对话
  const deleteChat = async (chatId: string) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteSession', chatId }),
      });

      if (response.ok) {
        setChatHistories(chatHistories.filter(chat => chat.id !== chatId));
        if (activeChatId === chatId) {
          setActiveChatId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
      toast.error('删除对话失败');
    }
  };

  // 跟踪是否使用联网搜索
  const [isUsingSearch, setIsUsingSearch] = useState(false);

  // 使用联网搜索发送消息
  const sendMessageWithSearch = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);
    setIsUsingSearch(true); // 设置搜索状态为true，显示按钮激活样式

    const thinkingMessage: Message = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      thinking: true,
      timestamp: new Date(),
    };

    setMessages([...newMessages, thinkingMessage]);

    try {
      // 关键区别：useSearch设为true
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input.trim(),
          useSearch: true,
          chatId: activeChatId,
        }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.details || errorMessage;
        } catch (e) {}
        throw new Error(errorMessage);
      }

      const newChatId = response.headers.get('x-chat-id');
      if (newChatId && !activeChatId) {
        setActiveChatId(newChatId);
        const loadHistories = async () => {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getHistory' }),
          });
          const data = await res.json();
          if (data.code === 200) {
            const histories = data.data.map(
              (item: { _id: string; title: string; updatedAt: string }) => ({
                id: item._id,
                title: item.title,
                messages: [],
                timestamp: new Date(item.updatedAt),
              }),
            );
            setChatHistories(histories);
          }
        };
        loadHistories();
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder('utf-8');
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';
              if (content) {
                fullContent += content;
                setMessages(prevMessages =>
                  prevMessages.map(msg =>
                    msg.id === thinkingMessage.id
                      ? {
                          ...msg,
                          content: fullContent,
                          thinking: false,
                          isSearchResult: true, // 标记为搜索结果
                        }
                      : msg,
                  ),
                );
              }
            } catch (e) {}
          }
        }
      }

      if (newChatId || activeChatId) {
        const finalChatId = newChatId || activeChatId;
        if (finalChatId && fullContent) {
          try {
            await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'saveAiMessage',
                chatId: finalChatId,
                content: fullContent,
              }),
            });
          } catch (error) {
            console.warn('保存AI消息失败:', error);
          }
        }
      }

      if (activeChatId || newChatId) {
        const finalChatId = newChatId || activeChatId;
        const updatedHistories = chatHistories.map(chat => {
          if (chat.id === finalChatId) {
            const updatedMessages = [
              ...chat.messages,
              userMessage,
              {
                ...thinkingMessage,
                content: fullContent,
                thinking: false,
              },
            ];
            return {
              ...chat,
              messages: updatedMessages,
              title: input.trim(),
              timestamp: new Date(),
            };
          }
          return chat;
        });

        let newChat: ChatHistory | null = null;
        if (newChatId && !chatHistories.find(chat => chat.id === newChatId)) {
          newChat = {
            id: newChatId,
            title:
              input.trim().length > 20
                ? `${input.trim().substring(0, 20)}...`
                : input.trim(),
            messages: [
              userMessage,
              {
                ...thinkingMessage,
                content: fullContent,
                thinking: false,
              },
            ],
            timestamp: new Date(),
          };
          setChatHistories([newChat, ...chatHistories]);
        } else {
          setChatHistories(updatedHistories);
        }

        localStorage.setItem(
          'chatHistories',
          JSON.stringify(
            newChat
              ? [{ ...newChat, messages: [] }, ...chatHistories]
              : updatedHistories,
          ),
        );
      }
    } catch (error) {
      toast.error('发送消息失败，请稍后重试');
      console.error('Error sending message:', error);

      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === thinkingMessage.id
            ? {
                ...msg,
                content: '抱歉，我暂时无法提供回答，请稍后再试。',
                thinking: false,
                isSearchResult: true, // 即使失败也标记为搜索结果
              }
            : msg,
        ),
      );
    } finally {
      setIsTyping(false);
      setIsUsingSearch(false);
    }
  };

  // 发送消息
  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    const thinkingMessage: Message = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      thinking: true,
      timestamp: new Date(),
    };

    setMessages([...newMessages, thinkingMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input.trim(),
          useSearch: false,
          chatId: activeChatId,
        }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.details || errorMessage;
        } catch (e) {}
        throw new Error(errorMessage);
      }

      const newChatId = response.headers.get('x-chat-id');
      if (newChatId && !activeChatId) {
        setActiveChatId(newChatId);
        const loadHistories = async () => {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getHistory' }),
          });
          const data = await res.json();
          if (data.code === 200) {
            const histories = data.data.map(
              (item: {
                _id: string;
                title: string;
                updatedAt: string;
              }) => ({
                id: item._id,
                title: item.title,
                messages: [],
                timestamp: new Date(item.updatedAt),
              }),
            );
            setChatHistories(histories);
          }
        };
        loadHistories();
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder('utf-8');
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';
              if (content) {
                fullContent += content;
                setMessages(prevMessages =>
                  prevMessages.map(msg =>
                    msg.id === thinkingMessage.id
                      ? { ...msg, content: fullContent, thinking: false }
                      : msg,
                  ),
                );
              }
            } catch (e) {}
          }
        }
      }

      if (newChatId || activeChatId) {
        const finalChatId = newChatId || activeChatId;
        if (finalChatId && fullContent) {
          try {
            await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'saveAiMessage',
                chatId: finalChatId,
                content: fullContent,
              }),
            });
          } catch (error) {
            console.warn('保存AI消息失败:', error);
          }
        }
      }

      if (activeChatId || newChatId) {
        const finalChatId = newChatId || activeChatId;
        const updatedHistories = chatHistories.map(chat => {
          if (chat.id === finalChatId) {
            const updatedMessages = [
              ...chat.messages,
              userMessage,
              {
                ...thinkingMessage,
                content: fullContent,
                thinking: false,
              },
            ];
            return {
              ...chat,
              messages: updatedMessages,
              title: input.trim(),
              timestamp: new Date(),
            };
          }
          return chat;
        });

        let newChat: ChatHistory | null = null;
        if (newChatId && !chatHistories.find(chat => chat.id === newChatId)) {
          newChat = {
            id: newChatId,
            title:
              input.trim().length > 20
                ? `${input.trim().substring(0, 20)}...`
                : input.trim(),
            messages: [
              userMessage,
              {
                ...thinkingMessage,
                content: fullContent,
                thinking: false,
              },
            ],
            timestamp: new Date(),
          };
          setChatHistories([newChat, ...chatHistories]);
        } else {
          setChatHistories(updatedHistories);
        }

        localStorage.setItem(
          'chatHistories',
          JSON.stringify(
            newChat
              ? [{ ...newChat, messages: [] }, ...chatHistories]
              : updatedHistories,
          ),
        );
      }
    } catch (error) {
      toast.error('发送消息失败，请稍后重试');
      console.error('Error sending message:', error);

      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === thinkingMessage.id
            ? {
                ...msg,
                content: '抱歉，我暂时无法提供回答，请稍后再试。',
                thinking: false,
              }
            : msg,
        ),
      );
    } finally {
      setIsTyping(false);
    }
  };

  // 处理输入框按键事件
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 处理搜索输入
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    // 实时搜索所有对话内容
    const results: Array<{
      id: string;
      chatId: string;
      messageId: string;
      content: string;
      role: string;
      snippet: string;
      index: number;
    }> = [];

    // 遍历所有对话历史
    // 只在当前活跃对话的已加载消息里搜索
    if (activeChatId) {
      const targetChat = chatHistories.find(c => c.id === activeChatId);
      if (targetChat) {
        // 直接复用组件中已加载的 messages（它们就是当前对话的全部消息）
        messages.forEach((message, messageIndex) => {
          if (message.content.toLowerCase().includes(query.toLowerCase())) {
            const lowerContent = message.content.toLowerCase();
            const queryLower = query.toLowerCase();
            const startIndex = lowerContent.indexOf(queryLower);

            if (startIndex !== -1) {
              const contextStart = Math.max(0, startIndex - 7);
              const contextEnd = Math.min(
                message.content.length,
                startIndex + query.length + 7,
              );

              let snippet = '';
              if (contextStart > 0) snippet += '...';
              snippet += message.content.slice(contextStart, contextEnd);
              if (contextEnd < message.content.length) snippet += '...';

              results.push({
                id: `search-${activeChatId}-${message.id}`,
                chatId: activeChatId,
                messageId: message.id,
                content: message.content,
                role: message.role,
                snippet: snippet,
                index: messageIndex,
              });
            }
          }
        });
      }
    }

    setSearchResults(results);
  };

  // 处理搜索结果点击
  const handleSearchResultClick = (result: {
    chatId: string;
    messageId: string;
    index: number;
  }) => {
    // 切换到对应的对话
    switchChat(result.chatId);

    // 关闭搜索框
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);

    // 延迟一下，等消息加载完成后滚动到对应位置
    setTimeout(() => {
      const messageElement = document.getElementById(result.messageId);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // 高亮显示找到的消息
        messageElement.classList.add('bg-blue-100', 'dark:bg-blue-900/30');
        setTimeout(() => {
          messageElement.classList.remove('bg-blue-100', 'dark:bg-blue-900/30');
        }, 2000);
      }
    }, 500);
  };

  // 格式化搜索结果，高亮关键词
  const formatSearchSnippet = (snippet: string, query: string) => {
    if (!query.trim()) return snippet;

    const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
    const parts = snippet.split(regex);

    return parts.map((part, index) => {
      if (part.toLowerCase() === query.toLowerCase()) {
        return (
          <span
            key={`${index}-${part}`}
            className="text-blue-600 dark:text-blue-400 font-semibold"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // 转义正则表达式特殊字符
  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  return (
    <div className={`chat-container ${isDark ? 'dark-mode' : ''}`}>
      {/* 侧边栏 */}
      <div
        className={`sidebar ${showSidebar ? 'open' : ''} ${isDark ? 'sidebar-dark' : 'sidebar-light'}`}
      >
        <div className="sidebar-header">
          {showSidebar && <h1 className="sidebar-title">AI 对话助手</h1>}
          <button
            type="button"
            className="theme-btn"
            onClick={() => setShowSidebar(!showSidebar)}
            title={showSidebar ? '收起侧边栏' : '展开侧边栏'}
          >
            {showSidebar ? (
              <ChevronLeft size={20} />
            ) : (
              <ChevronRight size={20} />
            )}
          </button>

          {!showSidebar && (
            <button
              type="button"
              className="theme-btn"
              onClick={createNewChat}
              title="新建对话框"
            >
              <Plus size={20} />
            </button>
          )}
        </div>

        {showSidebar && (
          <div className="p-4">
            <button
              type="button"
              className={`new-chat-btn ${!showSidebar ? 'new-chat-btn-collapsed' : ''}`}
              onClick={createNewChat}
              title="新建对话框"
            >
              <Plus size={18} />
              <span>新对话</span>
            </button>
          </div>
        )}

        <div className="chat-list">
          {chatHistories.length === 0 ? (
            <div className="empty-state">
              <MessageSquare size={48} className="empty-icon" />
              <p>还没有对话记录</p>
              <p className="text-sm">点击"新对话"开始聊天</p>
            </div>
          ) : (
            <div className="space-y-1">
              {chatHistories.map(chat => (
                <button
                  key={chat.id}
                  type="button"
                  className={`chat-item ${activeChatId === chat.id ? 'active' : ''} cursor-pointer bg-transparent border-none w-full text-left p-0`}
                  onClick={() => switchChat(chat.id)}
                >
                  <div className="chat-item-content">
                    <div className="tooltip-container">
                      <h3 className="chat-title">
                        {chat.title || '无标题对话'}
                      </h3>
                      <p className="chat-time">
                        {new Date(chat.timestamp).toLocaleString('zh-CN', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={e => {
                        e.stopPropagation();
                        deleteChat(chat.id);
                      }}
                      title="删除对话"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="user-info">
          {showSidebar && (
            <div className="user-avatar">
              <User size={16} />
            </div>
          )}
          <div className="flex-1">
            {showSidebar && <p className="user-name">用户</p>}
            {showSidebar && <p className="user-role">豆包AI</p>}
          </div>
        </div>
      </div>

      {/* 主聊天区域 */}
      <div className="main-content">
        {/* 移动端顶部导航栏 */}
        <div className={`top-nav ${isDark ? 'top-nav-dark' : 'top-nav-light'}`}>
          <div className="flex items-center gap-2" />
          <h1
            className={`main-title text-center ${isDark ? 'text-white' : 'text-black'}`}
          >
            {activeChatId
              ? chatHistories.find(chat => chat.id === activeChatId)?.title ||
                'AI 对话助手'
              : 'AI 对话助手'}
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="theme-btn"
              onClick={() => setShowSearch(!showSearch)}
              title={showSearch ? '关闭搜索' : '打开搜索'}
            >
              <Search size={20} />
            </button>
            <button
              type="button"
              className="theme-btn"
              onClick={toggleTheme}
              title={isDark ? '切换到浅色主题' : '切换到深色主题'}
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>

        {/* 搜索框 */}
        {showSearch && (
          <div
            className={`search-container ${isDark ? 'search-container-dark' : 'search-container-light'}`}
          >
            <div className="search-input-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="搜索所有对话..."
                className={`search-input ${isDark ? 'search-input-dark' : 'search-input-light'}`}
              />
              <button
                type="button"
                className="search-close-btn"
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                title="关闭搜索"
              >
                ×
              </button>
            </div>

            {/* 搜索结果 */}
            {searchResults.length > 0 && (
              <div
                className={`search-results ${isDark ? 'search-results-dark' : 'search-results-light'}`}
              >
                <div className="search-results-header">
                  <span>找到 {searchResults.length} 个结果</span>
                </div>
                <div className="search-results-list">
                  {searchResults.map(result => (
                    <button
                      key={result.id}
                      type="button"
                      className="search-result-item cursor-pointer bg-transparent border-none w-full text-left p-0"
                      onClick={() => handleSearchResultClick(result)}
                    >
                      <div className="search-result-role">
                        {result.role === 'user' ? (
                          <User size={16} />
                        ) : (
                          <Bot size={16} />
                        )}
                      </div>
                      <div className="search-result-content">
                        <div className="search-result-snippet">
                          {formatSearchSnippet(result.snippet, searchQuery)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 无结果 */}
            {searchQuery.trim() && searchResults.length === 0 && (
              <div
                className={`search-results ${isDark ? 'search-results-dark' : 'search-results-light'}`}
              >
                <div className="search-no-results">
                  <p>未找到匹配的内容</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 桌面端顶部导航栏 - 已移除标题和按钮 */}
        <div
          className={`p-2 border-b ${isDark ? 'hidden md:block border-gray-700' : 'hidden md:block border-gray-200'}`}
        />

        {/* 聊天消息区域 */}
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="welcome-avatar">
                <Bot size={48} className="welcome-icon" />
              </div>
              <h2 className="welcome-title">你好！我是你的AI助手</h2>
              <p className="welcome-subtitle">
                我可以帮助你解答问题、提供建议、进行创意讨论。请输入你的问题开始对话吧！
              </p>
              <div className="example-buttons">
                <button
                  type="button"
                  className={`example-btn ${isDark ? 'example-btn-dark' : 'example-btn-light'}`}
                  onClick={() => setInput('如何提高编程效率？')}
                >
                  如何提高编程效率？
                </button>
                <button
                  type="button"
                  className={`example-btn ${isDark ? 'example-btn-dark' : 'example-btn-light'}`}
                  onClick={() => setInput('请帮我生成一份健身计划')}
                >
                  生成健身计划
                </button>
                <button
                  type="button"
                  className={`example-btn ${isDark ? 'example-btn-dark' : 'example-btn-light'}`}
                  onClick={() => setInput('介绍一下最新的AI技术')}
                >
                  介绍最新AI技术
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map(message => (
                <div
                  id={message.id}
                  key={message.id}
                  className={`message-row ${message.role === 'user' ? 'user' : 'assistant'}`}
                >
                  <div
                    className={`message-content ${message.role === 'user' ? 'user' : ''}`}
                  >
                    <div
                      className={`message-avatar ${
                        message.role === 'user'
                          ? 'user-avatar-bubble'
                          : 'assistant-avatar-bubble'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <User size={16} />
                      ) : (
                        <Bot size={16} />
                      )}
                    </div>
                    <div
                      className={`message-bubble ${
                        message.role === 'user'
                          ? 'user-bubble'
                          : 'assistant-bubble'
                      }`}
                    >
                      {message.thinking ? (
                        <div className="thinking-dots">
                          <div className="thinking-dot" />
                          <div className="thinking-dot" />
                          <div className="thinking-dot" />
                        </div>
                      ) : (
                        <>
                          {message.isSearchResult && (
                            <div className="text-xs text-blue-600 dark:text-blue-400 mb-1 font-semibold flex items-center">
                              <Search size={14} className="mr-1" />{' '}
                              已使用联网搜索提供最新信息
                            </div>
                          )}
                          <p>{message.content}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 输入区域 */}
        <div className="input-container">
          <div
            className={`input-wrapper ${isDark ? 'input-wrapper-dark' : 'input-wrapper-light'}`}
          >
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入你的问题或指令..."
              className={`textarea-input ${isDark ? 'textarea-input-dark' : 'textarea-input-light'}`}
              disabled={isTyping}
            />
            <div className="input-buttons">
              <button
                type="button"
                className={`input-btn ${isTyping ? 'disabled' : ''} ${isUsingSearch ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : ''}`}
                disabled={isTyping}
                onClick={() => {
                  if (input.trim()) {
                    sendMessageWithSearch();
                  }
                }}
                title="使用联网搜索"
              >
                <Globe size={20} />
              </button>
              <button
                type="button"
                className={`send-btn input-btn ${isTyping ? 'disabled' : ''}`}
                onClick={sendMessage}
                disabled={isTyping || !input.trim()}
                title="发送消息"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
          <p className="input-hint">提示：按Enter键发送消息，Shift+Enter换行</p>
        </div>
      </div>
    </div>
  );
}
