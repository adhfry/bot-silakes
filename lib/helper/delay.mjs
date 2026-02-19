export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const randomDelay = (min = 1500, max = 4000) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};
