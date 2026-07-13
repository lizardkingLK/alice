export const delay = (ms: number = 3000) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
