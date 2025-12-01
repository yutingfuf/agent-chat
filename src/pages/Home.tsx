// Home.tsx - 只保留逻辑和JSX结构
import { useState, useRef, useEffect } from "react";
import { 
  Send, MessageSquare, Search, User, Bot, 
  RotateCcw, Mic, Plus, Settings, Moon, Sun 
} from "lucide-react";
import { toast } from "sonner";
import "./Home.css"; // 导入CSS文件

// 消息类型定义
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: boolean;
  timestamp: Date;
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
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
          const histories = data.data.map((item: any) => ({
            id: item._id,
            title: item.title,
            messages: [],
            timestamp: new Date(item.updatedAt),
          }));
          
          setChatHistories(histories);
          
          if (histories.length > 0 && !activeChatId) {
            setActiveChatId(histories[0].id);
            loadConversation(histories[0].id);
          }
        }
      } catch (error) {
        console.error("Failed to load chat histories:", error);
        const savedHistories = localStorage.getItem("chatHistories");
        if (savedHistories) {
          try {
            const parsedHistories = JSON.parse(savedHistories);
            setChatHistories(parsedHistories);
          } catch (error) {
            console.error("Failed to parse chat histories:", error);
          }
        }
      }
    };

    loadChatHistories();
  }, []);

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
        const conversationMessages = data.data.messages.map((msg: any) => ({
          id: msg._id || `msg-${msg.timestamp}`,
          role: msg.role,
          content: msg.content,
          thinking: msg.thinking || false,
          timestamp: new Date(msg.timestamp),
        }));
        
        setMessages(conversationMessages);
      }
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
  };

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 创建新对话
  const createNewChat = async () => {
    setActiveChatId(null);
    setMessages([]);
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
        setChatHistories(chatHistories.filter((chat) => chat.id !== chatId));
        if (activeChatId === chatId) {
          setActiveChatId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
      toast.error("删除对话失败");
    }
  };

  // 发送消息
  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    const thinkingMessage: Message = {
      id: `msg-${Date.now() + 1}`,
      role: "assistant",
      content: "",
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
            const histories = data.data.map((item: any) => ({
              id: item._id,
              title: item.title,
              messages: [],
              timestamp: new Date(item.updatedAt),
            }));
            setChatHistories(histories);
          }
        };
        loadHistories();
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

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
                      : msg
                  )
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
                content: fullContent 
              }),
            });
          } catch (error) {
            console.warn("保存AI消息失败:", error);
          }
        }
      }

      if (activeChatId || newChatId) {
        const finalChatId = newChatId || activeChatId;
        const updatedHistories = chatHistories.map((chat) => {
          if (chat.id === finalChatId) {
            const updatedMessages = [...chat.messages, userMessage, {
              ...thinkingMessage,
              content: fullContent,
              thinking: false
            }];
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
            title: input.trim().length > 20 
              ? input.trim().substring(0, 20) + "..." 
              : input.trim(),
            messages: [userMessage, {
              ...thinkingMessage,
              content: fullContent,
              thinking: false
            }],
            timestamp: new Date(),
          };
          setChatHistories([newChat, ...chatHistories]);
        } else {
          setChatHistories(updatedHistories);
        }
        
        localStorage.setItem("chatHistories", JSON.stringify(
          newChat 
            ? [{...newChat, messages: []}, ...chatHistories] 
            : updatedHistories
        ));
      }
    } catch (error) {
      toast.error("发送消息失败，请稍后重试");
      console.error("Error sending message:", error);
      
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === thinkingMessage.id
            ? { ...msg, content: "抱歉，我暂时无法提供回答，请稍后再试。", thinking: false }
            : msg
        )
      );
    } finally {
      setIsTyping(false);
    }
  };

  // 处理输入框按键事件
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

 return (
  <div className={`chat-container ${isDark ? 'dark-mode' : ''}`}>
    {/* 侧边栏 */}
    <div
      className={`sidebar ${showSidebar ? 'open' : ''} ${
        isDark ? 'sidebar-dark' : 'sidebar-light'
      }`}
    >
      <div className="sidebar-header">
        <h1 className="sidebar-title">AI 对话助手</h1>
        <button
          className="theme-btn"
          onClick={() => setShowSidebar(false)}
        >
          <Search size={20} />
        </button>
      </div>
      
      <div className="p-4">
        <button
          className="new-chat-btn"
          onClick={createNewChat}
        >
          <Plus size={18} />
          <span>新对话</span>
        </button>
      </div>
      
      <div className="chat-list">
        {chatHistories.length === 0 ? (
          <div className="empty-state">
            <MessageSquare size={48} className="empty-icon" />
            <p>还没有对话记录</p>
            <p className="text-sm">点击"新对话"开始聊天</p>
          </div>
        ) : (
          <div className="space-y-1">
            {chatHistories.map((chat) => (
              <div
                key={chat.id}
                className={`chat-item ${activeChatId === chat.id ? 'active' : ''}`}
                onClick={() => switchChat(chat.id)}
              >
                <div className="flex justify-between items-center">
                  <h3 className="chat-title">
                    {chat.title || "无标题对话"}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChat(chat.id);
                      }}
                    >
                      <RotateCcw size={16} />
                    </button>
                  </div>
                </div>
                <p className="chat-time">
                  {new Date(chat.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="user-info">
        <div className="user-avatar">
          <User size={16} />
        </div>
        <div className="flex-1">
          <p className="user-name">用户</p>
          <p className="user-role">豆包AI</p>
        </div>
      </div>
    </div> {/* 修复：侧边栏div未闭合 */}

    {/* 主聊天区域 */}
    <div className="main-content">
      {/* 移动端顶部导航栏 */}
      <div className={`top-nav ${isDark ? 'top-nav-dark' : 'top-nav-light'}`}>
        <button
          className="theme-btn"
          onClick={() => setShowSidebar(true)}
        >
          <Search size={20} />
        </button>
        <h1 className="main-title">AI 对话助手</h1>
        <button
          className="theme-btn"
          onClick={toggleTheme}
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
      
      {/* 桌面端顶部导航栏 */}
      <div className={`p-4 flex items-center justify-between border-b ${isDark ? 'hidden md:flex border-gray-700' : 'hidden md:flex border-gray-200'}`}>
        <h1 className="main-title">AI 对话助手</h1>
        <div className="flex items-center gap-2">
          <button
            className="theme-btn"
            onClick={toggleTheme}
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="theme-btn">
            <Settings size={20} />
          </button>
        </div>
      </div>
      
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
                className={`example-btn ${isDark ? 'example-btn-dark' : 'example-btn-light'}`}
                onClick={() => setInput("如何提高编程效率？")}
              >
                如何提高编程效率？
              </button>
              <button 
                className={`example-btn ${isDark ? 'example-btn-dark' : 'example-btn-light'}`}
                onClick={() => setInput("请帮我生成一份健身计划")}
              >
                生成健身计划
              </button>
              <button 
                className={`example-btn ${isDark ? 'example-btn-dark' : 'example-btn-light'}`}
                onClick={() => setInput("介绍一下最新的AI技术")}
              >
                介绍最新AI技术
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message-row ${message.role === "user" ? "user" : "assistant"}`}
              >
                <div className={`message-content ${message.role === "user" ? "user" : ""}`}>
                  <div
                    className={`message-avatar ${
                      message.role === "user" ? "user-avatar-bubble" : "assistant-avatar-bubble"
                    }`}
                  >
                    {message.role === "user" ? (
                      <User size={16} />
                    ) : (
                      <Bot size={16} />
                    )}
                  </div>
                  <div
                    className={`message-bubble ${
                      message.role === "user" ? "user-bubble" : "assistant-bubble"
                    }`}
                  >
                    {message.thinking ? (
                      <div className="thinking-dots">
                        <div className="thinking-dot"></div>
                        <div className="thinking-dot"></div>
                        <div className="thinking-dot"></div>
                      </div>
                    ) : (
                      <p>{message.content}</p>
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
        <div className={`input-wrapper ${isDark ? 'input-wrapper-dark' : 'input-wrapper-light'}`}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入你的问题或指令..."
            className={`textarea-input ${isDark ? 'textarea-input-dark' : 'textarea-input-light'}`}
            disabled={isTyping}
          />
          <div className="input-buttons">
            <button
              className={`input-btn ${isTyping ? "disabled" : ""}`}
              disabled={isTyping}
            >
              <Mic size={20} />
            </button>
            <button
              className={`send-btn input-btn ${isTyping ? "disabled" : ""}`}
              onClick={sendMessage}
              disabled={isTyping || !input.trim()}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
        <p className="input-hint">
          提示：按Enter键发送消息，Shift+Enter换行
        </p>
      </div>
    </div>
  </div>
);
}