export const chromeStorage = {
  async getItem(key) {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? null;
  },

  async setItem(key, value) {
    await chrome.storage.local.set({ [key]: value });
  },

  async removeItem(key) {
    await chrome.storage.local.remove(key);
  },
};