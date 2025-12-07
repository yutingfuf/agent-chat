// 健康检查API端点
// 用于监控服务状态和连接性

/**
 * 健康检查GET请求处理函数
 * @returns 包含服务状态信息的JSON响应
 */
export const get = async () => {
  try {
    // 检查数据库连接状态（如果有）
    let dbStatus = 'unknown';
    try {
      // 尝试导入数据库服务进行检查
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState === 1) {
        dbStatus = 'connected';
      } else {
        dbStatus = 'disconnected';
      }
    } catch (e) {
      // 如果无法检查数据库连接，不影响健康检查
    }

    // 返回健康状态信息
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'llmAgent',
      version: process.env.npm_package_version || 'unknown',
      dependencies: {
        database: dbStatus,
        api: 'operational',
      },
    };
  } catch (error) {
    // 如果发生错误，返回错误状态
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
};

/**
 * 默认导出，提供兼容性
 */
export default get;
