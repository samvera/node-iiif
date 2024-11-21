export declare class IIIFError extends Error {
  statusCode: number
  
  constructor(
    message: string,
    opts: {
      statusCode?: number
    }
  )
}