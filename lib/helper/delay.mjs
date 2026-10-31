export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const randomDelay = (min = 1500, max = 4000) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/** Lama "sedang mengetik" sebanding panjang teks: 120 ms per karakter, paling lama 15 detik. */
export const typingDelay = (text = "") => Math.min(15000, String(text).length * 120);
