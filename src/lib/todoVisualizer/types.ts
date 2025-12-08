// TODO列表项类型
export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  priority?: 'high' | 'medium' | 'low';
}

// TODO列表类型
export interface TodoList {
  type: 'todo_list';
  title: string;
  items: TodoItem[];
}

// 检查内容是否为TODO列表格式
export function isTodoList(content: string): boolean {
  try {
    const data = JSON.parse(content);
    return data.type === 'todo_list' && Array.isArray(data.items);
  } catch {
    return false;
  }
}

// 解析TODO列表内容
export function parseTodoList(content: string): TodoList | null {
  try {
    const data = JSON.parse(content);
    if (data.type === 'todo_list' && Array.isArray(data.items)) {
      return data as TodoList;
    }
    return null;
  } catch {
    return null;
  }
}
