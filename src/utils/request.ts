import { ElMessage } from "element-plus";

// 网易云音乐 API 基础地址（动态获取，支持运行时修改）
const getBaseURL = (): string => {
  // 优先使用用户自定义的 API 地址
  try {
    const settings = localStorage.getItem("music-player-settings");
    if (settings) {
      const { apiBaseUrl } = JSON.parse(settings);
      if (apiBaseUrl && apiBaseUrl.trim()) {
        return apiBaseUrl.trim();
      }
    }
  } catch (error) {
    console.error("读取自定义 API 地址失败:", error);
  }

  // 使用环境变量配置的地址
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // 默认地址
  return "http://localhost:5000";
};

// 请求超时时间（毫秒）
const TIMEOUT = 30000;

// 重试次数
const MAX_RETRIES = 3;

// 请求方法类型
type Method = "GET" | "POST" | "PUT" | "DELETE";

// 请求配置接口
interface RequestConfig {
  url: string;
  method: Method;
  data?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  showError?: boolean; // 是否显示错误提示
}

// 响应接口
interface Response<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

// 错误类型
class RequestError extends Error {
  status?: number;
  response?: any;

  constructor(message: string, status?: number, response?: any) {
    super(message);
    this.name = "RequestError";
    this.status = status;
    this.response = response;
  }
}

// 请求拦截器
const requestInterceptor = (config: RequestConfig): RequestConfig => {
  // 添加时间戳防止缓存
  if (config.method === "GET" && config.params) {
    config.params._t = Date.now();
  }

  // 可以在这里添加 token 等认证信息
  // if (token) {
  //   config.headers = {
  //     ...config.headers,
  //     Authorization: `Bearer ${token}`,
  //   };
  // }

  // 仅在开发环境打印请求日志
  if (import.meta.env.DEV) {
    console.log(
      `[Request] ${config.method} ${config.url}`,
      config.data || config.params
    );
  }

  return config;
};

// 响应拦截器
const responseInterceptor = async <T>(
  response: globalThis.Response
): Promise<Response<T>> => {
  const data = await response.json();

  // 仅在开发环境打印响应日志
  if (import.meta.env.DEV) {
    console.log(`[Response] ${response.status} ${response.url}`, data);
  }

  // 检查响应状态
  if (!response.ok) {
    throw new RequestError(
      data.message || `请求失败: ${response.statusText}`,
      response.status,
      data
    );
  }

  // 检查业务状态码
  if (data.success === false) {
    throw new RequestError(data.message || "请求失败", data.status, data);
  }

  return {
    data,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  };
};

// 错误拦截器
const errorInterceptor = (error: any, config: RequestConfig): void => {
  console.error(`[Request Error] ${config.method} ${config.url}`, error);

  // 只在需要时显示错误提示
  if (config.showError !== false) {
    let message = "请求失败";

    if (error instanceof RequestError) {
      message = error.message;
    } else if (error.name === "AbortError") {
      message = "请求超时，请检查网络连接";
    } else if (!navigator.onLine) {
      message = "网络连接已断开，请检查网络设置";
    } else {
      message = error.message || "未知错误";
    }

    ElMessage.error(message);
  }
};

// 延迟函数
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 核心请求函数（带重试）
const fetchWithRetry = async <T>(
  config: RequestConfig,
  retryCount = 0
): Promise<Response<T>> => {
  const {
    url,
    method,
    data,
    params,
    headers = {},
    timeout = TIMEOUT,
  } = requestInterceptor(config);

  // 构建完整 URL（动态获取 BASE_URL）
  const BASE_URL = getBaseURL();
  let fullUrl = `${BASE_URL}${url}`;
  if (params && method === "GET") {
    const queryString = new URLSearchParams(params).toString();
    fullUrl += `?${queryString}`;
  }

  // 创建 AbortController 用于超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // 发起请求
    const response = await fetch(fullUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 处理响应
    return await responseInterceptor<T>(response);
  } catch (error: any) {
    clearTimeout(timeoutId);

    // 如果是第一次失败且是连接错误，先检查后端健康状态
    if (retryCount === 0 && error.name === "TypeError" && url !== "/health") {
      const isHealthy = await checkAPIHealth();
      if (!isHealthy) {
        // 后端不健康，直接抛出错误，不再重试
        const healthError = new RequestError("服务器连接失败", 500);
        errorInterceptor(healthError, config);
        throw healthError;
      }
    }

    // 判断是否需要重试
    const shouldRetry =
      retryCount < (config.retries ?? MAX_RETRIES) &&
      (error.name === "AbortError" || // 超时
        error.name === "TypeError" || // 网络错误
        (error instanceof RequestError && error.status && error.status >= 500)); // 服务器错误

    if (shouldRetry) {
      if (import.meta.env.DEV) {
        console.log(
          `[Retry] ${retryCount + 1}/${config.retries ?? MAX_RETRIES} ${url}`
        );
      }
      await delay(1000 * (retryCount + 1)); // 递增延迟
      return fetchWithRetry<T>(config, retryCount + 1);
    }

    // 处理错误
    errorInterceptor(error, config);
    throw error;
  }
};

// 统一请求方法
export const request = async <T = any>(
  config: RequestConfig
): Promise<Response<T>> => {
  return fetchWithRetry<T>(config);
};

// 便捷方法
export const Request = {
  // GET 请求
  get: async <T = any>(
    url: string,
    params?: Record<string, any>,
    config?: Partial<RequestConfig>
  ) => {
    return request<T>({
      url,
      method: "GET",
      params,
      ...config,
    });
  },

  // POST 请求
  post: async <T = any>(
    url: string,
    data?: any,
    config?: Partial<RequestConfig>
  ) => {
    return request<T>({
      url,
      method: "POST",
      data,
      ...config,
    });
  },

  // PUT 请求
  put: async <T = any>(
    url: string,
    data?: any,
    config?: Partial<RequestConfig>
  ) => {
    return request<T>({
      url,
      method: "PUT",
      data,
      ...config,
    });
  },

  // DELETE 请求
  delete: async <T = any>(url: string, config?: Partial<RequestConfig>) => {
    return request<T>({
      url,
      method: "DELETE",
      ...config,
    });
  },
};

// 后端健康状态缓存
let isAPIHealthy = true;
let consecutiveFailures = 0; // 连续失败次数
const MAX_CONSECUTIVE_FAILURES = 3; // 最大连续失败次数

// 检查 API 健康状态（仅在请求失败时调用）
export const checkAPIHealth = async (): Promise<boolean> => {
  // 如果连续失败3次，直接返回false（不再检查）
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    console.warn("⚠️ 服务器已连续失败3次，已停止检查。请检查服务器");
    return false;
  }

  try {
    await Request.get("/health", undefined, {
      showError: false,
      timeout: 3000,
      retries: 0, // 健康检查不重试
    });

    const wasUnhealthy = !isAPIHealthy;
    isAPIHealthy = true;
    consecutiveFailures = 0; // 重置失败计数

    if (wasUnhealthy) {
      if (import.meta.env.DEV) {
        console.log("✅ 服务器已恢复");
      }
      ElMessage.success("后端服务已恢复连接");
    } else if (import.meta.env.DEV) {
      console.log("✅ 服务器正常");
    }
    return true;
  } catch (error) {
    isAPIHealthy = false;
    consecutiveFailures++; // 增加失败计数

    console.warn(
      `⚠️ 服务器连接失败 (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`
    );

    // 如果达到3次失败，提示用户
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.warn(
        "⚠️ 服务器连续失败3次，已停止检查。请启动后端服务后重新搜索歌曲。"
      );
      ElMessage.error("服务器连接失败，请启动后端服务后重新搜索");
    }

    return false;
  }
};

// 获取当前健康状态（不发起请求）
export const getAPIHealthStatus = (): boolean => {
  return isAPIHealthy;
};

// 获取连续失败次数
export const getConsecutiveFailures = (): number => {
  return consecutiveFailures;
};

// 重置健康状态（用户主动搜索时调用）
export const resetAPIHealthStatus = (): void => {
  consecutiveFailures = 0; // 重置失败计数
  isAPIHealthy = true; // 重置健康状态
  if (import.meta.env.DEV) {
    console.log("🔄 用户发起搜索，健康检查状态已重置");
  }
};

export default Request;
