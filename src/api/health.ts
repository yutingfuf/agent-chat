// 健康检查API接口文件
export async function getHealthStatus() {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('获取健康状态失败:', error);
    throw error;
  }
}

// 导出所有健康检查相关函数
export default {
  getHealthStatus,
};
