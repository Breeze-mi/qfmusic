import Request from "@/utils/request";

// 响应数据类型
export interface ApiResponse<T = any> {
  status: number;
  success: boolean;
  message: string;
  data: T;
}

// 歌曲信息
export interface Song {
  id: string;
  name: string;
  artists: string;
  album: string;
  picUrl: string;
  duration?: number;
}

// 歌曲详情
export interface SongDetail {
  id: string;
  name: string;
  ar_name: string;
  al_name: string;
  level: string;
  size: string;
  url: string;
  pic: string;
  lyric: string;
  tlyric?: string; // 翻译歌词
  yrc?: string; // 逐字歌词（优先级最高）
  yrc2?: string; // 逐字歌词备用
  // lyric_api_method?: string; // 歌词API方法
}

// 歌单信息
export interface Playlist {
  name: string;
  creator: string;
  description: string;
  coverImgUrl: string;
  trackCount: number;
  tracks: Song[];
}

// 专辑信息
export interface Album {
  name: string;
  artist: string;
  description: string;
  coverImgUrl: string;
  songs: Song[];
}

// 音乐 API
const MusicApi = {
  // 健康检查（可选功能，第三方API可能没有此接口）
  // health: async () => {
  //   const response = await Request.get<ApiResponse>("/health");
  //   return response.data;
  // },

  // 搜索歌曲
  search: async (keyword: string, limit: number = 30) => {
    const response = await Request.post<ApiResponse<Song[]>>("/search", {
      keyword,
      limit,
    });
    return response.data;
  },

  // 获取歌曲详情和播放链接
  getSong: async (id: string | number, level: string = "lossless") => {
    const response = await Request.post<ApiResponse<SongDetail>>("/song", {
      url: String(id),
      level,
      type: "json",
    });
    return response.data;
  },

  // 获取歌单
  getPlaylist: async (id: string) => {
    const response = await Request.post<ApiResponse<{ playlist: Playlist }>>(
      "/playlist",
      {
        id,
      }
    );
    return response.data;
  },

  // 获取专辑
  getAlbum: async (id: string) => {
    const response = await Request.post<ApiResponse<{ album: Album }>>(
      "/album",
      {
        id,
      }
    );
    return response.data;
  },
};

export default MusicApi;
