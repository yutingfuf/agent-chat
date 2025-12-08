import { Search } from 'lucide-react';

// 搜索结果项类型定义
interface SearchResultItem {
  id: string;
  title: string;
  content: string;
  url?: string;
}

// 工具调用结果类型
type ToolResult = {
  type: 'search_result' | 'text' | 'other';
  title?: string;
  items?: SearchResultItem[];
  content?: string;
};

interface ToolVisualizerProps {
  data: ToolResult;
}

export default function ToolVisualizer({ data }: ToolVisualizerProps) {
  // 渲染搜索结果
  const renderSearchResults = () => {
    const results = data.items as SearchResultItem[];
    return (
      <div className="tool-visualizer search-results-container">
        <div className="visualizer-header">
          <h3 className="flex items-center gap-2">
            <Search size={18} className="text-purple-500" />
            {data.title || '搜索结果'}
          </h3>
          <span className="result-count">{results.length} 条结果</span>
        </div>

        <div className="search-results">
          {results.length === 0 ? (
            <div className="empty-results">
              <p>暂无搜索结果</p>
            </div>
          ) : (
            results.map((result, index) => (
              <div key={result.id || index} className="search-result-item">
                <h4 className="result-title">
                  {result.title}
                  {result.url && (
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="result-url"
                    >
                      {result.url}
                    </a>
                  )}
                </h4>
                <p className="result-content">{result.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  // 根据工具类型渲染不同的可视化组件
  switch (data.type) {
    case 'search_result':
      return renderSearchResults();
    case 'text':
      return (
        <div className="tool-visualizer text-content">
          {data.content && <p>{data.content}</p>}
        </div>
      );
    default:
      return (
        <div className="tool-visualizer default-content">
          <p>不支持的可视化类型</p>
        </div>
      );
  }
}
