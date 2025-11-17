import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { Song } from "@/api/music";

export const useSearchStore = defineStore("search", () => {
  // 搜索关键词
  const keyword = ref("");
  // 所有搜索结果
  const allResults = ref<Song[]>([]);
  // 是否正在搜索
  const searching = ref(false);
  // 是否显示搜索结果
  const showResults = ref(false);
  // 当前页码
  const currentPage = ref(1);
  // 每页显示数量
  const pageSize = ref(30);
  // 总结果数
  const total = ref(0);

  // 当前页的搜索结果
  const searchResults = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    return allResults.value.slice(start, end);
  });

  // 总页数
  const totalPages = computed(() => {
    return Math.ceil(total.value / pageSize.value);
  });

  // 设置搜索结果
  const setSearchResults = (results: Song[]) => {
    allResults.value = results;
    total.value = results.length;
    currentPage.value = 1; // 重置到第一页
    showResults.value = true;
  };

  // 清空搜索结果
  const clearSearchResults = () => {
    allResults.value = [];
    total.value = 0;
    currentPage.value = 1;
    showResults.value = false;
    keyword.value = "";
  };

  // 设置搜索状态
  const setSearching = (status: boolean) => {
    searching.value = status;
  };

  // 设置关键词
  const setKeyword = (kw: string) => {
    keyword.value = kw;
  };

  // 设置当前页
  const setCurrentPage = (page: number) => {
    currentPage.value = page;
  };

  // 上一页
  const prevPage = () => {
    if (currentPage.value > 1) {
      currentPage.value--;
    }
  };

  // 下一页
  const nextPage = () => {
    if (currentPage.value < totalPages.value) {
      currentPage.value++;
    }
  };

  return {
    keyword,
    searchResults,
    allResults,
    searching,
    showResults,
    currentPage,
    pageSize,
    total,
    totalPages,
    setSearchResults,
    clearSearchResults,
    setSearching,
    setKeyword,
    setCurrentPage,
    prevPage,
    nextPage,
  };
});
