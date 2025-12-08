import type React from 'react';
import { useEffect, useState } from 'react';
import type { TodoItem, TodoList } from './types';
import './TodoListVisualizer.css';

interface TodoListVisualizerProps {
  todoList: TodoList;
}

export default function TodoListVisualizer({
  todoList,
}: TodoListVisualizerProps) {
  // 状态管理TODO项，包含原始排序信息
  const [items, setItems] = useState<TodoItem[]>([]);

  // 初始化状态，保存原始顺序
  useEffect(() => {
    setItems(todoList.items);
  }, [todoList]);

  // 处理TODO项点击，切换完成状态
  const handleTodoClick = (id: string) => {
    setItems(prevItems => {
      // 切换完成状态
      const updatedItems = prevItems.map(item =>
        item.id === id ? { ...item, completed: !item.completed } : item,
      );

      // 重新排序：未完成项在前，已完成项在后，保持各自内部的原始顺序
      const sortedItems = [
        ...updatedItems.filter(item => !item.completed),
        ...updatedItems.filter(item => item.completed),
      ];

      return sortedItems;
    });
  };

  // 处理键盘事件，支持空格键和回车键切换状态
  const handleTodoKeyPress = (id: string, e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleTodoClick(id);
    }
  };

  return (
    <div className="todo-list-container">
      <div className="todo-header">
        <h3>{todoList.title}</h3>
        <span className="todo-count">
          {items.filter(item => !item.completed).length} 项待办
        </span>
      </div>
      <div className="todo-items">
        {items.map(item => (
          <div
            key={item.id}
            className={`todo-item ${item.completed ? 'completed' : ''} ${item.priority || ''}`}
          >
            <div className="todo-content">
              <button
                type="button"
                className="todo-checkbox"
                onClick={() => handleTodoClick(item.id)}
                onKeyPress={e => handleTodoKeyPress(item.id, e)}
                style={{
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  margin: 0,
                }}
              >
                {item.completed ? '✓' : '□'}
              </button>
              <div className="todo-text">{item.text}</div>
            </div>
            {item.priority && (
              <div className={`priority-badge ${item.priority}`}>
                {item.priority === 'high'
                  ? '高'
                  : item.priority === 'medium'
                    ? '中'
                    : '低'}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
