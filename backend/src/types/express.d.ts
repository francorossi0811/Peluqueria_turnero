export {}

declare global {
  namespace Express {
    interface Request {
      admin?: { sub: string; usuario: string }
    }
  }
}
