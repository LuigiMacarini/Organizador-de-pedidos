/** Erro de aplicação com status HTTP associado — evita anexar `statusCode` manualmente a cada `Error`. */
export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso não encontrado") {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Não autenticado") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Sem permissão para esta ação") {
    super(message, 403);
  }
}
