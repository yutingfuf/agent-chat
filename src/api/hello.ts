// BFF API示例文件
export async function GET() {
  return {
    status: 200,
    body: {
      message: 'Hello from BFF API!',
      timestamp: new Date().toISOString(),
    },
  };
}

// 示例POST接口
export async function POST(req: Request) {
  try {
    const data = await req.json();
    return {
      status: 200,
      body: {
        message: 'Received data',
        receivedData: data,
      },
    };
  } catch (error) {
    return {
      status: 400,
      body: {
        error: 'Invalid JSON',
      },
    };
  }
}
