/**
 * Hello API - 用于测试和演示
 */

/**
 * GET请求处理函数
 * @returns 欢迎消息
 */
export const get = async () => ({
  message: 'Hello Modern.js',
  timestamp: new Date().toISOString(),
  status: 'success',
});

/**
 * POST请求处理函数
 * @param req - 请求对象
 * @returns 处理后的响应
 */
export const post = async ({ data }: { data?: Record<string, unknown> }) => ({
  message: 'Hello Modern.js',
  timestamp: new Date().toISOString(),
  status: 'success',
  receivedData: data || null,
});

/**
 * 默认导出，保持向后兼容性
 */
export default get;
