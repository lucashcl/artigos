export type Result<T, E = Error> = readonly [T, null] | readonly [null, E]

export const ok = <T>(value: T): Result<T, never> => [value, null] as const
export const err = <E>(error: E): Result<never, E> => [null, error] as const
