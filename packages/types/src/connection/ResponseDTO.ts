export type ResponseDTO<T> = {
  data: T | null;
  error: unknown;
};
