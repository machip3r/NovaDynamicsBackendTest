type ResponseObject = Record<string, unknown>;
export type ResponseData = ResponseObject | readonly ResponseObject[];

export function successResponse(data: ResponseData = {}) {
  return { data, success: true, error: null } as const;
}

export function errorResponse(error: string, data: ResponseData = {}) {
  return { data, success: false, error } as const;
}
